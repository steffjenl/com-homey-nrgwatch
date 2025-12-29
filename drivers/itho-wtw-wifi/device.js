'use strict';

const Homey = require('homey');
const NRGWatchApi = require('../../lib/nrgwatch-api');
const VirtualRemoteModus = require('../../lib/virtual-remote-modus');

module.exports = class IthoWTWWifi extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.api = new NRGWatchApi();
    this.api.setHomeyObject(this.homey);
    this.settings = this.getSettings();
    this.api.setSettings(this.settings.host, this.settings.username, this.settings.password, this.settings.isAuthenticated, false, this.settings.rfDeviceIndex);

    // Initial status update
    await this.updateStatus().catch(this.error);

    // Update status every 10 minutes
    this.pollingInterval = this.homey.setInterval(() => {
      this.updateStatus();
    }, (this.settings.refreshInterval ?? 15) * 1000);

    this.registerCapabilityListener('fan_mode', async (value) => {
      this.log('Setting fan_mode to', value);
      await this.setCapabilityValue('fan_mode', value);
      return this.api.setFanMode(value, true);
    });

    await this.createAndRemoveCabapilities();

    this.log('IthoWTWWifi has been initialized');
  }

  async createAndRemoveCabapilities() {
    await this.setFanModeOptions();
  }

  async setFanModeOptions() {
    const options = this.getCapabilityOptions('fan_mode');
    if (this.settings.rfDeviceType === 'rft-cve') {
        options.values = [
          VirtualRemoteModus.AWAY,
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.MEDIUM,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
          ];
    } else if (this.settings.rfDeviceType === 'rft-auto') {
        options.values = [
          VirtualRemoteModus.AUTO,
          VirtualRemoteModus.AUTONIGHT,
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
          ];
    } else if (this.settings.rfDeviceType === 'rft-n') {
        options.values = [
          VirtualRemoteModus.AWAY,
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.MEDIUM,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
          ];
    } else if (this.settings.rfDeviceType === 'rft-auto-n') {
        options.values = [
          VirtualRemoteModus.AUTO,
          VirtualRemoteModus.AUTONIGHT,
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
          ];
    } else if (this.settings.rfDeviceType === 'rft-df-qf') {
        options.values = [
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.COOK30,
          VirtualRemoteModus.COOK60,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
          ];
    } else if (this.settings.rfDeviceType === 'rft-rv') {
        options.values = [
          VirtualRemoteModus.AUTO,
          VirtualRemoteModus.AUTONIGHT,
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.MEDIUM,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
          ];
    } else if (this.settings.rfDeviceType === 'rft-co2') {
        options.values = [
          VirtualRemoteModus.AUTO,
          VirtualRemoteModus.AUTONIGHT,
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.MEDIUM,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
          ];
    } else if (this.settings.rfDeviceType === 'rft-pir') {
        options.values = [
          VirtualRemoteModus.MOTION_ON,
          VirtualRemoteModus.MOTION_OFF
          ];
    } else if (this.settings.rfDeviceType === 'rft-spider') {
        options.values = [
          VirtualRemoteModus.AUTO,
          VirtualRemoteModus.AUTONIGHT,
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.MEDIUM,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
          ];
    } else {
        options.values = [
          VirtualRemoteModus.LOW,
          VirtualRemoteModus.MEDIUM,
          VirtualRemoteModus.HIGH,
          VirtualRemoteModus.TIMER1,
          VirtualRemoteModus.TIMER2,
          VirtualRemoteModus.TIMER3
        ];
    }

    await this.setCapabilityOptions('fan_mode', options);
  }

  async updateStatus() {
    try {
      const status = await this.api.getStatus().catch(this.error);
      // const currentSpeed = await this.api.getCurrentSpeed()
      //   .catch(this.error);
      // this.log('Fetched IthoWTWWifi status');
      // this.setCapabilityValue('fan_speed', parseInt(currentSpeed))
      //   .catch(this.error);
      // this.log(`Current speed: ${currentSpeed}`);
      // this.setCapabilityValue('measure_temperature', status.temp)
      //   .catch(this.error);
      // this.setCapabilityValue('measure_humidity', status.hum)
      //   .catch(this.error);
      // this.setCapabilityValue('measure_speed.speed_status', status['Speed status'] ?? status['speed-status'] ?? -1)
      //   .catch(this.error);
      // this.setCapabilityValue('measure_co2', status['CO2level (ppm)'] ?? status['Highest CO2 concentration (ppm)'] ?? status['co2level_ppm'] ?? status['highest-co2-concentration_ppm'])
      //   .catch(this.error);
      // this.setCapabilityValue('measure_speed.fan_speed', status['Fan setpoint (rpm)'] ?? status['fan-setpoint_rpm'])
      //   .catch(this.error);
      // this.setCapabilityValue('measure_speed.fan_setpoint', status['Fan speed (rpm)'] ?? status['fan-speed_rpm'])
      //   .catch(this.error);
      // this.setCapabilityValue('measure_speed.ventilation_setpoint', status['Ventilation setpoint (%)'] ?? status['ventilation-setpoint_perc'])
      //   .catch(this.error);
      // this.setCapabilityValue('measure_number.startup_counter', status['Startup counter'] ?? status['startup-counter'] ?? -1)
      //   .catch(this.error);
      // this.setCapabilityValue('measure_number.total_operating_hours', status['Total operation (hours)'] ?? status['total-operation_hours'] ?? -1)
      //   .catch(this.error);
      if (status.Status === 2 || status.status === 2) {
        await this.setCapabilityValue('fan_mode', 'low');
      } else if (status.Status === 3 || status.status === 3) {
        await this.setCapabilityValue('fan_mode', 'medium');
      } else if (status.Status === 4 || status.status === 4) {
        await this.setCapabilityValue('fan_mode', 'high');
      } else if (status.Status === 5 || status.status === 5) {
        await this.setCapabilityValue('fan_mode', 'timer1');
      } else if (status.Status === 7 || status.status === 7) {
        await this.setCapabilityValue('fan_mode', 'auto');
      } else {
        // Unknown mode, set to auto
      }

    } catch (error) {
      this.error('Error fetching IthoWTWWifi status:', error);
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('IthoWTWWifi has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys
  }) {
    this.api.setSettings(newSettings.host, newSettings.username, newSettings.password, newSettings.isAuthenticated, false, newSettings.rfDeviceIndex);

    await this.setFanModeOptions();

    // Initial status update
    await this.updateStatus();

    // Clear previous interval
    this.homey.clearInterval(this.pollingInterval);

    // Update status every 10 minutes
    this.pollingInterval = this.homey.setInterval(() => {
      this.updateStatus();
    }, (newSettings.refreshInterval ?? 15) * 1000);
    this.log('IthoWTWWifi settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('IthoWTWWifi was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.homey.clearInterval(this.pollingInterval);
    this.log('IthoWTWWifi has been deleted');
  }

  onDiscoveryResult(discoveryResult) {
    // Return a truthy value here if the discovery result matches your device.
    return discoveryResult.id === this.getData().id;
  }

  async onDiscoveryAvailable(discoveryResult) {
    // This method will be executed once when the device has been found (onDiscoveryResult returned true)
  }

  onDiscoveryAddressChanged(discoveryResult) {
    // Update your connection details here, reconnect when the device is offline
    const settings = this.getSettings();
    this.setSettings({ host: discoveryResult.address })
      .catch(this.error);
    this.api.setSettings(discoveryResult.address, settings.username, settings.password, settings.isAuthenticated, false, settings.rfDeviceIndex);
  }

  onDiscoveryLastSeenChanged(discoveryResult) {
    // When the device is offline, try to reconnect here
  }

};
