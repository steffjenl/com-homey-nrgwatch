'use strict';

const Homey = require('homey');

/**
 * Main application class for NRGWatch Homey app.
 * Manages Itho ventilation system devices and provides centralized logging.
 * @extends Homey.App
 */
class NRGWatch extends Homey.App {
  /**
   * Called when the app is initialized.
   * Sets up the application and initializes necessary components.
   * @returns {Promise<void>}
   */
  async onInit() {
    this.log('NRGWatch has been initialized');

    // Register flow cards or other app-wide functionality here if needed
    await this._registerFlowCards();
  }

  /**
   * Registers flow cards for app-wide actions and triggers.
   * @private
   * @returns {Promise<void>}
   */
  async _registerFlowCards() {
    // Flow cards can be registered here for custom actions
    // Example: Control multiple devices, system-wide modes, etc.
    this.log('Flow cards registered');
  }

  /**
   * Converts a Date object to local time.
   * @param {Date} date - Date object to convert
   * @returns {Date} Date adjusted to local timezone
   */
  toLocalTime(date) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60 * 1000);
  }
}

module.exports = NRGWatch;
