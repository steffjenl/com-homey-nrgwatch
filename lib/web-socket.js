'use strict';

const WebSocket = require('ws');
const BaseClass = require('./base-class');

/**
 * WebSocket client for NRGWatch devices.
 * Provides real-time updates from Itho ventilation systems.
 *
 * ⚠️  NOT YET IMPLEMENTED — WebSocket is never started by any driver.
 *
 * Blockers before activation:
 *   IC-1: firmware uses plain ws:// but this client connects via wss://
 *   IC-2: WebSocket payload schema from firmware is not yet documented
 *   IC-3: _apiToken property does not exist — auth mechanism unknown
 *
 * See specs/10-open-questions.md (IC-1, IC-2, IC-3) and
 * specs/decisions/ADR-001-connection-strategy.md for context.
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
    PORT: 8000,
  };

  /**
   * Creates an instance of NRGWatchWebSocket.
   * @param {...any} props - Constructor properties
   */
  constructor(...props) {
    super(...props);

    /** @type {string} Current connection status */
    this.loggedInStatus = 'Unknown';

    /** @type {string|null} Timestamp of last received websocket message */
    this.lastWebsocketMessage = null;

    /** @type {WebSocket|null} WebSocket connection instance */
    this._eventListener = null;

    /** @type {boolean} Whether event listener is configured */
    this._eventListenerConfigured = false;

    /** @type {number|null} Ping timeout handle */
    this.pingTimeout = null;
  }

  /**
   * Sends heartbeat ping to keep connection alive.
   * @private
   * @returns {void}
   */
  heartbeat() {
    this.homey?.log('Send heartbeat ping to websocket');

    if (this.pingTimeout) {
      this.homey.clearInterval(this.pingTimeout);
    }

    if (this._eventListener) {
      this.pingTimeout = this.homey.setInterval(() => {
        this._eventListener.ping();
      }, NRGWatchWebSocket.CONFIG.PING_INTERVAL);
    }
  }

  /**
   * Checks if websocket connection is active.
   * @returns {boolean} True if connected
   */
  isWebsocketConnected() {
    return this._eventListener?.readyState === WebSocket.OPEN;
  }

  /**
   * Gets the timestamp of the last received websocket message.
   * @returns {string|null} ISO timestamp or null
   */
  getLastWebsocketMessageTime() {
    return this.lastWebsocketMessage;
  }

  /**
   * Constructs the WebSocket URL for notifications.
   * @private
   * @returns {string} WebSocket URL
   */
  notificationsUrl() {
    const host = this.homey.app.api.webclient._serverHost;
    return `wss://${host}:${NRGWatchWebSocket.CONFIG.PORT}`;
  }

  /**
   * Launches the WebSocket listener for real-time updates.
   * @returns {boolean} True if listener was started or already exists
   */
  launchNotificationsListener() {
    // If we already have a listener, we're already all set.
    if (this._eventListener) {
      return true;
    }

    this.homey?.app.log(`Update listener: ${this.notificationsUrl()}`);

    try {
      this.loggedInStatus = 'Connecting';

      const ws = new WebSocket(this.notificationsUrl(), {
        headers: {
          Authorization: `Bearer ${this.homey.app.api.webclient._apiToken || ''}`,
        },
        rejectUnauthorized: false,
        perMessageDeflate: false,
      });

      if (!ws) {
        this.homey?.app.log('Unable to connect to the realtime update events API. Will retry again later.');
        delete this._eventListener;
        this._eventListenerConfigured = false;
        return false;
      }

      this._eventListener = ws;

      // Connection opened
      this._eventListener.on('open', () => {
        this.homey?.app.log(`${this.homey.app.api.webclient._serverHost}: Connected to the realtime update events API.`);
        this.loggedInStatus = 'Connected';
        this.heartbeat();
      });

      this._eventListener.on('pong', () => {
        this.homey?.log('Received pong from websocket');
      });

      this._eventListener.on('close', () => {
        // Terminate and cleanup websocket connection and timers
        delete this._eventListener;
        this._eventListenerConfigured = false;

        if (this.pingTimeout) {
          this.homey.clearTimeout(this.pingTimeout);
        }

        this.loggedInStatus = 'Disconnected';
      });

      this._eventListener.on('error', (error) => {
        // If we're closing before fully established it's because we're shutting down the API - ignore it.
        if (error.message !== 'WebSocket was closed before the connection was established') {
          this.homey?.app.log(`${this.homey.app.api.webclient._serverHost}: ${error}`);
        }

        this.loggedInStatus = error.message;
      });
    } catch (error) {
      this.homey?.app.log(`${this.homey.app.api.webclient._serverHost}: Error connecting to the realtime update events API: ${error}`);
      this.loggedInStatus = error.toString();
    }

    return true;
  }

  /**
   * Disconnects the WebSocket event listener.
   * @returns {Promise<boolean>} Resolves to true when disconnected
   */
  async disconnectEventListener() {
    if (this._eventListener) {
      this.homey?.app.log('Called terminate websocket');
      this._eventListener.close();
      delete this._eventListener;
    }

    this._eventListenerConfigured = false;
    return true;
  }

  /**
   * Reconnects the notifications listener.
   * @returns {Promise<void>}
   */
  async reconnectNotificationsListener() {
    this.homey?.app.log('Called reconnectUpdatesListener');

    await this.disconnectEventListener();
    this.launchNotificationsListener();
    this.configureNotificationsListener();
  }

  /**
   * Determines if a websocket event should be processed.
   * @private
   * @param {string} updatePacket - Raw websocket message
   * @returns {boolean} True if event should be processed
   */
  shouldProcessEvent(updatePacket) {
    if (!updatePacket || updatePacket === 'Hello') {
      return false;
    }

    try {
      const jsonData = JSON.parse(updatePacket);

      if (!jsonData || !jsonData.data || jsonData.data.length === 0) {
        return false;
      }

      // Filter out events we don't need to process
      // This can be customized based on NRGWatch device events
      return true;
    } catch (error) {
      this.homey?.error('Error parsing websocket message:', error);
      return false;
    }
  }

  /**
   * Configures the notifications listener to handle incoming messages.
   * @returns {boolean} True if configured successfully
   */
  configureNotificationsListener() {
    // Only configure the event listener if it exists and it's not already configured.
    if (!this._eventListener || this._eventListenerConfigured) {
      return true;
    }

    // Listen for any messages coming in from our listener.
    this._eventListener.on('message', (event) => {
      if (!this.shouldProcessEvent(event.toString())) {
        return;
      }

      try {
        const eventData = JSON.parse(event.toString());

        // Update last message timestamp
        if (this.homey?.app.toLocalTime) {
          this.lastWebsocketMessage = this.homey.app.toLocalTime(new Date()).toISOString().slice(0, 16);
        } else {
          this.lastWebsocketMessage = new Date().toISOString().slice(0, 16);
        }

        // Log the event for debugging
        this.homey?.app.log('Websocket event received:', JSON.stringify(eventData));

        // TODO: Add NRGWatch-specific event handling here
        // Example: Handle device status updates, fan speed changes, etc.

      } catch (error) {
        this.homey?.error('Error processing websocket message:', error);
      }
    });

    this._eventListenerConfigured = true;
    return true;
  }
}

module.exports = NRGWatchWebSocket;
