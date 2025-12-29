const BaseClient = require('./base-class');
const WebClient = require('./web-client');
const NRGWatchWebSocket = require('./web-socket');

class NRGWatchApi extends BaseClient {
  constructor(...props) {
    super(...props);
    this.webclient = new WebClient();
    this.websocket = new NRGWatchWebSocket();
  }

  setSettings(host, username, password, isAuthenticated, enableVirtualRemote, virtualRemoteIndex) {
    this.webclient._serverHost = host;
    this.webclient._userName = username;
    this.webclient._passWord = password;
    this.webclient._isAuthenticated = isAuthenticated;
    this.webclient._enableVirtualRemote = enableVirtualRemote;
    this.webclient._virtualRemoteIndex = virtualRemoteIndex ?? 0;
  }

  setHomeyObject(homey) {
    this.homey = homey;
    this.webclient.setHomeyObject(homey);
    this.websocket.setHomeyObject(homey);
  }

  async getStatus() {
    return new Promise((resolve, reject) => {
      this.webclient.get('api.html', { 'get': 'ithostatus' })
        .then(response => {
          let result = JSON.parse(response);

          if (result.data) {
            return resolve(result.data.ithostatus);
          } else if (result) {
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining ithostatus.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  async getCurrentSpeed() {
    return new Promise((resolve, reject) => {
      this.webclient.get('api.html', { 'get': 'currentspeed' })
        .then(response => {
          let result = JSON.parse(response);

          if (result.data) {
            return resolve(result.data.currentspeed);
          } else if (result) {
            return resolve(result);
          } else {
            return reject(new Error('Error obtaining currentspeed.'));
          }
        })
        .catch(error => reject(error));
    });
  }

  async setFanMode(mode, useRFRemote = false) {
    return new Promise((resolve, reject) => {
      let command = {
        command: mode
      };
      if (useRFRemote) {
        command = {
          rfremotecmd: mode
        };
      }
      if (this.webclient._enableVirtualRemote === true) {
        command = {
          vremoteindex: this.webclient._virtualRemoteIndex,
          vremotecmd: mode
        };
      }
      this.homey.log(`Setting fan mode to ${JSON.stringify(command)}`);
      this.webclient.get('api.html', command)
        .then(response => {
            if (response === 'OK') {
              return resolve(true);
            } else if (this.isValidJsonString(response)) {
              let result = JSON.parse(response);
              if (result.status && result.status === 'success') {
                return resolve(true);
              }
            }
            return reject(new Error('Error setting fan mode.'));
          }
        )
        .catch(error => reject(error));
    });
  }

  async setFanSpeed(speed) {
    return new Promise((resolve, reject) => {
      let command = {
        speed: speed
      };
      if (this.webclient._enableVirtualRemote === true) {
        command = {
          speed: speed
        };
      }
      this.homey.log(`Setting fan speed to ${JSON.stringify(command)}`);
      this.webclient.get('api.html', command)
        .then(response => {
          if (response === 'OK') {
            return resolve(true);
          } else if (this.isValidJsonString(response)) {
            let result = JSON.parse(response);
            if (result.status && result.status === 'success') {
              return resolve(true);
            }
          }
          return reject(new Error('Error setting fan speed.'));
        })
        .catch(error => reject(error));
    });
  }

  async setRFFanMode(mode) {
    return new Promise((resolve, reject) => {
      let command = {
        rfremoteindex: this.webclient._virtualRemoteIndex,
        rfremotecmd: mode
        };
      this.homey.log(`Setting fan mode to ${JSON.stringify(command)}`);
      this.webclient.get('api.html', command)
        .then(response => {
            if (response === 'OK') {
              return resolve(true);
            } else if (this.isValidJsonString(response)) {
              let result = JSON.parse(response);
              if (result.status && result.status === 'success') {
                return resolve(true);
              }
            }
            return reject(new Error('Error setting fan mode.'));
          }
        )
        .catch(error => reject(error));
    });
  }

  isValidJsonString(str) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }
}

module.exports = NRGWatchApi;
