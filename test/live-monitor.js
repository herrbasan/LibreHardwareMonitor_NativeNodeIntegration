/**
 * Continuously polls CPU and GPU sensors and displays them in a live dashboard.
 * Run as admin for full hardware access. Press Ctrl+C to stop.
 * 
 * Usage: node test/live-monitor.js
 */

const path = require('path');

const distPath = path.resolve(__dirname, '../dist/native-libremon-napi');
const monitor = require(distPath);

// Helper to find sensors recursively
function findSensors(node, results = []) {
  if (node.Value && node.Value !== 'Value') {
    results.push({
      name: node.Text,
      value: node.Value,
      min: node.Min,
      max: node.Max,
      type: node.Type
    });
  }
  if (node.Children) {
    for (const child of node.Children) {
      findSensors(child, results);
    }
  }
  return results;
}

// Find hardware by type
function findHardware(data, filter) {
  const results = [];
  if (data.Children?.[0]?.Children) {
    for (const hw of data.Children[0].Children) {
      if (filter(hw)) {
        results.push(hw);
      }
    }
  }
  return results;
}

async function run() {
  console.log('Initializing hardware monitor (CPU + GPU)...');
  
  monitor.init({
    cpu: true,
    gpu: true,
    motherboard: true,  // Often needed for proper sensor detection
    memory: false,
    storage: false,
    network: false,
    psu: false,
    controller: false,
    battery: false
  });

  console.log('Starting live monitor. Press Ctrl+C to stop.\n');

  let running = true;
  process.on('SIGINT', () => {
    running = false;
  });

  while (running) {
    const pollStart = Date.now();
    
    try {
      const data = await monitor.poll();
      const pollTime = Date.now() - pollStart;
      
      console.clear();
      console.log(`=== Live Hardware Monitor === (${new Date().toLocaleTimeString()}, poll: ${pollTime}ms)`);
      console.log('Press Ctrl+C to exit\n');

      // Find CPUs
      const cpus = findHardware(data, hw => 
        hw.Text?.includes('CPU') || hw.Text?.includes('Processor') || hw.Text?.includes('Ryzen') || hw.Text?.includes('Core')
      );

      for (const cpu of cpus) {
        console.log(`[CPU] ${cpu.Text}`);
        const sensors = findSensors(cpu);
        
        // Show key sensors
        const temp = sensors.find(s => s.name === 'CPU Package' || s.name === 'Core (Tctl/Tdie)');
        const load = sensors.find(s => s.name === 'CPU Total');
        const power = sensors.find(s => s.name === 'CPU Package' && s.value?.includes('W'));
        const clock = sensors.find(s => s.name?.includes('Core #1') && s.value?.includes('MHz'));
        
        if (temp) console.log(`  Temperature: ${temp.value}`);
        if (load) console.log(`  Load:        ${load.value}`);
        if (power) console.log(`  Power:       ${power.value}`);
        if (clock) console.log(`  Clock:       ${clock.value}`);
        console.log('');
      }

      // Find GPUs
      const gpus = findHardware(data, hw => 
        hw.Text?.includes('Graphics') || hw.Text?.includes('GeForce') || 
        hw.Text?.includes('Radeon') || hw.Text?.includes('Arc') || hw.Text?.includes('Intel')
      );

      for (const gpu of gpus) {
        // Skip non-GPU Intel entries
        if (gpu.Text?.includes('CPU') || gpu.Text?.includes('Core')) continue;
        
        console.log(`[GPU] ${gpu.Text}`);
        const sensors = findSensors(gpu);
        
        // Show key sensors
        const temp = sensors.find(s => s.name === 'GPU Core' && s.value?.includes('°'));
        const load = sensors.find(s => s.name === 'GPU Core' && s.value?.includes('%'));
        const memUsed = sensors.find(s => s.name === 'GPU Memory Used');
        const memTotal = sensors.find(s => s.name === 'GPU Memory Total');
        const clock = sensors.find(s => s.name === 'GPU Core' && s.value?.includes('MHz'));
        const power = sensors.find(s => s.name?.includes('Power') && s.value?.includes('W'));
        
        if (temp) console.log(`  Temperature: ${temp.value}`);
        if (load) console.log(`  Load:        ${load.value}`);
        if (memUsed) console.log(`  VRAM Used:   ${memUsed.value}${memTotal ? ' / ' + memTotal.value : ''}`);
        if (clock) console.log(`  Clock:       ${clock.value}`);
        if (power) console.log(`  Power:       ${power.value}`);
        console.log('');
      }

      if (cpus.length === 0 && gpus.length === 0) {
        console.log('No CPU or GPU hardware detected.');
        console.log('Make sure to run as Administrator for full hardware access.');
      }

    } catch (err) {
      console.error('Poll error:', err.message);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\nShutting down...');
  monitor.shutdown();
  console.log('Done.');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
