const path = require('path');
const addonPath = path.resolve(__dirname, '../dist/NativeLibremon_NAPI/index.js');
const monitor = require(addonPath);

async function run() {
  console.log('Initializing...');
  monitor.init({
    cpu: true,
    gpu: true,
    motherboard: true,
    memory: true,
    storage: true,
    network: true
  });

  console.log('Polling...');
  const data = await monitor.poll();
  console.log('Data received:', JSON.stringify(data, null, 2).substring(0, 500) + '...');

  console.log('Shutting down...');
  monitor.shutdown();
}

run().catch(err => console.error(err));
