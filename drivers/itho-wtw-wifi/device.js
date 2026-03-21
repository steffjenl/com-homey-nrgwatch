'use strict';

const Homey = require('homey');
const NRGWatchApi = require('../../lib/nrgwatch-api');
const VirtualRemoteModus = require('../../lib/virtual-remote-modus');

/** Number of consecutive poll failures before marking device unavailable */
const FAILURE_THRESHOLD = 3;

module.exports = class IthoWTWWifi extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.api = new NRGWatchApi();
    this.api.setHomeyObject(this.homey);
    this.settings = this.getSettings();
    this.api.setSettings(
      this.settings.host,
      this.settings.username,
      this.settings.password,
      this.settings.isAuthenticated,
      false,
      this.settings.rfDeviceIndex,
    );

    // Availability tracking
    this._failureCount = 0;
    this._wasUnavailable = false;

    // Register flow card triggers
    this._triggerFanModeChanged = this.homey.flow.getDeviceTriggerCard('fan_mode_changed');
    this._triggerDeviceOffline = this.homey.flow.getDeviceTriggerCard('device_offline');
    this._triggerDeviceOnline = this.homey.flow.getDeviceTriggerCard('device_online');
    this._triggerTemperatureChanged = this.homey.flow.getDeviceTriggerCard('temperature_changed');
    this._triggerHumidityChanged = this.homey.flow.getDeviceTriggerCard('humidity_changed');

    // Register flow card action
    this.homey.flow.getActionCard('set_fan_mode')
      .registerRunListener(async (args) => {
        const mode = args.mode.id || args.mode;
        await this.api.setFanMode(mode, true);
        await this.setCapabilityValue('fan_mode', mode);
        await this.setCapabilityValue('measure_string.last_command_source', 'HTMLAPI').catch(() => {});
        return true;
      })
      .registerArgumentAutocompleteListener('mode', async (query) => {
        const options = this.getCapabilityOptions('fan_mode');
        const lang = this.homey.i18n.getLanguage();
        return (options.values || [])
          .filter((v) => (v.title?.[lang] || v.title?.en || v.id).toLowerCase().includes(query.toLowerCase()))
          .map((v) => ({ id: v.id, name: v.title?.[lang] || v.title?.en || v.id }));
      });

    // Capability listeners
    this.registerCapabilityListener('fan_mode', async (value) => {
      this.log('Setting fan_mode to', value);
      await this.api.setFanMode(value, true);
      await this.setCapabilityValue('measure_string.last_command_source', 'HTMLAPI').catch(() => {});
    });

    // Add / remove capabilities based on settings (before first poll)
    await this.createAndRemoveCapabilities();

    // Initial status update — never throw to prevent failed init
    await this.updateStatus().catch((err) => this.log('Initial poll failed (device may be offline):', err.message));

    // Start polling
    this.pollingInterval = this.homey.setInterval(() => {
      this.updateStatus().catch((err) => this.log('Poll error:', err.message));
    }, (this.settings.refreshInterval ?? 15) * 1000);

    this.log('IthoWTWWifi has been initialized');
  }

  async createAndRemoveCapabilities() {
    const caps = [
      'fan_mode',
      'measure_temperature.indoor',
      'measure_temperature.outdoor',
      'measure_humidity',
      'measure_speed.speed_status',
      'measure_speed.fan_speed',
      'measure_speed.fan_setpoint',
      'measure_speed.ventilation_setpoint',
      'measure_number.startup_counter',
      'measure_number.total_operating_hours',
      'measure_string.last_command_source',
    ];

    for (const cap of caps) {
      if (!this.hasCapability(cap)) {
        await this.addCapability(cap);
        this.log('Added capability', cap);
      }
    }

    await this.setFanModeOptions();
  }

  async setFanModeOptions() {
    const options = this.getCapabilityOptions('fan_mode');
    const type = this.settings.rfDeviceType;

    if (type === 'rft-cve') {
      options.values = [VirtualRemoteModus.AWAY, VirtualRemoteModus.LOW, VirtualRemoteModus.MEDIUM, VirtualRemoteModus.HIGH, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    } else if (type === 'rft-auto') {
      options.values = [VirtualRemoteModus.AUTO, VirtualRemoteModus.AUTONIGHT, VirtualRemoteModus.LOW, VirtualRemoteModus.HIGH, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    } else if (type === 'rft-n') {
      options.values = [VirtualRemoteModus.AWAY, VirtualRemoteModus.LOW, VirtualRemoteModus.MEDIUM, VirtualRemoteModus.HIGH, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    } else if (type === 'rft-auto-n') {
      options.values = [VirtualRemoteModus.AUTO, VirtualRemoteModus.AUTONIGHT, VirtualRemoteModus.LOW, VirtualRemoteModus.HIGH, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    } else if (type === 'rft-df-qf') {
      options.values = [VirtualRemoteModus.LOW, VirtualRemoteModus.HIGH, VirtualRemoteModus.COOK30, VirtualRemoteModus.COOK60, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    } else if (type === 'rft-rv') {
      options.values = [VirtualRemoteModus.AUTO, VirtualRemoteModus.AUTONIGHT, VirtualRemoteModus.LOW, VirtualRemoteModus.MEDIUM, VirtualRemoteModus.HIGH, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    } else if (type === 'rft-co2') {
      options.values = [VirtualRemoteModus.AUTO, VirtualRemoteModus.AUTONIGHT, VirtualRemoteModus.LOW, VirtualRemoteModus.MEDIUM, VirtualRemoteModus.HIGH, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    } else if (type === 'rft-pir') {
      options.values = [VirtualRemoteModus.MOTION_ON, VirtualRemoteModus.MOTION_OFF];
    } else if (type === 'rft-spider') {
      options.values = [VirtualRemoteModus.AUTO, VirtualRemoteModus.AUTONIGHT, VirtualRemoteModus.LOW, VirtualRemoteModus.MEDIUM, VirtualRemoteModus.HIGH, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    } else {
      options.values = [VirtualRemoteModus.LOW, VirtualRemoteModus.MEDIUM, VirtualRemoteModus.HIGH, VirtualRemoteModus.TIMER1, VirtualRemoteModus.TIMER2, VirtualRemoteModus.TIMER3];
    }

    await this.setCapabilityOptions('fan_mode', options);
  }

  async updateStatus() {
    try {
      const status = await this.api.getStatus();

      this.log('Fetched IthoWTWWifi status');

      // --- Recover from offline state ---
      if (this._wasUnavailable) {
        this._wasUnavailable = false;
        await this.setAvailable();
        await this._triggerDeviceOnline.trigger(this).catch(this.error);
        this.log('IthoWTWWifi is back online');
      }
      this._failureCount = 0;

      // --- Previous values for change triggers ---
      const prev = {
        tempIndoor: this.getCapabilityValue('measure_temperature.indoor'),
        tempOutdoor: this.getCapabilityValue('measure_temperature.outdoor'),
        humidity: this.getCapabilityValue('measure_humidity'),
      };

      // --- Indoor temperature ---
      // Format A: 'Indoor temperature (°C)' / 'Temp indoor (°C)'
      // Format B: 'indoor-temp' / 'temp-indoor'
      // Fallback:  generic 'temp' field
      const tempIndoor = status['Indoor temperature (°C)']
        ?? status['Temp indoor (°C)']
        ?? status['indoor-temp']
        ?? status['temp-indoor']
        ?? status['supply-temp']
        ?? status['Supply temperature (°C)']
        ?? status.temp;

      // --- Outdoor temperature ---
      const tempOutdoor = status['Outdoor temperature (°C)']
        ?? status['Temp outdoor (°C)']
        ?? status['outdoor-temp']
        ?? status['temp-outdoor']
        ?? status['exhaust-temp']
        ?? status['Exhaust temperature (°C)'];

      if (tempIndoor != null) await this.setCapabilityValue('measure_temperature.indoor', tempIndoor).catch(this.error);
      if (tempOutdoor != null) await this.setCapabilityValue('measure_temperature.outdoor', tempOutdoor).catch(this.error);

      await this.setCapabilityValue('measure_humidity', status.hum).catch(this.error);
      await this.setCapabilityValue('measure_speed.speed_status', status['Speed status'] ?? status['speed-status'] ?? -1).catch(this.error);
      await this.setCapabilityValue('measure_speed.fan_speed', status['Fan speed (rpm)'] ?? status['fan-speed_rpm']).catch(this.error);
      await this.setCapabilityValue('measure_speed.fan_setpoint', status['Fan setpoint (rpm)'] ?? status['fan-setpoint_rpm']).catch(this.error);
      await this.setCapabilityValue('measure_speed.ventilation_setpoint', status['Ventilation setpoint (%)'] ?? status['ventilation-setpoint_perc']).catch(this.error);
      await this.setCapabilityValue('measure_number.startup_counter', status['Startup counter'] ?? status['startup-counter'] ?? -1).catch(this.error);
      await this.setCapabilityValue('measure_number.total_operating_hours', status['Total operation (hours)'] ?? status['total-operation_hours'] ?? -1).catch(this.error);

      // --- fan_mode from Status field ---
      const sel = status.Status ?? status.status ?? status.Selection ?? status.selection;
      let newMode = null;
      if (sel === 1) newMode = 'away';
      else if (sel === 2) newMode = 'low';
      else if (sel === 3) newMode = 'medium';
      else if (sel === 4) newMode = 'high';
      else if (sel === 5) newMode = 'timer1';
      else if (sel === 6) newMode = 'autonight';
      else if (sel === 7) newMode = 'auto';

      const prevMode = this.getCapabilityValue('fan_mode');
      if (newMode && newMode !== prevMode) {
        await this.setCapabilityValue('fan_mode', newMode);
        await this._triggerFanModeChanged.trigger(this, { mode: newMode }).catch(this.error);
      }

      // --- Flow triggers for sensor changes ---
      if (tempIndoor != null && tempIndoor !== prev.tempIndoor) {
        await this._triggerTemperatureChanged.trigger(this, { temperature: tempIndoor }).catch(this.error);
      }
      if (status.hum != null && status.hum !== prev.humidity) {
        await this._triggerHumidityChanged.trigger(this, { humidity: status.hum }).catch(this.error);
      }

    } catch (error) {
      this._failureCount = (this._failureCount || 0) + 1;
      this.log(`Poll failed (${this._failureCount}/${FAILURE_THRESHOLD}):`, error.message);

      if (this._failureCount >= FAILURE_THRESHOLD && !this._wasUnavailable) {
        this._wasUnavailable = true;
        await this.setUnavailable(this.homey.__('errors.device_unreachable') || error.message);
        await this._triggerDeviceOffline.trigger(this).catch(this.error);
        this.log('IthoWTWWifi marked as unavailable');
      }
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
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.settings = newSettings;
    this.api.setSettings(
      newSettings.host,
      newSettings.username,
      newSettings.password,
      newSettings.isAuthenticated,
      false,
      newSettings.rfDeviceIndex,
    );

    await this.createAndRemoveCapabilities();

    // Reset failure state on settings change (new host may be reachable)
    this._failureCount = 0;
    this._wasUnavailable = false;
    await this.setAvailable();

    await this.updateStatus().catch((err) => this.log('Poll after settings change failed:', err.message));

    this.homey.clearInterval(this.pollingInterval);
    this.pollingInterval = this.homey.setInterval(() => {
      this.updateStatus().catch((err) => this.log('Poll error:', err.message));
    }, (newSettings.refreshInterval ?? 15) * 1000);

    this.log('IthoWTWWifi settings were changed');
  }

  async onRenamed(name) {
    this.log('IthoWTWWifi was renamed');
  }

  async onDeleted() {
    this.homey.clearInterval(this.pollingInterval);
    this.log('IthoWTWWifi has been deleted');
  }

  onDiscoveryResult(discoveryResult) {
    return discoveryResult.id === this.getData().id;
  }

  async onDiscoveryAvailable(discoveryResult) {
    // First discovery — no action needed
  }

  onDiscoveryAddressChanged(discoveryResult) {
    const settings = this.getSettings();
    this.setSettings({ host: discoveryResult.address }).catch(this.error);
    this.api.setSettings(
      discoveryResult.address,
      settings.username,
      settings.password,
      settings.isAuthenticated,
      false,
      settings.rfDeviceIndex,
    );
  }

  onDiscoveryLastSeenChanged(discoveryResult) {
    // Reconnect logic can be added here if needed
  }

};
