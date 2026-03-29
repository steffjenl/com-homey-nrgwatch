'use strict';

const http = require('node:http');
const BaseClient = require('./base-class');

/**
 * HTTP client for communicating with NRGWatch devices.
 * Handles authentication and API requests.
 * @extends BaseClient
 */
class WebClient extends BaseClient {
  /**
   * HTTP status codes
   * @private
   * @readonly
   */
  static HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
  };

  /**
   * Default server configuration
   * @private
   * @readonly
   */
  static DEFAULTS = {
    PORT: 80,
    TIMEOUT: 10000, // 10 seconds
  };

  /**
   * Creates an instance of WebClient.
   * @param {...any} props - Constructor properties
   */
  constructor(...props) {
    super(...props);

    /** @type {string|null} Server hostname or IP address */
    this._serverHost = null;

    /** @type {number} Server port */
    this._serverPort = WebClient.DEFAULTS.PORT;

    /** @type {string|null} Username for authentication */
    this._userName = null;

    /** @type {string|null} Password for authentication */
    this._passWord = null;

    /** @type {boolean} Whether authentication is enabled */
    this._isAuthenticated = false;

    /** @type {boolean} Whether virtual remote is enabled */
    this._enableVirtualRemote = false;

    /** @type {number} Index of the virtual remote */
    this._virtualRemoteIndex = 0;

    /** @type {boolean} Whether to use REST API v2 (firmware 3.0.0+) */
    this._useApiV2 = false;
  }

  /**
   * Performs an HTTP GET request to the device API.
   * @param {string} resource - API resource path
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<string>} Response body as string
   * @throws {Error} If authentication fails or request fails
   */
  async get(resource, params = {}) {
    this.homey?.log(`WebClient GET ${resource} with params: ${JSON.stringify(params)}`);

    const headers = this._buildHeaders(params);
    const options = this._buildRequestOptions('GET', resource, params, headers);

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        const data = [];

        res.on('data', (chunk) => data.push(chunk));

        res.on('end', () => {
          const responseBody = data.join('');

          try {
            this._validateResponse(res.statusCode, responseBody);
            resolve(responseBody);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        this.homey?.error('HTTP request error:', error.message);
        reject(error);
      });

      req.setTimeout(WebClient.DEFAULTS.TIMEOUT, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Performs an HTTP POST request to the device API with a JSON body.
   * @param {string} resource - API resource path
   * @param {Object} [body={}] - Request body (serialized as JSON)
   * @returns {Promise<string>} Response body as string
   * @throws {Error} If authentication fails or request fails
   */
  async post(resource, body = {}) {
    this.homey?.log(`WebClient POST ${resource} with body: ${JSON.stringify(body)}`);

    const headers = this._buildPostHeaders();
    const bodyString = JSON.stringify(body);
    const options = this._buildRequestOptions('POST', resource, {}, headers);
    options.headers['Content-Length'] = Buffer.byteLength(bodyString);

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        const data = [];

        res.on('data', (chunk) => data.push(chunk));

        res.on('end', () => {
          const responseBody = data.join('');

          try {
            this._validateResponse(res.statusCode, responseBody);
            resolve(responseBody);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        this.homey?.error('HTTP POST request error:', error.message);
        reject(error);
      });

      req.setTimeout(WebClient.DEFAULTS.TIMEOUT, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(bodyString);
      req.end();
    });
  }

  /**
   * Tests connection to a device and determines if authentication is required.
   * @param {string} ipAddress - Device IP address
   * @param {string|null} [userName=null] - Username for authentication
   * @param {string|null} [passWord=null] - Password for authentication
   * @returns {Promise<string|number>} Response data or HTTP status code
   * @throws {Error} If connection fails
   */
  async testConnection(ipAddress, userName = null, passWord = null) {
    const params = { get: 'ithostatus' };

    if (userName) {
      params.username = userName;
      params.password = passWord;
    }

    const options = {
      method: 'GET',
      hostname: ipAddress,
      port: WebClient.DEFAULTS.PORT,
      path: `/api.html${this._toQueryString(params)}`,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: '*/*',
      },
      timeout: WebClient.DEFAULTS.TIMEOUT,
    };

    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        const data = [];

        res.on('data', (chunk) => data.push(chunk));

        res.on('end', () => {
          // Return status code for auth-related responses
          if (res.statusCode === WebClient.HTTP_STATUS.UNAUTHORIZED) {
            return resolve(WebClient.HTTP_STATUS.UNAUTHORIZED);
          }

          if (res.statusCode === WebClient.HTTP_STATUS.FORBIDDEN) {
            return resolve(WebClient.HTTP_STATUS.FORBIDDEN);
          }

          if (res.statusCode !== WebClient.HTTP_STATUS.OK) {
            return reject(new Error(
              `Connection test failed (status: ${res.statusCode}, response: ${data.join('')})`,
            ));
          }

          return resolve(data.join(''));
        });
      });

      req.on('error', (error) => {
        this.homey?.error('Connection test error:', error.message);
        reject(error);
      });

      req.setTimeout(WebClient.DEFAULTS.TIMEOUT, () => {
        req.destroy();
        reject(new Error('Connection test timeout'));
      });

      req.end();
    });
  }

  /**
   * Builds HTTP headers including authentication if required.
   * @private
   * @param {Object} params - Query parameters (modified in place if authenticated)
   * @returns {Object} HTTP headers object
   */
  _buildHeaders(params) {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: '*/*',
    };

    if (this._isAuthenticated) {
      params.username = this._userName;
      params.password = this._passWord;

      const credentials = Buffer.from(`${this._userName}:${this._passWord}`).toString('base64');
      headers.Authorization = `Basic ${credentials}`;
    }

    return headers;
  }

  /**
   * Builds HTTP headers for JSON POST requests including authentication if required.
   * @private
   * @returns {Object} HTTP headers object
   */
  _buildPostHeaders() {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    };

    if (this._isAuthenticated) {
      const credentials = Buffer.from(`${this._userName}:${this._passWord}`).toString('base64');
      headers.Authorization = `Basic ${credentials}`;
    }

    return headers;
  }

  /**
   * Builds HTTP request options.
   * @private
   * @param {string} method - HTTP method
   * @param {string} resource - API resource path
   * @param {Object} params - Query parameters
   * @param {Object} headers - HTTP headers
   * @returns {Object} HTTP request options
   */
  _buildRequestOptions(method, resource, params, headers) {
    return {
      method,
      hostname: this._serverHost,
      port: this._serverPort,
      path: `/${resource}${this._toQueryString(params)}`,
      headers,
      timeout: WebClient.DEFAULTS.TIMEOUT,
    };
  }

  /**
   * Validates HTTP response and throws errors for failure cases.
   * @private
   * @param {number} statusCode - HTTP status code
   * @param {string} responseBody - Response body
   * @throws {Error} If response indicates failure
   */
  _validateResponse(statusCode, responseBody) {
    // Check for authentication failures
    if (
      statusCode === WebClient.HTTP_STATUS.UNAUTHORIZED
      || statusCode === WebClient.HTTP_STATUS.FORBIDDEN
      || responseBody === 'AUTHENTICATION FAILED'
    ) {
      throw new Error('Authentication failed. Please check the username and password.');
    }

    // Check for non-OK status
    if (statusCode !== WebClient.HTTP_STATUS.OK) {
      if (this._isValidJsonString(responseBody)) {
        const result = JSON.parse(responseBody);

        // Handle various error response formats
        if (result.status === 'error' && result.message) {
          throw new Error(`API error: ${result.message}`);
        }

        if (result.status === 'fail') {
          if (result.data?.failreason) {
            throw new Error(`API failure: ${result.data.failreason}`);
          }

          if (result.data?.code === WebClient.HTTP_STATUS.UNAUTHORIZED) {
            throw new Error('Authentication failed. Please check the username and password.');
          }
        }
      }

      throw new Error(
        `HTTP request failed (status: ${statusCode}, response: ${responseBody})`,
      );
    }
  }

  /**
   * Converts an object to a URL query string.
   * @private
   * @param {Object|null} obj - Object to convert
   * @returns {string} Query string (empty string if obj is null/empty)
   */
  _toQueryString(obj) {
    if (obj === null || typeof obj === 'undefined' || Object.keys(obj).length === 0) {
      return '';
    }

    const queryString = Object.keys(obj)
      .map((key) => `${key}=${encodeURIComponent(obj[key])}`)
      .join('&');

    return `?${queryString}`;
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

module.exports = WebClient;
