const path = require('path');
const fs = require('fs');
const addonPath = path.resolve(__dirname, '../dist/NativeLibremon_NAPI/index.js');
const monitor = require(addonPath);

async function run() {
  console.log('Initializing with all hardware categories enabled...');
  monitor.init({
    cpu: true,
    gpu: true,
    motherboard: true,
    memory: true,
    storage: true,
    network: true,
    psu: true,
    controller: true,
    battery: true
  });

  console.log('Polling sensor data...');
  const data = await monitor.poll();
  
  const outputFile = path.join(__dirname, 'sensor-data.json');
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Complete sensor data written to: ${outputFile}`);

  console.log('Shutting down...');
  monitor.shutdown();
}

run().catch(err => console.error(err));
