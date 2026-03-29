'use strict';

const BaseClient = require('./base-class');
const WebClient = require('./web-client');
const NRGWatchWebSocket = require('./web-socket');

/**
 * API client for NRGWatch devices (Itho ventilation systems).
 * Provides methods to interact with Itho devices via HTTP API.
 * @extends BaseClient
 */
class NRGWatchApi extends BaseClient {
  /**
   * API endpoints
   * @private
   * @readonly
   */
  static ENDPOINTS = {
    // Legacy (all firmware)
    API: 'api.html',
    // REST API v2 (firmware 3.0.0+)
    V2_STATUS: 'api/v2/ithostatus',
    V2_SPEED: 'api/v2/speed',
    V2_LASTCMD: 'api/v2/lastcmd',
    V2_COMMAND: 'api/v2/command',
    V2_VREMOTE: 'api/v2/vremote',
    V2_RFREMOTE: 'api/v2/rfremote/command',
    V2_DEVICEINFO: 'api/v2/deviceinfo',
  };

  /**
   * API commands
   * @private
   * @readonly
   */
  static COMMANDS = {
    GET_STATUS: 'ithostatus',
    GET_SPEED: 'currentspeed',
  };

  /**
   * Creates an instance of NRGWatchApi.
   * @param {...any} props - Constructor properties
   */
  constructor(...props) {
    super(...props);

    /** @type {WebClient} HTTP client for API requests */
    this.webclient = new WebClient();

    /** @type {NRGWatchWebSocket} WebSocket client for real-time updates */
    this.websocket = new NRGWatchWebSocket();
  }

  /**
   * Configures the API client with connection settings.
   * @param {string} host - Device IP address or hostname
   * @param {string} username - Username for authentication (optional)
   * @param {string} password - Password for authentication (optional)
   * @param {boolean} isAuthenticated - Whether authentication is required
   * @param {boolean} enableVirtualRemote - Enable virtual remote functionality
   * @param {number} [virtualRemoteIndex=0] - Index of the virtual remote to use
   * @param {boolean} [useApiV2=false] - Use REST API v2 (firmware 3.0.0+)
   * @returns {void}
   */
  setSettings(host, username, password, isAuthenticated, enableVirtualRemote, virtualRemoteIndex, useApiV2 = false) {
    this.webclient._serverHost = host;
    this.webclient._userName = username;
    this.webclient._passWord = password;
    this.webclient._isAuthenticated = isAuthenticated;
    this.webclient._enableVirtualRemote = enableVirtualRemote;
    this.webclient._virtualRemoteIndex = virtualRemoteIndex ?? 0;
    this.webclient._useApiV2 = useApiV2;
    // Propagate host to websocket so it can build the correct URL
    this.websocket.setHost(host);
  }

  /**
   * Sets the Homey application instance.
   * @param {Homey} homey - The Homey application instance
   * @returns {void}
   */
  setHomeyObject(homey) {
    this.homey = homey;
    this.webclient.setHomeyObject(homey);
    this.websocket.setHomeyObject(homey);
  }

  /**
   * Retrieves the current status of the Itho device.
   * @returns {Promise<Object>} Device status object containing temperature, humidity, CO2, etc.
   * @throws {Error} If the request fails or returns invalid data
   */
  async getStatus() {
    try {
      if (this.webclient._useApiV2) {
        const response = await this.webclient.get(NRGWatchApi.ENDPOINTS.V2_STATUS);
        const result = JSON.parse(response);
        if (result.status === 'success' && result.data) return result.data;
        throw new Error('Invalid v2 response format: missing data');
      }

      const response = await this.webclient.get(
        NRGWatchApi.ENDPOINTS.API,
        { get: NRGWatchApi.COMMANDS.GET_STATUS },
      );

      const result = JSON.parse(response);

      if (result.data?.ithostatus) {
        return result.data.ithostatus;
      }

      if (result) {
        return result;
      }

      throw new Error('Invalid response format: missing ithostatus data');
    } catch (error) {
      this.homey?.error('Failed to get device status:', error.message);
      throw error;
    }
  }

  /**
   * Retrieves the current fan speed of the device.
   * @returns {Promise<number>} Current fan speed value
   * @throws {Error} If the request fails or returns invalid data
   */
  async getCurrentSpeed() {
    try {
      if (this.webclient._useApiV2) {
        const response = await this.webclient.get(NRGWatchApi.ENDPOINTS.V2_SPEED);
        const result = JSON.parse(response);
        if (result.status === 'success' && result.data != null) {
          // data may be a number directly or an object with a speed field
          return typeof result.data === 'object' ? (result.data.speed ?? result.data) : result.data;
        }
        throw new Error('Invalid v2 response format: missing speed data');
      }

      const response = await this.webclient.get(
        NRGWatchApi.ENDPOINTS.API,
        { get: NRGWatchApi.COMMANDS.GET_SPEED },
      );

      const result = JSON.parse(response);

      if (result.data?.currentspeed) {
        return result.data.currentspeed;
      }

      if (result) {
        return result;
      }

      throw new Error('Invalid response format: missing currentspeed data');
    } catch (error) {
      this.homey?.error('Failed to get current speed:', error.message);
      throw error;
    }
  }

  /**
   * Sets the fan mode of the device.
   * @param {string} mode - Fan mode (e.g., 'low', 'medium', 'high', 'auto', 'timer1', etc.)
   * @param {boolean} [useRFRemote=false] - Use RF remote command instead of direct command
   * @returns {Promise<boolean>} True if successful
   * @throws {Error} If the request fails or device doesn't accept the command
   */
  async setFanMode(mode, useRFRemote = false) {
    this.homey?.log(`Setting fan mode to: ${mode} (useRFRemote=${useRFRemote})`);

    try {
      if (this.webclient._useApiV2) {
        if (this.webclient._enableVirtualRemote) {
          const response = await this.webclient.post(NRGWatchApi.ENDPOINTS.V2_VREMOTE, {
            command: mode,
            index: this.webclient._virtualRemoteIndex,
          });
          if (this._isSuccessResponse(response)) return true;
        } else if (useRFRemote) {
          const response = await this.webclient.post(NRGWatchApi.ENDPOINTS.V2_RFREMOTE, {
            command: mode,
            index: this.webclient._virtualRemoteIndex,
          });
          if (this._isSuccessResponse(response)) return true;
        } else {
          const response = await this.webclient.post(NRGWatchApi.ENDPOINTS.V2_COMMAND, { command: mode });
          if (this._isSuccessResponse(response)) return true;
        }
        throw new Error('Device did not confirm fan mode change');
      }

      const command = this._buildFanModeCommand(mode, useRFRemote);
      const response = await this.webclient.get(NRGWatchApi.ENDPOINTS.API, command);

      if (this._isSuccessResponse(response)) {
        return true;
      }

      throw new Error('Device did not confirm fan mode change');
    } catch (error) {
      this.homey?.error('Failed to set fan mode:', error.message);
      throw error;
    }
  }

  /**
   * Sets the fan speed as a percentage.
   * @param {number} speed - Speed percentage (0-100)
   * @returns {Promise<boolean>} True if successful
   * @throws {Error} If the request fails or speed is out of range
   */
  async setFanSpeed(speed) {
    if (speed < 0 || speed > 100) {
      throw new Error(`Invalid fan speed: ${speed}. Must be between 0 and 100`);
    }

    this.homey?.log(`Setting fan speed to ${speed}%`);

    try {
      if (this.webclient._useApiV2) {
        const response = await this.webclient.post(NRGWatchApi.ENDPOINTS.V2_COMMAND, { percentage: speed });
        if (this._isSuccessResponse(response)) return true;
        throw new Error('Device did not confirm fan speed change');
      }

      const response = await this.webclient.get(NRGWatchApi.ENDPOINTS.API, { speed });

      if (this._isSuccessResponse(response)) {
        return true;
      }

      throw new Error('Device did not confirm fan speed change');
    } catch (error) {
      this.homey?.error('Failed to set fan speed:', error.message);
      throw error;
    }
  }

  /**
   * Sets the fan mode using RF remote commands.
   * @param {string} mode - Fan mode to set
   * @returns {Promise<boolean>} True if successful
   * @throws {Error} If the request fails
   */
  async setRFFanMode(mode) {
    const command = {
      rfremoteindex: this.webclient._virtualRemoteIndex,
      rfremotecmd: mode,
    };

    this.homey?.log(`Setting RF fan mode to ${JSON.stringify(command)}`);

    try {
      const response = await this.webclient.get(NRGWatchApi.ENDPOINTS.API, command);

      if (this._isSuccessResponse(response)) {
        return true;
      }

      throw new Error('Device did not confirm RF fan mode change');
    } catch (error) {
      this.homey?.error('Failed to set RF fan mode:', error.message);
      throw error;
    }
  }

  /**
   * Retrieves the last command executed on the device.
   * Returns source ("HTMLAPI", "REMOTE", "MQTTAPI", "WEB"), command name, and timestamp.
   * @returns {Promise<{source: string, command: string, timestamp: number}>}
   * @throws {Error} If the request fails
   */
  async getLastCommand() {
    try {
      if (this.webclient._useApiV2) {
        const response = await this.webclient.get(NRGWatchApi.ENDPOINTS.V2_LASTCMD);
        const result = JSON.parse(response);
        if (result.status === 'success' && result.data) {
          return result.data.lastcmd ?? result.data;
        }
        return result;
      }

      const response = await this.webclient.get(NRGWatchApi.ENDPOINTS.API, { get: 'lastcmd' });
      const result = JSON.parse(response);
      // Wrapped format: {"data":{"lastcmd":{source,command,timestamp}}}
      if (result.data?.lastcmd) return result.data.lastcmd;
      return result;
    } catch (error) {
      this.homey?.error('Failed to get last command:', error.message);
      throw error;
    }
  }

  /**
   * Probes the device for REST API v2 support by calling GET /api/v2/deviceinfo.
   * Returns true if the firmware supports v2 (firmware 3.0.0+), false otherwise.
   * Never throws.
   * @returns {Promise<boolean>}
   */
  async detectApiVersion() {
    try {
      const response = await this.webclient.get(NRGWatchApi.ENDPOINTS.V2_DEVICEINFO);
      const result = JSON.parse(response);
      return result.status === 'success';
    } catch (_) {
      return false;
    }
  }

  /**
   * Builds the appropriate command object for setting fan mode.
   * @private
   * @param {string} mode - The fan mode to set
   * @param {boolean} useRFRemote - Whether to use RF remote commands
   * @returns {Object} Command object for the API
   */
  _buildFanModeCommand(mode, useRFRemote) {
    if (this.webclient._enableVirtualRemote) {
      return {
        vremoteindex: this.webclient._virtualRemoteIndex,
        vremotecmd: mode,
      };
    }

    if (useRFRemote) {
      return {
        rfremotecmd: mode,
      };
    }

    return {
      command: mode,
    };
  }

  /**
   * Checks if a response indicates success.
   * @private
   * @param {string} response - Response from the API
   * @returns {boolean} True if the response indicates success
   */
  _isSuccessResponse(response) {
    if (response === 'OK') {
      return true;
    }

    if (this._isValidJsonString(response)) {
      const result = JSON.parse(response);
      return result.status === 'success';
    }

    return false;
  }

  /**
   * Validates if a string is valid JSON.
   * @private
   * @param {string} str - String to validate
   * @returns {boolean} True if the string is valid JSON
   */
  _isValidJsonString(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = NRGWatchApi;
