const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const readline = require('readline');
const path = require('path');

/**
 * LibreMonCLI Client - Node.js wrapper for persistent daemon
 * 
 * @example
 * const { LibreMonClient } = require('./lib');
 * 
 * const client = new LibreMonClient();
 * await client.start();
 * await client.init({ cpu: true, gpu: true, flat: true });
 * const data = await client.poll();
 * await client.shutdown();
 */
class LibreMonClient extends EventEmitter {
  /**
   * Create a new client
   * @param {string} exePath - Path to LibreMonCLI.exe (default: ../dist/LibreMonCLI.exe)
   */
  constructor(exePath = null) {
    super();
    this.exePath = exePath || path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');
    this.process = null;
    this.rl = null;
    this.isInitialized = false;
    this.responseHandlers = new Map();
    this.commandId = 0;
  }

  /**
   * Start daemon process
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      if (this.process) {
        return reject(new Error('Daemon already started'));
      }

      this.process = spawn(this.exePath, ['--daemon'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Set up readline for newline-delimited JSON
      this.rl = readline.createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      });

      // Handle stdout responses
      this.rl.on('line', (line) => {
        try {
          const response = JSON.parse(line);
          this.emit('response', response);
          
          // Call pending response handlers
          this.responseHandlers.forEach((handler, id) => {
            handler(response);
          });
        } catch (err) {
          this.emit('error', new Error(`Invalid JSON from daemon: ${line}`));
        }
      });

      // Handle stderr (debug/errors)
      this.process.stderr.on('data', (data) => {
        const message = data.toString().trim();
        this.emit('stderr', message);
        // Also log to console for debugging
        console.error(`[LibreMonCLI stderr]: ${message}`);
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        this.emit('exit', { code, signal });
        this.isInitialized = false;
        this.process = null;
        this.rl = null;
      });

      // Handle spawn errors
      this.process.on('error', (err) => {
        reject(new Error(`Failed to start daemon: ${err.message}`));
      });

      // Give the daemon a moment to start
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          resolve();
        } else {
          reject(new Error('Daemon process died immediately'));
        }
      }, 100);
    });
  }

  /**
   * Send command and wait for response
   * @param {object} cmd - Command object
   * @param {number} timeout - Timeout in milliseconds (default: 5000)
   * @returns {Promise<object>}
   */
  async sendCommand(cmd, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (!this.process || this.process.killed) {
        return reject(new Error('Daemon not running'));
      }

      const commandId = this.commandId++;
      let timeoutHandle;

      const handler = (response) => {
        // Simple heuristic: first response after command is the response to that command
        // For more robust implementation, could add command IDs to protocol
        clearTimeout(timeoutHandle);
        this.responseHandlers.delete(commandId);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      };

      timeoutHandle = setTimeout(() => {
        this.responseHandlers.delete(commandId);
        reject(new Error('Command timeout'));
      }, timeout);

      this.responseHandlers.set(commandId, handler);
      
      try {
        // Write newline-delimited JSON to stdin
        const json = JSON.stringify(cmd);
        this.process.stdin.write(json + '\n');
      } catch (err) {
        this.responseHandlers.delete(commandId);
        clearTimeout(timeoutHandle);
        reject(err);
      }
    });
  }

  /**
   * Initialize hardware monitoring
   * @param {object} options - Hardware options
   * @param {boolean} options.cpu - Enable CPU sensors
   * @param {boolean} options.gpu - Enable GPU sensors
   * @param {boolean} options.memory - Enable memory sensors
   * @param {boolean} options.motherboard - Enable motherboard sensors
   * @param {boolean} options.storage - Enable storage sensors
   * @param {boolean} options.network - Enable network sensors
   * @param {boolean} options.psu - Enable PSU sensors
   * @param {boolean} options.controller - Enable controller sensors
   * @param {boolean} options.battery - Enable battery sensors
   * @param {boolean} options.flat - Use flat output mode (default: false)
   * @returns {Promise<object>}
   */
  async init(options = {}) {
    const {
      cpu = false,
      gpu = false,
      memory = false,
      motherboard = false,
      storage = false,
      network = false,
      psu = false,
      controller = false,
      battery = false,
      flat = false
    } = options;

    const flags = [];
    if (cpu) flags.push('cpu');
    if (gpu) flags.push('gpu');
    if (memory) flags.push('memory');
    if (motherboard) flags.push('motherboard');
    if (storage) flags.push('storage');
    if (network) flags.push('network');
    if (psu) flags.push('psu');
    if (controller) flags.push('controller');
    if (battery) flags.push('battery');

    const response = await this.sendCommand({ cmd: 'init', flags, flat });
    this.isInitialized = true;
    return response;
  }

  /**
   * Poll sensor data
   * @returns {Promise<object>}
   */
  async poll() {
    if (!this.isInitialized) {
      throw new Error('Not initialized. Call init() first.');
    }
    return await this.sendCommand({ cmd: 'poll' });
  }

  /**
   * Get version information
   * @returns {Promise<object>}
   */
  async version() {
    return await this.sendCommand({ cmd: 'version' });
  }

  /**
   * Shutdown daemon
   * @returns {Promise<object>}
   */
  async shutdown() {
    const response = await this.sendCommand({ cmd: 'shutdown' });
    
    // Give daemon time to clean up
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (this.process && !this.process.killed) {
      this.process.stdin.end();
    }
    
    return response;
  }

  /**
   * Force kill the daemon process
   */
  kill() {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.isInitialized = false;
  }
}

module.exports = { LibreMonClient };
