'use strict';

const Homey = require('homey');
const NRGWatchApi = require('../../lib/nrgwatch-api');
const RateTracker = require('../../lib/rate-tracker');

/** Number of consecutive poll failures before marking device unavailable */
const FAILURE_THRESHOLD = 3;

module.exports = class IthoWpuWifi extends Homey.Device {

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
      0,
      this.settings.useApiV2 ?? false,
    );

    // Availability tracking
    this._failureCount = 0;
    this._wasUnavailable = false;

    // Rate-of-change tracking for "changed rapidly" triggers
    this._rateTracker = new RateTracker();

    // Register flow card triggers
    this._triggerDeviceOffline = this.homey.flow.getDeviceTriggerCard('wpu_device_offline');
    this._triggerDeviceOnline = this.homey.flow.getDeviceTriggerCard('wpu_device_online');
    this._triggerTemperatureChanged = this.homey.flow.getDeviceTriggerCard('wpu_temperature_changed');
    this._triggerTemperatureChangedRapidly = this.homey.flow.getDeviceTriggerCard('wpu_temperature_changed_rapidly');
    this._triggerErrorChanged = this.homey.flow.getDeviceTriggerCard('wpu_error_changed');
    this._triggerFirmwareUpdateAvailable = this.homey.flow.getDeviceTriggerCard('wpu_firmware_update_available');

    // Rate-of-change trigger: run listener filters based on the configured minimum rate arg
    this._triggerTemperatureChangedRapidly.registerRunListener((args, state) => Math.abs(state.rate) >= args.rate);

    // Register flow card action
    this.homey.flow.getActionCard('wpu_set_outside_temp')
      .registerRunListener(async (args) => {
        await this.api.setOutsideTemp(args.temperature);
        await this._updateLastCommandSource();
        return true;
      });

    // Add / remove capabilities (before first poll)
    await this.createAndRemoveCapabilities();

    // Auto-detect API v2 support when not yet enabled
    if (!this.settings.useApiV2) {
      const detected = await this.api.detectApiVersion().catch(() => false);
      if (detected) {
        this.settings.useApiV2 = true;
        await this.setSettings({ useApiV2: true });
        this.api.setSettings(
          this.settings.host,
          this.settings.username,
          this.settings.password,
          this.settings.isAuthenticated,
          false,
          0,
          true,
        );
        this.log('REST API v2 auto-detected and enabled');
      }
    }

    // Start WebSocket for real-time updates
    this.api.websocket.setHomeyObject(this.homey);
    this.api.websocket.setMessageHandler((data) => this._handleWebSocketMessage(data));
    this.api.websocket.connect();

    // Initial status update — never throw to prevent failed init
    await this.updateStatus().catch((err) => this.log('Initial poll failed (device may be offline):', err.message));

    // Start polling
    this.pollingInterval = this.homey.setInterval(() => {
      this.updateStatus().catch((err) => this.log('Poll error:', err.message));
    }, (this.settings.refreshInterval ?? 15) * 1000);

    // Firmware / OTA info: once at init (fire-and-forget so an offline
    // device doesn't block onInit), then hourly
    this._updateFirmwareInfo().catch(this.error);
    this.otaPollingInterval = this.homey.setInterval(() => {
      this._updateFirmwareInfo().catch(this.error);
    }, 60 * 60 * 1000);

    this.log('IthoWpuWifi has been initialized');
  }

  async createAndRemoveCapabilities() {
    const caps = [
      'measure_temperature.outside',
      'measure_temperature.boiler_up',
      'measure_temperature.boiler_down',
      'measure_temperature.cv_supply',
      'measure_temperature.cv_return',
      'measure_temperature.to_source',
      'measure_temperature.from_source',
      'measure_temperature.room',
      'measure_temperature.requested_room',
      'measure_number.cv_pressure',
      'measure_number.cv_pump',
      'measure_number.well_pump',
      'measure_number.boiler_pump',
      'measure_number.heat_demand',
      'measure_number.flow_sensor',
      'measure_number.compressor_current',
      'measure_number.status_code',
      'measure_number.sub_status_code',
      'measure_number.error_code',
      'measure_string.last_command_source',
      'measure_string.firmware_version',
    ];

    for (const cap of caps) {
      if (!this.hasCapability(cap)) {
        await this.addCapability(cap);
        this.log('Added capability', cap);
      }
    }
  }

  async updateStatus() {
    try {
      const rawStatus = await this.api.getStatus();
      const status = this._normalizeStatus(rawStatus);

      this.log('Fetched IthoWpuWifi status');

      // --- Recover from offline state ---
      if (this._wasUnavailable) {
        this._wasUnavailable = false;
        await this.setAvailable();
        await this._triggerDeviceOnline.trigger(this).catch(this.error);
        this.log('IthoWpuWifi is back online');
      }
      this._failureCount = 0;

      await this._applyStatus(status);

    } catch (error) {
      this._failureCount = (this._failureCount || 0) + 1;
      this.log(`Poll failed (${this._failureCount}/${FAILURE_THRESHOLD}):`, error.message);

      if (this._failureCount >= FAILURE_THRESHOLD && !this._wasUnavailable) {
        this._wasUnavailable = true;
        await this.setUnavailable(this.homey.__('errors.device_unreachable') || error.message);
        await this._triggerDeviceOffline.trigger(this).catch(this.error);
        this.log('IthoWpuWifi marked as unavailable');
      }
    }
  }

  /**
   * Feeds a new sample into the rate tracker and fires the given
   * "changed rapidly" trigger card if a rate could be computed. Called on
   * every sample (poll AND WebSocket), independent of whether the plain
   * "changed" trigger fired, so slow drift across many small samples still
   * yields an accurate per-minute rate.
   */
  async _checkRapidChange(metric, value, tokenName, triggerCard, decimals = 1) {
    if (value == null) return;
    const rate = this._rateTracker.update(metric, value);
    if (rate == null) return;
    const factor = 10 ** decimals;
    const roundedRate = Math.round(rate * factor) / factor;
    await triggerCard.trigger(this, { [tokenName]: value, rate: roundedRate }, { rate: roundedRate }).catch(this.error);
  }

  /**
   * Writes a normalized status object to the capabilities and fires change triggers.
   * All fields are optional; missing values are skipped.
   * @private
   */
  async _applyStatus(status) {
    const prev = {
      roomTemp: this.getCapabilityValue('measure_temperature.room'),
      errorCode: this.getCapabilityValue('measure_number.error_code'),
    };

    if (status.outsideTemp != null) await this.setCapabilityValue('measure_temperature.outside', status.outsideTemp).catch(this.error);
    if (status.boilerTempUp != null) await this.setCapabilityValue('measure_temperature.boiler_up', status.boilerTempUp).catch(this.error);
    if (status.boilerTempDown != null) await this.setCapabilityValue('measure_temperature.boiler_down', status.boilerTempDown).catch(this.error);
    if (status.cvSupplyTemp != null) await this.setCapabilityValue('measure_temperature.cv_supply', status.cvSupplyTemp).catch(this.error);
    if (status.cvReturnTemp != null) await this.setCapabilityValue('measure_temperature.cv_return', status.cvReturnTemp).catch(this.error);
    if (status.tempToSource != null) await this.setCapabilityValue('measure_temperature.to_source', status.tempToSource).catch(this.error);
    if (status.tempFromSource != null) await this.setCapabilityValue('measure_temperature.from_source', status.tempFromSource).catch(this.error);
    if (status.roomTemp != null) await this.setCapabilityValue('measure_temperature.room', status.roomTemp).catch(this.error);
    if (status.requestedRoomTemp != null) await this.setCapabilityValue('measure_temperature.requested_room', status.requestedRoomTemp).catch(this.error);
    if (status.cvPressure != null) await this.setCapabilityValue('measure_number.cv_pressure', status.cvPressure).catch(this.error);
    if (status.cvPump != null) await this.setCapabilityValue('measure_number.cv_pump', status.cvPump).catch(this.error);
    if (status.wellPump != null) await this.setCapabilityValue('measure_number.well_pump', status.wellPump).catch(this.error);
    if (status.boilerPump != null) await this.setCapabilityValue('measure_number.boiler_pump', status.boilerPump).catch(this.error);
    if (status.heatDemand != null) await this.setCapabilityValue('measure_number.heat_demand', status.heatDemand).catch(this.error);
    if (status.flowSensor != null) await this.setCapabilityValue('measure_number.flow_sensor', status.flowSensor).catch(this.error);
    if (status.compressorCurrent != null) await this.setCapabilityValue('measure_number.compressor_current', status.compressorCurrent).catch(this.error);
    if (status.statusCode != null) await this.setCapabilityValue('measure_number.status_code', status.statusCode).catch(this.error);
    if (status.subStatusCode != null) await this.setCapabilityValue('measure_number.sub_status_code', status.subStatusCode).catch(this.error);
    if (status.errorCode != null) await this.setCapabilityValue('measure_number.error_code', status.errorCode).catch(this.error);

    // --- Flow triggers ---
    if (status.roomTemp != null && status.roomTemp !== prev.roomTemp) {
      await this._triggerTemperatureChanged.trigger(this, { temperature: status.roomTemp }).catch(this.error);
    }
    if (status.errorCode != null && status.errorCode !== prev.errorCode) {
      await this._triggerErrorChanged.trigger(this, { error_code: status.errorCode }).catch(this.error);
    }
    await this._checkRapidChange('temperature', status.roomTemp, 'temperature', this._triggerTemperatureChangedRapidly, 2);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('IthoWpuWifi has been added');
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
      0,
      newSettings.useApiV2 ?? false,
    );

    await this.createAndRemoveCapabilities();

    // Reset failure state on settings change (new host may be reachable)
    this._failureCount = 0;
    this._wasUnavailable = false;
    await this.setAvailable();

    // Reconnect WebSocket to new host
    await this.api.websocket.disconnect();
    this.api.websocket.connect();

    await this.updateStatus().catch((err) => this.log('Poll after settings change failed:', err.message));

    this.homey.clearInterval(this.pollingInterval);
    this.pollingInterval = this.homey.setInterval(() => {
      this.updateStatus().catch((err) => this.log('Poll error:', err.message));
    }, (newSettings.refreshInterval ?? 15) * 1000);

    this.log('IthoWpuWifi settings were changed');
  }

  async onRenamed(name) {
    this.log('IthoWpuWifi was renamed');
  }

  async onDeleted() {
    this.homey.clearInterval(this.pollingInterval);
    this.homey.clearInterval(this.otaPollingInterval);
    await this.api.websocket.disconnect();
    this.log('IthoWpuWifi has been deleted');
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
      0,
      settings.useApiV2 ?? false,
    );
  }

  onDiscoveryLastSeenChanged(discoveryResult) {
    // Reconnect logic can be added here if needed
  }

  /**
   * Handles incoming WebSocket messages from the WPU firmware.
   *
   * {"ithostatusinfo": {all device fields...}} — on demand
   */
  async _handleWebSocketMessage(data) {
    try {
      if (data.ithostatusinfo) {
        const status = this._normalizeStatus(data.ithostatusinfo);
        await this._applyStatus(status);
      }
    } catch (err) {
      this.log('WS message handling error:', err.message);
    }
  }

  /**
   * Fetches firmware/OTA info (v2 only), updates the firmware_version capability
   * and fires the firmware-update-available trigger once per new latest version.
   * @private
   */
  async _updateFirmwareInfo() {
    if (!this.settings.useApiV2) return;

    try {
      const ota = await this.api.getOtaInfo();

      if (ota?.installed_version && this.hasCapability('measure_string.firmware_version')) {
        await this.setCapabilityValue('measure_string.firmware_version', ota.installed_version).catch(() => {});
      }

      if (ota?.fw_update_available && ota.latest_fw && ota.latest_fw !== this.getStoreValue('notifiedFw')) {
        await this._triggerFirmwareUpdateAvailable.trigger(this, {
          installed_version: ota.installed_version ?? '',
          latest_version: ota.latest_fw,
        }).catch(this.error);
        await this.setStoreValue('notifiedFw', ota.latest_fw);
      }
    } catch (err) {
      this.log('Firmware info poll failed:', err.message);
    }
  }

  /** Fetches last command from device and updates last_command_source capability. */
  async _updateLastCommandSource() {
    try {
      const lastCmd = await this.api.getLastCommand();
      if (lastCmd?.source) {
        await this.setCapabilityValue('measure_string.last_command_source', lastCmd.source).catch(() => {});
      }
    } catch (_) { /* non-fatal */ }
  }

  _toNumber(value) {
    if (value == null || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  _first(status, keys) {
    for (const key of keys) {
      if (status[key] != null) return status[key];
    }
    return null;
  }

  /**
   * Maps the WPU ithostatus payload to a normalized object.
   * Label names taken from the ithowifi firmware (main/ithodevice/devices/wpu.h).
   * @private
   */
  _normalizeStatus(rawStatus) {
    const status = rawStatus?.ithostatus && typeof rawStatus.ithostatus === 'object'
      ? rawStatus.ithostatus
      : (rawStatus || {});

    const first = (keys) => this._first(status, keys);

    return {
      outsideTemp: this._toNumber(first(['Outside temp (°C)', 'Outside temp (C)', 'outside-temp'])),
      boilerTempUp: this._toNumber(first(['Boiler temp up (°C)', 'Boiler temp up (C)', 'boiler-temp-up'])),
      boilerTempDown: this._toNumber(first(['Boiler temp down (°C)', 'Boiler temp down (C)', 'boiler-temp-down'])),
      cvSupplyTemp: this._toNumber(first(['CV supply temp (°C)', 'CV supply temp (C)', 'cv-supply-temp'])),
      cvReturnTemp: this._toNumber(first(['CV return temp (°C)', 'CV return temp (C)', 'cv-return-temp'])),
      tempToSource: this._toNumber(first(['Temp to source (°C)', 'Temp to source (C)', 'temp-to-source'])),
      tempFromSource: this._toNumber(first(['Temp from source (°C)', 'Temp from source (C)', 'temp-from-source'])),
      roomTemp: this._toNumber(first(['Room temp (°C)', 'Room temp (C)', 'room-temp'])),
      requestedRoomTemp: this._toNumber(first(['Requested room temp (°C)', 'Requested room temp (C)', 'requested-room-temp'])),
      cvPressure: this._toNumber(first(['CV pressure (Bar)', 'cv-pressure_bar'])),
      cvPump: this._toNumber(first(['Cv pump (%)', 'cv-pump_perc'])),
      wellPump: this._toNumber(first(['Well pump (%)', 'well-pump_perc'])),
      boilerPump: this._toNumber(first(['Boiler pump (%)', 'boiler-pump_perc'])),
      heatDemand: this._toNumber(first(['Heat demand thermost. (%)', 'heat-demand-thermost_perc'])),
      flowSensor: this._toNumber(first(['Flow sensor (lt_hr)', 'flow-sensor_lt-hr'])),
      compressorCurrent: this._toNumber(first(['Compressor current (A)', 'compressor-current_a'])),
      statusCode: this._toNumber(first(['Status', 'status'])),
      subStatusCode: this._toNumber(first(['Sub_status', 'sub-status'])),
      errorCode: this._toNumber(first(['Error', 'error', 'Fault highest priority', 'fault-highest-priority'])),
    };
  }

};
