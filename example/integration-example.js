/**
 * Example: Integrating librehardwaremonitor-native in your project
 * 
 * This example shows how to use the native addon as a drop-in replacement
 * for LibreHardwareMonitor web endpoint polling.
 */

const path = require('path');

// Adjust path based on where you added the submodule
const SUBMODULE_PATH = './lib/librehardwaremonitor-native';

class HardwareMonitorService {
  constructor(options = {}) {
    this.useNative = options.useNative ?? true;
    this.fallbackToWeb = options.fallbackToWeb ?? true;
    this.webEndpoint = options.webEndpoint || 'http://localhost:8085/data.json';
    this.pollingInterval = options.pollingInterval || 1000;
    
    this.backend = null;
    this.pollTimer = null;
    this.onDataCallback = null;
  }
  
  /**
   * Initialize the monitoring service
   */
  async init(hardwareConfig = {}) {
    const config = {
      cpu: true,
      gpu: true,
      memory: true,
      motherboard: true,
      storage: false,
      network: false,
      psu: false,
      controller: false,
      battery: false,
      ...hardwareConfig
    };
    
    if (this.useNative) {
      try {
        // Try to load native addon
        const nativeAddon = require(SUBMODULE_PATH);
        await nativeAddon.init(config);
        
        this.backend = {
          type: 'native',
          poll: () => nativeAddon.poll(),
          shutdown: () => nativeAddon.shutdown()
        };
        
        console.log('✓ Hardware monitoring initialized (native)');
        return;
      } catch (err) {
        console.warn('⚠ Native monitoring failed:', err.message);
        
        if (!this.fallbackToWeb) {
          throw new Error(`Native monitoring required but failed: ${err.message}`);
        }
        
        console.log('→ Falling back to web polling...');
      }
    }
    
    // Fallback to web polling
    this.backend = {
      type: 'web',
      poll: async () => {
        const response = await fetch(this.webEndpoint);
        if (!response.ok) {
          throw new Error(`Web polling failed: ${response.status}`);
        }
        return await response.json();
      },
      shutdown: () => {} // No cleanup needed for web polling
    };
    
    console.log('✓ Hardware monitoring initialized (web polling)');
  }
  
  /**
   * Start automatic polling
   */
  startPolling(callback) {
    if (this.pollTimer) {
      throw new Error('Polling already started');
    }
    
    this.onDataCallback = callback;
    
    // Immediate first poll
    this._doPoll();
    
    // Then poll at interval
    this.pollTimer = setInterval(() => this._doPoll(), this.pollingInterval);
    
    console.log(`✓ Polling started (${this.pollingInterval}ms interval)`);
  }
  
  /**
   * Stop automatic polling
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      console.log('✓ Polling stopped');
    }
  }
  
  /**
   * Manual single poll
   */
  async poll() {
    if (!this.backend) {
      throw new Error('Monitor not initialized - call init() first');
    }
    
    return await this.backend.poll();
  }
  
  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    this.stopPolling();
    
    if (this.backend && this.backend.shutdown) {
      this.backend.shutdown();
    }
    
    this.backend = null;
    console.log('✓ Hardware monitoring shutdown');
  }
  
  /**
   * Internal polling implementation
   */
  async _doPoll() {
    try {
      const data = await this.backend.poll();
      
      if (this.onDataCallback) {
        this.onDataCallback(null, data);
      }
    } catch (err) {
      console.error('Polling error:', err.message);
      
      if (this.onDataCallback) {
        this.onDataCallback(err, null);
      }
    }
  }
  
  /**
   * Get current backend type
   */
  getBackendType() {
    return this.backend ? this.backend.type : 'none';
  }
}

// ============================================================
// USAGE EXAMPLE 1: Basic Usage
// ============================================================

async function basicExample() {
  const monitor = new HardwareMonitorService({
    useNative: true,
    fallbackToWeb: true
  });
  
  try {
    // Initialize
    await monitor.init({
      cpu: true,
      gpu: true,
      memory: true
    });
    
    // Single poll
    const data = await monitor.poll();
    console.log('Sensor data:', JSON.stringify(data, null, 2));
    
    // Cleanup
    await monitor.shutdown();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// ============================================================
// USAGE EXAMPLE 2: Automatic Polling
// ============================================================

async function pollingExample() {
  const monitor = new HardwareMonitorService({
    useNative: true,
    pollingInterval: 2000 // 2 seconds
  });
  
  await monitor.init();
  
  // Start polling with callback
  monitor.startPolling((err, data) => {
    if (err) {
      console.error('Poll error:', err.message);
      return;
    }
    
    // Process sensor data
    console.log(`Backend: ${monitor.getBackendType()}`);
    console.log(`Sensors: ${JSON.stringify(data).length} bytes`);
  });
  
  // Stop after 10 seconds
  setTimeout(async () => {
    await monitor.shutdown();
  }, 10000);
}

// ============================================================
// USAGE EXAMPLE 3: Extract Specific Sensors
// ============================================================

async function extractSensorsExample() {
  const monitor = new HardwareMonitorService();
  await monitor.init({ cpu: true, gpu: true });
  
  const data = await monitor.poll();
  
  // Extract CPU temperatures
  const cpuTemps = extractSensorsByType(data, 'Temperature', 'CPU');
  console.log('CPU Temperatures:', cpuTemps);
  
  // Extract GPU load
  const gpuLoad = extractSensorsByType(data, 'Load', 'GPU');
  console.log('GPU Load:', gpuLoad);
  
  await monitor.shutdown();
}

/**
 * Helper: Extract sensors by type and hardware name pattern
 */
function extractSensorsByType(data, sensorType, hardwarePattern = '') {
  const sensors = [];
  
  function traverse(node, hardwareName = '') {
    // Update hardware name if this is a hardware node
    if (node.HardwareId) {
      hardwareName = node.Text;
    }
    
    // If this is a sensor node with matching type
    if (node.SensorId && node.Type === sensorType) {
      if (!hardwarePattern || hardwareName.includes(hardwarePattern)) {
        sensors.push({
          hardware: hardwareName,
          name: node.Text,
          value: node.Value,
          min: node.Min,
          max: node.Max,
          sensorId: node.SensorId
        });
      }
    }
    
    // Traverse children
    if (node.Children && Array.isArray(node.Children)) {
      for (const child of node.Children) {
        traverse(child, hardwareName);
      }
    }
  }
  
  traverse(data);
  return sensors;
}

// ============================================================
// USAGE EXAMPLE 4: Electron Integration
// ============================================================

/**
 * For Electron main process
 */
async function electronMainExample() {
  const { app, ipcMain } = require('electron');
  const monitor = new HardwareMonitorService();
  
  app.on('ready', async () => {
    await monitor.init();
    
    // Start polling and send to renderer
    monitor.startPolling((err, data) => {
      if (!err && global.mainWindow) {
        global.mainWindow.webContents.send('sensor-data', data);
      }
    });
  });
  
  app.on('will-quit', async () => {
    await monitor.shutdown();
  });
  
  // Handle manual refresh from renderer
  ipcMain.handle('get-sensors', async () => {
    try {
      return await monitor.poll();
    } catch (err) {
      throw err;
    }
  });
}

// ============================================================
// Export for use in other modules
// ============================================================

module.exports = HardwareMonitorService;

// Run example if executed directly
if (require.main === module) {
  basicExample().catch(console.error);
}
