/**
 * LibreHardwareMonitor Native - Node.js interface
 * Provides JavaScript API for native hardware monitoring addon
 */

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
    
    try {
        return addon.init(fullConfig);
    } catch(err) {
        // Enhance error message for common issues
        if (err.message && err.message.includes('.NET runtime')) {
            throw new Error(
                'Failed to initialize .NET runtime. ' +
                'Please install .NET 9.0 Desktop Runtime from: ' +
                'https://dotnet.microsoft.com/download/dotnet/9.0'
            );
        }
        throw err;
    }
}

/**
 * Filter virtual network adapters from hardware tree
 * Removes virtual NICs like QoS schedulers, WFP filters, VirtualBox adapters, etc.
 * @param {Object} data - Hardware tree data
 */
function filterVirtualNetworkAdapters(data) {
    if (!data || !data.Children) return;
    
    // Recursively process all nodes
    for (const child of data.Children) {
        if (child.Children && Array.isArray(child.Children)) {
            // Filter out virtual network adapters
            child.Children = child.Children.filter(item => {
                // Check if this is a network adapter by HardwareId
                if (!item.HardwareId || !item.HardwareId.includes('/nic/')) {
                    return true; // Keep non-network items
                }
                
                const name = item.Text || '';
                
                // Filter patterns for virtual/filter adapters
                const virtualPatterns = [
                    '-QoS Packet Scheduler',
                    '-WFP ',  // Windows Filtering Platform
                    '-VirtualBox NDIS',
                    '-Hyper-V Virtual Switch',
                    '-Native WiFi Filter',
                    '-Virtual WiFi Filter',
                    'vEthernet',
                    'vSwitch',
                    '(Kerneldebugger)'
                ];
                
                // Check if adapter name contains any virtual pattern
                const isVirtual = virtualPatterns.some(pattern => 
                    name.includes(pattern)
                );
                
                return !isVirtual; // Keep only physical adapters
            });
            
            // Recursively filter children
            filterVirtualNetworkAdapters(child);
        }
    }
}

/**
 * Filter individual RAM DIMM modules from hardware tree
 * Keeps only aggregated Virtual Memory and Total Memory sensors
 * @param {Object} data - Hardware tree data
 */
function filterIndividualDIMMs(data) {
    if (!data || !data.Children) return;
    
    // Recursively process all nodes
    for (const child of data.Children) {
        if (child.Children && Array.isArray(child.Children)) {
            // Filter out individual DIMM modules
            child.Children = child.Children.filter(item => {
                // Check if this is a memory DIMM by HardwareId
                if (!item.HardwareId || !item.HardwareId.includes('/memory/dimm/')) {
                    return true; // Keep non-DIMM items
                }
                
                // Filter out individual DIMMs (keep only /vram and /ram)
                return false;
            });
            
            // Recursively filter children
            filterIndividualDIMMs(child);
        }
    }
}

/**
 * Poll hardware sensors
 * @param {Object} options - Polling options
 * @param {boolean} options.filterVirtualNics - Remove virtual network adapters (optional, default: false)
 * @param {boolean} options.filterDIMMs - Remove individual RAM DIMM sensors (optional, default: false)
 * @returns {Promise<Object>} Sensor data matching LibreHardwareMonitor web endpoint format
 */
async function poll(options = {}) {
    const addon = loadAddon();
    const data = addon.poll();
    
    // Apply optional filters
    if (options.filterVirtualNics) {
        filterVirtualNetworkAdapters(data);
    }
    
    if (options.filterDIMMs) {
        filterIndividualDIMMs(data);
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
