'use strict';

const Homey = require('homey');
const WebClient = require('../../lib/web-client');
const NRGWatchApi = require('../../lib/nrgwatch-api');

/** Firmware remote type name -> rfDeviceType setting value */
const RF_TYPE_MAP = {
  'RFT CVE': 'rft-cve',
  'RFT Auto': 'rft-auto',
  'RFT-N': 'rft-n',
  'RFT Auto-N': 'rft-auto-n',
  'RFT DF/QF': 'rft-df-qf',
  'RFT RV': 'rft-rv',
  'RFT CO2': 'rft-co2',
  'RFT PIR': 'rft-pir',
  'RFT Spider': 'rft-spider',
};

module.exports = class IthoWTWWifiDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.devices = [];
    this.results = [];
    this.webClient = new WebClient();
    this.log('IthoWTWWifiDriver has been initialized');
  }

  async onPair(session) {
    const discoveryStrategy = this.homey.discovery.getStrategy('itho-wtw-wifi');
    const discoveryResults = discoveryStrategy.getDiscoveryResults();

    this.log('searching for itho-wtw-wifi');

    session.setHandler('showView', async (view) => {
      this.log('currentView:', { view });

      if (view === 'loading') {
        this.log(Object.values(discoveryResults));
        if (Object.values(discoveryResults).length) {
          this.results = Object.values(discoveryResults);

          await session.showView('get_data');
        } else {
          await session.showView('set_ip');
        }
      }

      if (view === 'get_data') {
        this.deviceArray = this.getDeviceArray();
        this.devices = await this.waitForResults(this);

        await session.showView('set_settings');
      }
    });

    session.setHandler('set_ip', async (data) => {
      this.log('set_ip', data);
      this.results = [
        {
          address: data.ip,
          name: data.name,
        },
      ];

      await session.showView('get_data');
      return true;
    });

    session.setHandler('set_settings', async (data) => {
      this.log('set_settings', data);

      this.deviceArray = this.getDeviceArray(data.username ? data.username : null, data.password ? data.password : null);
      this.devices = await this.waitForResults(this);

      this.devices.forEach((r) => {
        r.settings = {
          host: r.settings.host,
          username: data.username || '',
          password: data.password || '',
          isAuthenticated: !!data.username,
          enableVirtualRemote: data.enableVirtualRemote || false,
          virtualRemoteType: data.virtualRemoteType || 'rft-auto',
          virtualRemoteIndex: data.virtualRemoteIndex || '0',
          rfDeviceType: data.rfDeviceType || 'rft-auto',
          refreshInterval: parseInt(data.refreshInterval, 10) || 15,
          rfDeviceIndex: data.rfDeviceIndex || '0',
        };

      });

      // Add one entry per SEND remote (e.g. HRU400 controlled via RF next to an I2C WPU)
      const rfDevices = [];
      for (const base of this.devices) {
        rfDevices.push(...await this.findRfDevices(base, data));
      }
      this.devices.push(...rfDevices);

      await session.showView('list_devices');
      return true;
    });

    session.setHandler('list_devices', async () => {
      try {
        this.homey.app.log('Found devices - ', this.devices);

        return this.devices;
      } catch (error) {
        this.homey.app.log(error);
        return Promise.reject(error);
      }
    });
  }

  /**
   * Builds device entries for every SEND remote configured on the module.
   * Status comes from /api/v2/rfstatus, commands go through that remote.
   * Failures (old firmware without /remotes) are non-fatal: no RF entries.
   * @param {Object} base - Base device entry (name, data, settings)
   * @param {Object} data - Pair form data (username, password, refreshInterval)
   * @returns {Promise<Array<Object>>} Device entries
   */
  async findRfDevices(base, data) {
    try {
      const api = new NRGWatchApi();
      api.setHomeyObject(this.homey);
      api.setSettings(base.settings.host, data.username || '', data.password || '', !!data.username, false, 0, true);

      const remotes = await api.getRemotes();
      const sendRemotes = remotes.filter((r) => r.remfuncname === 'send');
      if (!sendRemotes.length) return [];

      const sources = await api.getRfStatusSources().catch(() => []);

      return sendRemotes.map((remote) => {
        const source = this.matchRfSource(remote, sources);
        return {
          name: `${base.name} - ${remote.name || `RF ${remote.index}`}`,
          data: { id: `${base.data.id}-rf-${remote.index}` },
          store: { discoveryId: base.data.id },
          settings: {
            ...base.settings,
            useApiV2: true,
            enableVirtualRemote: false,
            statusSource: 'rfstatus',
            rfDeviceIndex: String(remote.index),
            rfDeviceType: RF_TYPE_MAP[remote.remtypename] || 'rft-auto',
            rfSourceId: source?.id || '',
            rfSourceName: source?.name || '',
          },
        };
      });
    } catch (error) {
      this.log('findRfDevices skipped:', error.message);
      return [];
    }
  }

  /**
   * Links a SEND remote to a tracked RF status source: by destination id
   * (the device the remote talks to), then by equal name.
   * @param {Object} remote - Remote from /api/v2/remotes
   * @param {Array<Object>} sources - Sources from /api/v2/rfstatus
   * @returns {Object|undefined} Matching source
   */
  matchRfSource(remote, sources) {
    if (Array.isArray(remote.destid) && remote.destid.length === 3) {
      const destId = remote.destid.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(':');
      const byId = sources.find((s) => s.id === destId);
      if (byId) return byId;
    }
    return sources.find((s) => s.name && s.name === remote.name);
  }

  getDeviceArray(usernaame = null, password = null) {
    const devicesFound = [];

    this.results.forEach((r) => {
      const ip = r.address;
      const host = r.name || r.host || r.address;
      this.log(`getDeviceArray - connecting to: ${host}`);
      this.webClient.testConnection(ip, usernaame, password)
        .then((data) => {
          this.log(`getDeviceArray - connected to: ${host}`);
          const device = {
            address: ip,
            name: host,
          };
          devicesFound.push(device);
        }).catch(this.error);
    });

    return devicesFound;
  }

  findDevices(ctx, deviceArray) {
    try {
      const devices = [];

      ctx.log('findDevices ', deviceArray);

      for (const device of deviceArray) {
        const ip = device.address;

        devices.push({
          name: device.name,
          data: {
            id: device.name,
          },
          settings: {
            host: ip,
          },
        });
      }

      return devices;
    } catch (error) {
      ctx.log(error);
      return [];
    }
  }

  async waitForResults(ctx, retry = 10) {
    for (let i = 1; i <= retry; i++) {
      ctx.log(`findDevices - try: ${i}`);
      await this.sleep(1000);

      if (ctx.deviceArray.length && i > 5) {
        const devices = ctx.findDevices(ctx, ctx.deviceArray);
        return Promise.resolve(devices);
      } if (i === 10) {
        return Promise.resolve([]);
      }
    }

    return Promise.resolve([]);
  }

  async sleep(ms) {
    return new Promise((resolve) => {
      this.homey.setTimeout(resolve, ms);
    });
  }
};
