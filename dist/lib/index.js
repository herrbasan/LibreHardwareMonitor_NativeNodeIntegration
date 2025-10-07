/**
 * LibreHardwareMonitor Native - Node.js interface
 * Provides JavaScript API for native hardware monitoring addon
 */

const { flatten } = require('./flatten');

let nativeAddon = null;

// Lazy load the native addon
function loadAddon() {
    if (!nativeAddon) {
        try {
            nativeAddon = require('../librehardwaremonitor_native.node');
        } catch (err) {
            throw new Error(
                'Failed to load native addon. Make sure to run "npm install" first.\n' +
                'Error: ' + err.message
            );
        }
    }
    return nativeAddon;
}

/**
 * Initialize hardware monitoring
 * @param {Object} config - Hardware configuration
 * @param {boolean} config.cpu - Enable CPU monitoring
 * @param {boolean} config.gpu - Enable GPU monitoring
 * @param {boolean} config.motherboard - Enable motherboard monitoring
 * @param {boolean} config.memory - Enable memory monitoring
 * @param {boolean} config.storage - Enable storage monitoring
 * @param {boolean} config.network - Enable network monitoring
 * @param {boolean} config.psu - Enable PSU monitoring
 * @param {boolean} config.controller - Enable controller monitoring
 * @param {boolean} config.battery - Enable battery monitoring
 * @returns {Promise<void>}
 */
async function init(config = {}) {
    const addon = loadAddon();
    
    // Set defaults
    const fullConfig = {
        cpu: config.cpu !== undefined ? config.cpu : false,
        gpu: config.gpu !== undefined ? config.gpu : false,
        motherboard: config.motherboard !== undefined ? config.motherboard : false,
        memory: config.memory !== undefined ? config.memory : false,
        storage: config.storage !== undefined ? config.storage : false,
        network: config.network !== undefined ? config.network : false,
        psu: config.psu !== undefined ? config.psu : false,
        controller: config.controller !== undefined ? config.controller : false,
        battery: config.battery !== undefined ? config.battery : false
    };
    
    return addon.init(fullConfig);
}

/**
 * Poll hardware sensors
 * @param {Object} options - Polling options
 * @param {boolean} options.flatten - Flatten data to simple object (optional)
 * @returns {Promise<Object>} Sensor data
 */
async function poll(options = {}) {
    const addon = loadAddon();
    const data = addon.poll();
    
    if (options.flatten) {
        return flatten(data);
    }
    
    return data;
}

/**
 * Shutdown hardware monitoring
 * Releases all resources and unloads .NET runtime
 * @returns {Promise<void>}
 */
async function shutdown() {
    const addon = loadAddon();
    return addon.shutdown();
}

module.exports = {
    init,
    poll,
    shutdown
};
