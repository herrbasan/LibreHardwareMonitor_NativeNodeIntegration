const path = require('path');
const addonPath = path.resolve(__dirname, '../dist/NativeLibremon_NAPI/index.js');
const monitor = require(addonPath);

// Helper to recursively find sensor nodes (leaf nodes with values)
function findSensors(node, results = []) {
  // If it has a Value and it's not the header "Value", it's a sensor
  if (node.Value && node.Value !== 'Value') {
    results.push(node);
  }
  if (node.Children) {
    for (const child of node.Children) {
      findSensors(child, results);
    }
  }
  return results;
}

async function run() {
  console.log('Initializing with GPU focus (CPU/Motherboard enabled for detection)...');
  // Enable GPU, plus CPU/Motherboard as they are often required for proper bus/sensor detection
  monitor.init({
    cpu: true,
    gpu: true,
    motherboard: true,
    memory: false,
    storage: false,
    network: false,
    controller: false
  });

  console.log('Starting GPU poll loop. Press Ctrl+C to stop.');

  let polling = true;
  process.on('SIGINT', () => {
    polling = false;
    console.log('\nStopping...');
  });

  while (polling) {
    const start = Date.now();
    try {
      const data = await monitor.poll();
      
      // Clear console for a dashboard-like view
      console.clear();
      console.log(`=== GPU Monitor (Poll Time: ${new Date().toLocaleTimeString()}) ===`);
      console.log('Press Ctrl+C to exit\n');

      // Navigate to Computer node
      if (data.Children && data.Children.length > 0) {
        const computerNode = data.Children[0];
        
        if (computerNode.Children && computerNode.Children.length > 0) {
          const hardwareList = computerNode.Children;
          
          // Filter for Intel GPUs only
          const gpus = hardwareList.filter(h => 
            h.Text.includes('Intel') && (h.Text.includes('Graphics') || h.Text.includes('Arc'))
          );

          if (gpus.length === 0) {
            console.log("No Intel GPU hardware found.");
            // Fallback: print all hardware names to help debug
            console.log("Hardware detected:", hardwareList.map(h => h.Text).join(', '));
          }

          for (const gpu of gpus) {
            console.log(`[${gpu.Text}]`);
            
            const sensors = findSensors(gpu);
            
            // Find specific sensors for Core Usage and VRAM
            const coreLoad = sensors.find(s => s.Text === 'GPU Core' && (s.Type === 'Load' || s.Value.includes('%')));
            const memControllerLoad = sensors.find(s => s.Text === 'GPU Memory' && (s.Type === 'Load' || s.Value.includes('%')));
            const memUsed = sensors.find(s => s.Text === 'GPU Memory Used');
            const memTotal = sensors.find(s => s.Text === 'GPU Memory Total');

            if (coreLoad) console.log(`  Core Usage:       ${coreLoad.Value}`);
            if (memControllerLoad) console.log(`  Mem Controller:   ${memControllerLoad.Value}`);
            if (memUsed) console.log(`  VRAM Used:        ${memUsed.Value}${memTotal ? ' / ' + memTotal.Value : ''}`);
            
            console.log(''); // Empty line between hardware
          }
        } else {
            console.log("No hardware children found under Computer node.");
        }
      } else {
          console.log("Invalid data structure received.");
      }

    } catch (err) {
      console.error('Poll error:', err);
    }

    if (!polling) break;

    // Wait for next poll (1000ms)
    const elapsed = Date.now() - start;
    const delay = Math.max(0, 1000 - elapsed);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  console.log('Shutting down...');
  monitor.shutdown();
}

run().catch(err => console.error(err));
