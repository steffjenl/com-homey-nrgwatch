'use strict';

const Homey = require('homey');
const NRGWatchApi = require('../../lib/nrgwatch-api');
const VirtualRemoteModus = require('../../lib/virtual-remote-modus');
const RateTracker = require('../../lib/rate-tracker');

/** Number of consecutive poll failures before marking device unavailable */
const FAILURE_THRESHOLD = 3;
const FAN_SPEED_PERCENT_MAX = 100;

function clampFanSpeedRatio(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(Math.max(numericValue, 0), 1);
}

function fanSpeedPercentageToRatio(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return clampFanSpeedRatio(numericValue / FAN_SPEED_PERCENT_MAX);
}

function fanSpeedRatioToPercentage(value) {
  return Math.round(clampFanSpeedRatio(value) * FAN_SPEED_PERCENT_MAX);
}

const MODE_MAP = {
  1: 'away',
  2: 'low',
  3: 'medium',
  4: 'high',
  5: 'timer1',
  6: 'autonight',
  7: 'auto',
};

module.exports = class IthoWTWWifi extends Homey.Device {

  _configureApi(settings, useApiV2 = settings.useApiV2 ?? false, host = settings.host) {
    const enableVirtualRemote = settings.enableVirtualRemote ?? false;
    const remoteIndex = enableVirtualRemote
      ? settings.virtualRemoteIndex ?? '0'
      : settings.rfDeviceIndex ?? '0';

    this.api.setSettings(
      host,
      settings.username,
      settings.password,
      settings.isAuthenticated,
      enableVirtualRemote,
      remoteIndex,
      useApiV2,
    );
  }

  async _setFanMode(mode) {
    await this.api.setFanMode(mode, !(this.settings.enableVirtualRemote ?? false));
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.api = new NRGWatchApi();
    this.api.setHomeyObject(this.homey);
    this.settings = this.getSettings();
    this._configureApi(this.settings);

    // Availability tracking
    this._failureCount = 0;
    this._wasUnavailable = false;

    // Rate-of-change tracking for "changed rapidly" triggers
    this._rateTracker = new RateTracker();

    // Register flow card triggers
    this._triggerFanModeChanged = this.homey.flow.getDeviceTriggerCard('wtw_fan_mode_changed');
    this._triggerDeviceOffline = this.homey.flow.getDeviceTriggerCard('wtw_device_offline');
    this._triggerDeviceOnline = this.homey.flow.getDeviceTriggerCard('wtw_device_online');
    this._triggerTemperatureChanged = this.homey.flow.getDeviceTriggerCard('wtw_temperature_changed');
    this._triggerHumidityChanged = this.homey.flow.getDeviceTriggerCard('wtw_humidity_changed');
    this._triggerTemperatureChangedRapidly = this.homey.flow.getDeviceTriggerCard('wtw_temperature_changed_rapidly');
    this._triggerHumidityChangedRapidly = this.homey.flow.getDeviceTriggerCard('wtw_humidity_changed_rapidly');
    this._triggerFirmwareUpdateAvailable = this.homey.flow.getDeviceTriggerCard('wtw_firmware_update_available');

    // Rate-of-change triggers: run listener filters based on the configured minimum rate arg
    this._triggerTemperatureChangedRapidly.registerRunListener((args, state) => Math.abs(state.rate) >= args.rate);
    this._triggerHumidityChangedRapidly.registerRunListener((args, state) => Math.abs(state.rate) >= args.rate);

    // Register flow card action
    this.homey.flow.getActionCard('wtw_set_fan_mode')
      .registerRunListener(async (args) => {
        const mode = args.mode.id || args.mode;
        await this._setFanMode(mode);
        await this.setCapabilityValue('fan_mode', mode);
        await this._updateLastCommandSource();
        return true;
      })
      .registerArgumentAutocompleteListener('mode', async (query) => {
        const options = this.getCapabilityOptions('fan_mode');
        const lang = this.homey.i18n.getLanguage();
        return (options.values || [])
          .filter((v) => (v.title?.[lang] || v.title?.en || v.id).toLowerCase().includes(query.toLowerCase()))
          .map((v) => ({ id: v.id, name: v.title?.[lang] || v.title?.en || v.id }));
      });

    this.homey.flow.getActionCard('wtw_set_fan_speed')
      .registerRunListener(async (args) => {
        const fanSpeedRatio = clampFanSpeedRatio(args.speed);
        await this.api.setFanSpeed(fanSpeedRatioToPercentage(fanSpeedRatio));
        await this.setCapabilityValue('fan_speed', fanSpeedRatio);
        await this.setCapabilityValue('measure_speed.fan_speed_percentage', fanSpeedRatioToPercentage(fanSpeedRatio));
        await this._updateLastCommandSource();
        return true;
      });

    // Capability listeners
    this.registerCapabilityListener('fan_mode', async (value) => {
      this.log('Setting fan_mode to', value);
      await this._setFanMode(value);
      await this._updateLastCommandSource();
    });

    this.registerCapabilityListener('fan_speed', async (value) => {
      this.log('Setting fan_speed to', value);
      await this.api.setFanSpeed(fanSpeedRatioToPercentage(value));
      await this.setCapabilityValue('measure_speed.fan_speed_percentage', fanSpeedRatioToPercentage(value));
      await this._updateLastCommandSource();
    });

    this.registerCapabilityListener('button.leave', async () => {
      this.log('Leaving virtual remote');
      await this._setFanMode('leave');
      await this._updateLastCommandSource();
    });

    this.registerCapabilityListener('button.join', async () => {
      this.log('Joining virtual remote');
      await this._setFanMode('join');
      await this._updateLastCommandSource();
    });

    // Add / remove capabilities based on settings (before first poll)
    await this.createAndRemoveCapabilities();

    // Auto-detect API v2 support when not yet enabled
    if (!this.settings.useApiV2) {
      const detected = await this.api.detectApiVersion().catch(() => false);
      if (detected) {
        this.settings.useApiV2 = true;
        await this.setSettings({ useApiV2: true });
        this._configureApi(this.settings, true);
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

    this.log('IthoWTWWifi has been initialized');
  }

  async createAndRemoveCapabilities() {
    // FanInfo
    const caps = [
      'fan_mode',
      'measure_temperature',
      'measure_humidity',
      'measure_temperature.indoor',
      'measure_temperature.outdoor',
      'measure_temperature.supply',
      'measure_temperature.exhaust',
      'measure_speed.speed_status',
      'measure_speed.fan_speed',
      'measure_speed.fan_speed_percentage',
      'measure_speed.fan_setpoint',
      'measure_speed.ventilation_setpoint',
      'measure_number.startup_counter',
      'measure_number.total_operating_hours',
      //
      'measure_speed.supply_fan_rpm',
      'measure_speed.supply_fan_actual_rpm',
      'measure_speed.exhaust_fan_rpm',
      'measure_speed.exhaust_fan_actual_rpm',
      'measure_number.fallback_speed_timer',
      'measure_number.remaining_override_timer',
      'measure_number.pir_fan_speed_level',
      'measure_number.highest_received_co2',
      'measure_number.highest_received_rh',
      'measure_number.air_quality',
      //
      'measure_number.balance',
      'measure_number.valve_position',
      'measure_number.bypass_position',
      'measure_number.summercounter',
      'measure_number.summerday_kmin',
      'measure_number.frost_timer',
      'measure_number.boiler_timer',
      'measure_number.frost_block',
      'measure_number.current_position',
      'measure_number.vkk_switch',
      'measure_number.ghe_switch',
      'measure_number.airfilter_counter',
      'measure_number.global_fault_code',
      'measure_number.actual_mode_code',
      'measure_number.label_out_of_bound_error',
      'measure_string.last_command_source',
      'measure_string.firmware_version',
    ];

    const removeCaps = [
    ];

    for (const cap of caps) {
      if (!this.hasCapability(cap)) {
        await this.addCapability(cap);
        this.log('Added capability', cap);
      }
    }

    for (const cap of removeCaps) {
      if (this.hasCapability(cap)) {
        await this.removeCapability(cap);
        this.log('Removed capability', cap);
      }
    }

    if (this.settings.enableVirtualRemote ?? false) {
      if (this.hasCapability('fan_speed')) {
        await this.removeCapability('fan_speed');
        this.log('Removed fan_speed capability');
      }
      if (!this.hasCapability('button.join')) {
        await this.addCapability('button.join');
        this.log('Added button.join capability');
      }
      if (!this.hasCapability('button.leave')) {
        await this.addCapability('button.leave');
        this.log('Added button.leave capability');
      }
    } else {
      if (!this.hasCapability('fan_speed')) {
        await this.addCapability('fan_speed');
        this.log('Added fan_speed capability');
      }
      if (this.hasCapability('button.join')) {
        await this.removeCapability('button.join');
        this.log('Removed button.join capability');
      }
      if (this.hasCapability('button.leave')) {
        await this.removeCapability('button.leave');
        this.log('Removed button.leave capability');
      }
    }

    await this.setFanModeOptions();
  }

  async setFanModeOptions() {
    const options = this.getCapabilityOptions('fan_mode');
    const type = (this.settings.enableVirtualRemote ?? false)
      ? this.settings.virtualRemoteType ?? 'rft-auto'
      : this.settings.rfDeviceType ?? 'rft-auto';

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

  async updateStatus() {
    try {
      const rawStatus = await this.api.getStatus();
      const status = this._normalizeStatus(rawStatus);

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

      const { tempIndoor, tempOutdoor } = status;

      if (tempIndoor != null) await this.setCapabilityValue('measure_temperature', tempIndoor).catch(this.error);
      if (tempIndoor != null) await this.setCapabilityValue('measure_temperature.indoor', tempIndoor).catch(this.error);
      if (tempOutdoor != null) await this.setCapabilityValue('measure_temperature.outdoor', tempOutdoor).catch(this.error);
      if (status.supplyTemp != null) await this.setCapabilityValue('measure_temperature.supply', status.supplyTemp).catch(this.error);
      if (status.exhaustTemp != null) await this.setCapabilityValue('measure_temperature.exhaust', status.exhaustTemp).catch(this.error);

      if (status.humidity != null) await this.setCapabilityValue('measure_humidity', status.humidity).catch(this.error);
      if (status.ventilationSetpoint != null && this.hasCapability('fan_speed')) {
        await this.setCapabilityValue('fan_speed', fanSpeedPercentageToRatio(status.ventilationSetpoint)).catch(this.error);
      }
      if (status.speedStatus != null) await this.setCapabilityValue('measure_speed.speed_status', status.speedStatus).catch(this.error);
      if (status.fanSpeedPercentage != null) await this.setCapabilityValue('measure_speed.fan_speed_percentage', status.fanSpeedPercentage).catch(this.error);
      if (status.fanSpeed != null) await this.setCapabilityValue('measure_speed.fan_speed', status.fanSpeed).catch(this.error);
      if (status.fanSetpoint != null) await this.setCapabilityValue('measure_speed.fan_setpoint', status.fanSetpoint).catch(this.error);
      if (status.ventilationSetpoint != null) await this.setCapabilityValue('measure_speed.ventilation_setpoint', status.ventilationSetpoint).catch(this.error);
      if (status.supplyFanRpm != null) await this.setCapabilityValue('measure_speed.supply_fan_rpm', status.supplyFanRpm).catch(this.error);
      if (status.supplyFanActualRpm != null) await this.setCapabilityValue('measure_speed.supply_fan_actual_rpm', status.supplyFanActualRpm).catch(this.error);
      if (status.exhaustFanRpm != null) await this.setCapabilityValue('measure_speed.exhaust_fan_rpm', status.exhaustFanRpm).catch(this.error);
      if (status.exhaustFanActualRpm != null) await this.setCapabilityValue('measure_speed.exhaust_fan_actual_rpm', status.exhaustFanActualRpm).catch(this.error);
      if (status.startupCounter != null) await this.setCapabilityValue('measure_number.startup_counter', status.startupCounter).catch(this.error);
      if (status.totalOperatingHours != null) await this.setCapabilityValue('measure_number.total_operating_hours', status.totalOperatingHours).catch(this.error);
      if (status.balance != null) await this.setCapabilityValue('measure_number.balance', status.balance).catch(this.error);
      if (status.valvePosition != null) await this.setCapabilityValue('measure_number.valve_position', status.valvePosition).catch(this.error);
      if (status.bypassPosition != null) await this.setCapabilityValue('measure_number.bypass_position', status.bypassPosition).catch(this.error);
      if (status.summercounter != null) await this.setCapabilityValue('measure_number.summercounter', status.summercounter).catch(this.error);
      if (status.summerdayKmin != null) await this.setCapabilityValue('measure_number.summerday_kmin', status.summerdayKmin).catch(this.error);
      if (status.frostTimer != null) await this.setCapabilityValue('measure_number.frost_timer', status.frostTimer).catch(this.error);
      if (status.boilerTimer != null) await this.setCapabilityValue('measure_number.boiler_timer', status.boilerTimer).catch(this.error);
      if (status.frostBlock != null) await this.setCapabilityValue('measure_number.frost_block', status.frostBlock).catch(this.error);
      if (status.currentPosition != null) await this.setCapabilityValue('measure_number.current_position', status.currentPosition).catch(this.error);
      if (status.vkkSwitch != null) await this.setCapabilityValue('measure_number.vkk_switch', status.vkkSwitch).catch(this.error);
      if (status.gheSwitch != null) await this.setCapabilityValue('measure_number.ghe_switch', status.gheSwitch).catch(this.error);
      if (status.airfilterCounter != null) await this.setCapabilityValue('measure_number.airfilter_counter', status.airfilterCounter).catch(this.error);
      if (status.globalFaultCode != null) await this.setCapabilityValue('measure_number.global_fault_code', status.globalFaultCode).catch(this.error);
      if (status.actualModeCode != null) await this.setCapabilityValue('measure_number.actual_mode_code', status.actualModeCode).catch(this.error);
      if (status.pirFanSpeedLevel != null) await this.setCapabilityValue('measure_number.pir_fan_speed_level', status.pirFanSpeedLevel).catch(this.error);
      if (status.highestReceivedCo2 != null) await this.setCapabilityValue('measure_number.highest_received_co2', status.highestReceivedCo2).catch(this.error);
      if (status.highestReceivedRh != null) await this.setCapabilityValue('measure_number.highest_received_rh', status.highestReceivedRh).catch(this.error);
      if (status.airQuality != null) await this.setCapabilityValue('measure_number.air_quality', status.airQuality).catch(this.error);
      if (status.remainingOverrideTimer != null) await this.setCapabilityValue('measure_number.remaining_override_timer', status.remainingOverrideTimer).catch(this.error);
      if (status.fallbackSpeedTimer != null) await this.setCapabilityValue('measure_number.fallback_speed_timer', status.fallbackSpeedTimer).catch(this.error);
      if (status.labelOutOfBoundError != null) await this.setCapabilityValue('measure_number.label_out_of_bound_error', status.labelOutOfBoundError).catch(this.error);

      // --- fan_mode from Actual Mode first, then legacy Status/Selection ---
      const newMode = status.fanInfo ?? MODE_MAP[status.modeCode] ?? null;
      this.log('Determined fan mode from status:', { modeCode: status.modeCode, newMode: status.fanInfo });

      const prevMode = this.getCapabilityValue('fan_mode');
      if (newMode && newMode !== prevMode) {
        await this.setCapabilityValue('fan_mode', newMode);
        await this._triggerFanModeChanged.trigger(this, { mode: newMode }).catch(this.error);
      }

      // --- Flow triggers for sensor changes ---
      if (tempIndoor != null && tempIndoor !== prev.tempIndoor) {
        await this._triggerTemperatureChanged.trigger(this, { temperature: tempIndoor }).catch(this.error);
      }
      if (status.humidity != null && status.humidity !== prev.humidity) {
        await this._triggerHumidityChanged.trigger(this, { humidity: status.humidity }).catch(this.error);
      }

      // --- Flow triggers for rapid sensor changes ---
      await this._checkRapidChange('temperature', tempIndoor, 'temperature', this._triggerTemperatureChangedRapidly, 2);
      await this._checkRapidChange('humidity', status.humidity, 'humidity', this._triggerHumidityChangedRapidly, 1);

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
    this._configureApi(newSettings);

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

    this.log('IthoWTWWifi settings were changed');
  }

  async onRenamed(name) {
    this.log('IthoWTWWifi was renamed');
  }

  async onDeleted() {
    this.homey.clearInterval(this.pollingInterval);
    this.homey.clearInterval(this.otaPollingInterval);
    await this.api.websocket.disconnect();
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
    this._configureApi(settings, settings.useApiV2 ?? false, discoveryResult.address);
  }

  onDiscoveryLastSeenChanged(discoveryResult) {
    // Reconnect logic can be added here if needed
  }

  /**
   * Handles incoming WebSocket messages from the WTW firmware.
   *
   * {"systemstat": {itho, sensor_temp, sensor_hum, ...}} — every 5 s
   * {"ithostatusinfo": {all device fields...}}            — on demand
   */
  async _handleWebSocketMessage(data) {
    try {
      if (data.systemstat) {
        const stat = data.systemstat;

        if (stat.sensor_temp != null) {
          const prev = this.getCapabilityValue('measure_temperature.indoor');
          await this.setCapabilityValue('measure_temperature', stat.sensor_temp).catch(this.error);
          await this.setCapabilityValue('measure_temperature.indoor', stat.sensor_temp).catch(this.error);
          if (stat.sensor_temp !== prev) {
            await this._triggerTemperatureChanged.trigger(this, { temperature: stat.sensor_temp }).catch(this.error);
          }
          await this._checkRapidChange('temperature', stat.sensor_temp, 'temperature', this._triggerTemperatureChangedRapidly, 2);
        }
        if (stat.sensor_hum != null) {
          const prev = this.getCapabilityValue('measure_humidity');
          await this.setCapabilityValue('measure_humidity', stat.sensor_hum).catch(this.error);
          if (stat.sensor_hum !== prev) {
            await this._triggerHumidityChanged.trigger(this, { humidity: stat.sensor_hum }).catch(this.error);
          }
          await this._checkRapidChange('humidity', stat.sensor_hum, 'humidity', this._triggerHumidityChangedRapidly, 1);
        }
      }

      if (data.ithostatusinfo) {
        const status = this._normalizeStatus(data.ithostatusinfo);

        if (status.tempIndoor != null) {
          await this.setCapabilityValue('measure_temperature', status.tempIndoor).catch(this.error);
          await this.setCapabilityValue('measure_temperature.indoor', status.tempIndoor).catch(this.error);
          await this._checkRapidChange('temperature', status.tempIndoor, 'temperature', this._triggerTemperatureChangedRapidly, 2);
        }
        if (status.tempOutdoor != null) await this.setCapabilityValue('measure_temperature.outdoor', status.tempOutdoor).catch(this.error);
        if (status.supplyTemp != null) await this.setCapabilityValue('measure_temperature.supply', status.supplyTemp).catch(this.error);
        if (status.exhaustTemp != null) await this.setCapabilityValue('measure_temperature.exhaust', status.exhaustTemp).catch(this.error);
        if (status.humidity != null) {
          await this.setCapabilityValue('measure_humidity', status.humidity).catch(this.error);
          await this._checkRapidChange('humidity', status.humidity, 'humidity', this._triggerHumidityChangedRapidly, 1);
        }
        if (status.ventilationSetpoint != null && this.hasCapability('fan_speed')) {
          await this.setCapabilityValue('fan_speed', fanSpeedPercentageToRatio(status.ventilationSetpoint)).catch(this.error);
        }

        const newMode = MODE_MAP[status.modeCode] ?? null;

        const prevMode = this.getCapabilityValue('fan_mode');
        if (newMode && newMode !== prevMode) {
          await this.setCapabilityValue('fan_mode', newMode);
          await this._triggerFanModeChanged.trigger(this, { mode: newMode }).catch(this.error);
        }
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
   * Validates if a sensor value is within acceptable range.
   * Filters out firmware error markers and physically impossible readings.
   * @param {number} value - The sensor value
   * @param {number} min - Minimum acceptable value
   * @param {number} max - Maximum acceptable value
   * @param {number|null} errorMarker - Special marker value indicating sensor error (e.g., 65535 for CO2)
   * @returns {boolean} true if value is valid and within range
   */
  _isValidSensorValue(value, min, max, errorMarker = null) {
    if (value == null) return false;
    if (errorMarker != null && value === errorMarker) return false; // Error marker
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    return value >= min && value <= max;
  }

  _normalizeStatus(rawStatus) {
    const status = rawStatus?.ithostatus && typeof rawStatus.ithostatus === 'object'
      ? rawStatus.ithostatus
      : (rawStatus || {});

    const first = (keys) => this._first(status, keys);

    // Temperature fields: try 3.2.0 verbose names first, then fallback to older formats
    const supplyTemp = this._toNumber(first([
      'Inlet temperature (°C)',                  // 3.2.0 firmware
      'Supply temp (°C)', 'Supply temp (C)', 'Supply temperature (°C)', 'supply-temp'
    ]));
    const exhaustTemp = this._toNumber(first([
      'Temperature of the extracted air (°C)',  // 3.2.0 firmware
      'Exhaust temp (°C)', 'Exhaust temp (C)', 'Exhaust temperature (°C)', 'exhaust-temp'
    ]));
    const roomTemp = this._toNumber(first([
      'Room temp (°C)', 'Room temp (C)', 'Indoor temperature (°C)', 'Temp indoor (°C)', 'indoor-temp', 'temp-indoor', 'temp'
    ]));
    const outdoorTemp = this._toNumber(first([
      'Measured outside temperature (°C)',       // 3.2.0 firmware (primary)
      'Measured temperature of mixed outside air (°C)', // 3.2.0 firmware (fallback)
      'Outdoor temp (°C)', 'Outdoor temp (C)', 'Outdoor temperature (°C)', 'Temp outdoor (°C)', 'outdoor-temp', 'temp-outdoor'
    ]));
    const supplyFanRpm = this._toNumber(first(['Supply fan (RPM)', 'Fan setpoint (rpm)', 'fan-setpoint_rpm']));
    const supplyFanActualRpm = this._toNumber(first([
      'RPM of the motor (rpm)',                  // 3.2.0 firmware
      'Supply fan actual (RPM)', 'Fan speed (rpm)', 'fan-speed_rpm'
    ]));

    const actualMode = this._toNumber(first(['Actual Mode']));
    const statusMode = this._toNumber(first(['Status', 'status']));
    const selectionMode = this._toNumber(first(['Selection', 'selection']));

    // Humidity: validate to filter out impossible values (>100% or 127.5)
    const humRawValue = this._toNumber(first([
      'Highest measured RH (%)',                // 3.2.0 firmware
      'hum', 'Highest received RH value (%RH)', 'Highest received RH value (%Rh)', 'highest-received-rh-value_%rh'
    ]));
    const humidity = this._isValidSensorValue(humRawValue, 0, 100) ? humRawValue : null;

    // CO2: validate to filter out error marker (65535 = 0xFFFF for unavailable)
    const co2RawValue = this._toNumber(first([
      'Highest measured CO2 (ppm)',             // 3.2.0 firmware
      'Highest received CO2 value (Ppm)', 'Highest received CO2 value (PPM)', 'co2level_ppm', 'CO2level (ppm)'
    ]));
    const highestReceivedCo2 = this._isValidSensorValue(co2RawValue, 0, 5000, 65535) ? co2RawValue : null;

    // Speed status: try 3.2.0 name first, then fallback
    const speedStatus = this._toNumber(first([
      'Relative fanspeed (%)',                  // 3.2.0 firmware
      'Speed status', 'speed-status', 'Requested fanspeed (%)'
    ]));

    // Temperature validation: filter out impossible readings (e.g., -40.68°C is error state)
    const tempIndoorRaw = roomTemp ?? supplyTemp;
    const tempIndoor = this._isValidSensorValue(tempIndoorRaw, -30, 60) ? tempIndoorRaw : null;
    const tempOutdoorRaw = outdoorTemp ?? exhaustTemp;
    const tempOutdoor = this._isValidSensorValue(tempOutdoorRaw, -30, 60) ? tempOutdoorRaw : null;
    const supplyTempValid = this._isValidSensorValue(supplyTemp, -30, 60) ? supplyTemp : null;
    const exhaustTempValid = this._isValidSensorValue(exhaustTemp, -30, 60) ? exhaustTemp : null;

    return {
      tempIndoor,
      tempOutdoor,
      supplyTemp: supplyTempValid,
      exhaustTemp: exhaustTempValid,
      humidity,
      speedStatus,
      fanInfo: first(['FanInfo', 'fan_info']),
      fanSpeed: supplyFanActualRpm,
      fanSetpoint: supplyFanRpm,
      ventilationSetpoint: this._toNumber(first([
        'Absolute speed of the fan (%)',         // 3.2.0 firmware
        'Ventilation setpoint (%)', 'ventilation-setpoint_perc', 'Requested fanspeed (%)'
      ])),
      fanSpeedPercentage: this._toNumber(first([
        'Requested fanspeed (%)', 'requested-fanspeed_perc'
      ])),
      supplyFanRpm,
      supplyFanActualRpm,
      exhaustFanRpm: this._toNumber(first(['Exhaust fan (RPM)'])),
      exhaustFanActualRpm: this._toNumber(first(['Exhaust fan actual (RPM)'])),
      startupCounter: this._toNumber(first(['Startup counter', 'startup-counter'])),
      totalOperatingHours: this._toNumber(first(['Total operation (hours)', 'total-operation_hours'])),
      balance: this._toNumber(first(['Balance (%)'])),
      valvePosition: this._toNumber(first(['Valve position'])),
      bypassPosition: this._toNumber(first([
        'Percentage that the bypass valve is open (%)', // 3.2.0 firmware
        'Bypass position'
      ])),
      summercounter: this._toNumber(first(['Summercounter'])),
      summerdayKmin: this._toNumber(first(['Summerday (K_min)'])),
      frostTimer: this._toNumber(first(['Frost timer'])),
      boilerTimer: this._toNumber(first(['Boiler timer'])),
      frostBlock: this._toNumber(first(['Frost block'])),
      currentPosition: this._toNumber(first(['Current position'])),
      vkkSwitch: this._toNumber(first(['VKKswitch'])),
      gheSwitch: this._toNumber(first(['GHEswitch'])),
      airfilterCounter: this._toNumber(first(['Airfilter counter'])),
      globalFaultCode: this._toNumber(first(['Global fault code'])),
      actualModeCode: actualMode,
      modeCode: actualMode ?? statusMode ?? selectionMode,
      pirFanSpeedLevel: this._toNumber(first(['Pir fan speed level'])),
      highestReceivedCo2,
      highestReceivedRh: humidity, // Use validated humidity instead of separate field
      airQuality: this._toNumber(first(['Air Quality (%)'])),
      remainingOverrideTimer: this._toNumber(first(['Remaining override timer (Sec)'])),
      fallbackSpeedTimer: this._toNumber(first(['Fallback speed timer (Sec)'])),
      labelOutOfBoundError: this._toNumber(first(['Label out of bound error'])),
    };
  }

};
