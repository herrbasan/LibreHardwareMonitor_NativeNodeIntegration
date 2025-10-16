/**
 * Example: Using LibreMonCLI daemon for high-frequency polling
 * 
 * This demonstrates the persistent daemon approach with 1-second polling interval
 */

const { LibreMonClient } = require('../managed/LibreMonCLI/lib');

async function main() {
  const client = new LibreMonClient();
  
  // Optional: Listen to daemon events
  client.on('stderr', (message) => {
    console.log(`[Daemon stderr]: ${message}`);
  });
  
  client.on('exit', ({ code, signal }) => {
    console.log(`[Daemon exited]: code=${code}, signal=${signal}`);
  });

  try {
    console.log('Starting LibreMonCLI daemon...');
    await client.start();
    console.log('✓ Daemon started\n');

    // Get version
    console.log('Getting version...');
    const versionInfo = await client.version();
    console.log('✓ Version:', versionInfo);
    console.log();

    // Initialize hardware monitoring
    console.log('Initializing hardware monitoring...');
    const initResponse = await client.init({
      cpu: true,
      gpu: true,
      memory: true,
      motherboard: true,
      flat: true  // Use flat output mode for easier consumption
    });
    console.log('✓ Initialized:', initResponse);
    console.log();

    // Poll 10 times at 1-second intervals
    console.log('Starting polling (1-second intervals, 10 cycles)...\n');
    
    for (let i = 1; i <= 10; i++) {
      const startTime = Date.now();
      
      try {
        const data = await client.poll();
        const pollTime = Date.now() - startTime;
        
        console.log(`Poll #${i} (${pollTime}ms):`);
        
        // Display CPU data if available
        if (data.data && data.data.cpu && data.data.cpu.length > 0) {
          const cpu = data.data.cpu[0];
          console.log(`  CPU: ${cpu.name}`);
          
          if (cpu.temperatures) {
            const temps = Object.entries(cpu.temperatures).filter(([key]) => key !== 'name' && key !== 'id');
            if (temps.length > 0) {
              const [, tempData] = temps[0];
              console.log(`    Temperature: ${tempData.data.value}${tempData.data.type}`);
            }
          }
          
          if (cpu.load) {
            const loads = Object.entries(cpu.load).filter(([key]) => key !== 'name' && key !== 'id');
            if (loads.length > 0) {
              const [, loadData] = loads[0];
              console.log(`    Load: ${loadData.data.value}${loadData.data.type}`);
            }
          }
        }
        
        // Display GPU data if available
        if (data.data && data.data.gpu && data.data.gpu.length > 0) {
          const gpu = data.data.gpu[0];
          console.log(`  GPU: ${gpu.name}`);
          
          if (gpu.temperatures) {
            const temps = Object.entries(gpu.temperatures).filter(([key]) => key !== 'name' && key !== 'id');
            if (temps.length > 0) {
              const [, tempData] = temps[0];
              console.log(`    Temperature: ${tempData.data.value}${tempData.data.type}`);
            }
          }
        }
        
        console.log();
      } catch (err) {
        console.error(`  Poll error: ${err.message}`);
      }
      
      // Wait 1 second before next poll
      if (i < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Shutdown
    console.log('Shutting down daemon...');
    await client.shutdown();
    console.log('✓ Shutdown complete');

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    
    // Force kill daemon if still running
    client.kill();
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, shutting down...');
  process.exit(0);
});

main();
