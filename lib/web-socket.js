'use strict';

const WebSocket = require('ws');
const BaseClass = require('./base-class');

/**
 * WebSocket client for NRGWatch devices.
 * Connects to the ESP32 AsyncWebSocket server on port 8000, path /ws.
 *
 * Protocol facts (confirmed from firmware source):
 *   - Plain ws:// (NOT wss://) — see notifyClients.cpp: s_listen_on_ws = "ws://0.0.0.0:8000"
 *   - Path /ws — see notifyClients.cpp: AsyncWebSocket ws("/ws")
 *   - No authentication needed on the socket itself (AsyncWebSocket build has no auth)
 *   - Send {"sysstat": true} after connect to receive {"systemstat":{...}} every 5 seconds
 *   - Send {"ithostatus": true} to request a full {"ithostatusinfo":{...}} dump once
 *
 * See specs/decisions/ADR-001-connection-strategy.md for context.
 * Open questions IC-1, IC-2, IC-3 are resolved by firmware source analysis (2026-03-21).
 *
 * @extends BaseClass
 */
class NRGWatchWebSocket extends BaseClass {
  /**
   * WebSocket configuration constants
   * @private
   * @readonly
   */
  static CONFIG = {
    PING_INTERVAL: 30000, // 30 seconds
    RECONNECT_DELAY: 5000, // 5 seconds initial reconnect delay
    PORT: 8000,
    PATH: '/ws',
  };

  constructor(...props) {
    super(...props);

    /** @type {string|null} Device hostname or IP */
    this._host = null;

    /** @type {string} Current connection status */
    this.loggedInStatus = 'Disconnected';

    /** @type {string|null} ISO timestamp of last received message */
    this.lastWebsocketMessage = null;

    /** @type {WebSocket|null} Active WebSocket connection */
    this._ws = null;

    /** @type {boolean} Whether the message handler is attached */
    this._handlerAttached = false;

    /** @type {number|null} Ping interval handle */
    this._pingInterval = null;

    /** @type {number|null} Reconnect timeout handle */
    this._reconnectTimeout = null;

    /** @type {boolean} Whether we are intentionally closed (device deleted/settings changed) */
    this._closed = false;

    /** @type {Function|null} Callback for incoming device messages */
    this._messageHandler = null;
  }

  /**
   * Sets the device host for WebSocket connections.
   * @param {string} host - Device IP or hostname
   */
  setHost(host) {
    this._host = host;
  }

  /**
   * Registers a callback for incoming WebSocket messages.
   * @param {Function} handler - Called with (eventData: Object) on every valid message
   */
  setMessageHandler(handler) {
    this._messageHandler = handler;
  }

  /**
   * Builds the WebSocket URL: ws://<host>:8000/ws
   * @private
   * @returns {string}
   */
  _buildUrl() {
    const host = this._host || this.homey?.app?.api?.webclient?._serverHost;
    return `ws://${host}:${NRGWatchWebSocket.CONFIG.PORT}${NRGWatchWebSocket.CONFIG.PATH}`;
  }

  /**
   * Returns true if the WebSocket is currently open.
   * @returns {boolean}
   */
  isConnected() {
    return this._ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connects to the WebSocket server and starts listening.
   * Safe to call multiple times — skips if already connected.
   * @returns {void}
   */
  connect() {
    if (this._ws && (this._ws.readyState === WebSocket.CONNECTING || this._ws.readyState === WebSocket.OPEN)) {
      return;
    }

    if (!this._host) {
      this.homey?.log('WS: no host set, skipping connect');
      return;
    }

    this._closed = false;

    const url = this._buildUrl();
    this.homey?.log(`WS: connecting to ${url}`);
    this.loggedInStatus = 'Connecting';

    try {
      // Plain ws:// — no TLS, no auth header (firmware AsyncWebSocket has no auth)
      this._ws = new WebSocket(url, {
        perMessageDeflate: false,
        handshakeTimeout: 10000,
      });
    } catch (err) {
      this.homey?.log(`WS: failed to create socket: ${err.message}`);
      this.loggedInStatus = err.message;
      this._scheduleReconnect();
      return;
    }

    this._ws.on('open', () => {
      this.homey?.log(`WS: connected to ${url}`);
      this.loggedInStatus = 'Connected';
      this._handlerAttached = false;

      // Start ping to keep connection alive
      this._startPing();

      // Activate periodic systemstat push (every 5 s) + request full ithostatus dump
      this._send({ sysstat: true });
      this._send({ ithostatus: true });

      this._attachMessageHandler();
    });

    this._ws.on('pong', () => {
      this.homey?.log('WS: pong received');
    });

    this._ws.on('close', (code, reason) => {
      this.homey?.log(`WS: closed (${code} ${reason})`);
      this.loggedInStatus = 'Disconnected';
      this._cleanup();
      if (!this._closed) {
        this._scheduleReconnect();
      }
    });

    this._ws.on('error', (err) => {
      this.homey?.log(`WS: error: ${err.message}`);
      this.loggedInStatus = err.message;
      // 'close' event will fire after 'error', which triggers reconnect
    });
  }

  /**
   * Attaches the on('message') handler. Idempotent.
   * @private
   */
  _attachMessageHandler() {
    if (this._handlerAttached || !this._ws) return;

    this._ws.on('message', (raw) => {
      const str = raw.toString();

      if (!str || str === 'Hello' || str === 'pong') return;

      this.lastWebsocketMessage = new Date().toISOString().slice(0, 16);

      try {
        const data = JSON.parse(str);
        if (!data || typeof data !== 'object') return;
        this.homey?.log('WS: message received:', str.slice(0, 120));
        if (this._messageHandler) {
          this._messageHandler(data);
        }
      } catch (e) {
        this.homey?.log('WS: non-JSON message ignored:', str.slice(0, 80));
      }
    });

    this._handlerAttached = true;
  }

  /**
   * Sends a JSON object to the WebSocket server.
   * @private
   * @param {Object} obj
   */
  _send(obj) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }

  /**
   * Starts the ping interval.
   * @private
   */
  _startPing() {
    this._stopPing();
    this._pingInterval = this.homey?.setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._ws.ping();
      }
    }, NRGWatchWebSocket.CONFIG.PING_INTERVAL);
  }

  /**
   * Stops the ping interval.
   * @private
   */
  _stopPing() {
    if (this._pingInterval) {
      this.homey?.clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  /**
   * Cleans up socket and timers without setting _closed.
   * @private
   */
  _cleanup() {
    this._stopPing();
    this._handlerAttached = false;
    if (this._ws) {
      try {
        this._ws.terminate();
      } catch (_) { /* ignore */ }
      this._ws = null;
    }
  }

  /**
   * Schedules a reconnect attempt after a delay.
   * @private
   */
  _scheduleReconnect() {
    if (this._reconnectTimeout) return;
    this._reconnectTimeout = this.homey?.setTimeout(() => {
      this._reconnectTimeout = null;
      if (!this._closed) {
        this.homey?.log('WS: attempting reconnect...');
        this.connect();
      }
    }, NRGWatchWebSocket.CONFIG.RECONNECT_DELAY);
  }

  /**
   * Disconnects and prevents automatic reconnection.
   * Call this when the device is deleted or settings change.
   * @returns {Promise<void>}
   */
  async disconnect() {
    this._closed = true;
    if (this._reconnectTimeout) {
      this.homey?.clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
    this._cleanup();
    this.loggedInStatus = 'Disconnected';
    this.homey?.log('WS: disconnected');
  }

  // --- Backward-compat stubs for existing code that may reference old methods ---

  isWebsocketConnected() {
    return this.isConnected();
  }

  getLastWebsocketMessageTime() {
    return this.lastWebsocketMessage;
  }

  launchNotificationsListener() {
    this.connect(); return true;
  }

  async disconnectEventListener() {
    await this.disconnect(); return true;
  }

  async reconnectNotificationsListener() {
    await this.disconnect(); this.connect();
  }

  configureNotificationsListener() {
    return true;
  }
}

module.exports = NRGWatchWebSocket;
