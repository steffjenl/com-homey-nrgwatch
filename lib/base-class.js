'use strict';

const Homey = require('homey');

/**
 * Base class for all NRGWatch components.
 * Provides common functionality for managing Homey instance.
 * @extends Homey.SimpleClass
 */
class BaseClass extends Homey.SimpleClass {
  /**
   * Creates an instance of BaseClass.
   * @param {...any} props - Constructor properties passed to parent class
   */
  constructor(...props) {
    super(...props);

    /** @type {Homey|null} Homey application instance */
    this.homey = null;
  }

  /**
   * Sets the Homey application instance for logging and app access.
   * @param {Homey} homey - The Homey application instance
   * @returns {void}
   */
  setHomeyObject(homey) {
    this.homey = homey;
  }
}

module.exports = BaseClass;
