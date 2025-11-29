/**
 * Polls all sensor data once and writes it to sensor-data.json
 * Run as admin for full hardware access.
 * 
 * Usage: node test/dump-sensors.js
 */

const path = require('path');
const fs = require('fs');

const distPath = path.resolve(__dirname, '../dist/native-libremon-napi');
const monitor = require(distPath);

async function run() {
  console.log('Initializing hardware monitor (all categories)...');
  
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
  
  // Count hardware and sensors
  let hwCount = 0;
  let sensorCount = 0;
  
  function countNodes(node) {
    if (node.Children) {
      for (const child of node.Children) {
        if (child.HardwareId) hwCount++;
        if (child.Value && child.Value !== 'Value') sensorCount++;
        countNodes(child);
      }
    }
  }
  countNodes(data);
  
  console.log(`\nResults:`);
  console.log(`  Hardware items: ${hwCount}`);
  console.log(`  Sensor values:  ${sensorCount}`);
  console.log(`  Output file:    ${outputFile}`);

  monitor.shutdown();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
