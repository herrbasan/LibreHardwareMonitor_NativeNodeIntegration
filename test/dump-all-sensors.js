/**
 * Dump all sensor data to a file for format verification
 * This script initializes hardware monitoring with all hardware types enabled,
 * polls sensors, and writes the raw JSON output to a file.
 */

const monitor = require('../lib/index');
const fs = require('fs');
const path = require('path');

async function dumpAllSensors() {
  console.log('LibreHardwareMonitor - Full Sensor Dump\n');
  
  try {
    // Initialize with ALL hardware types enabled
    console.log('1. Initializing hardware monitor with all sensors enabled...');
    await monitor.init({
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
    console.log('   ✓ Initialization successful\n');
    
    // Poll sensors
    console.log('2. Polling all sensors...');
    const data = await monitor.poll();
    console.log('   ✓ Poll successful\n');
    
    // Write to file
    const outputPath = path.join(__dirname, 'sensor-dump.json');
    console.log('3. Writing sensor data to file...');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`   ✓ Data written to: ${outputPath}\n`);
    
    // Display summary
    console.log('Summary:');
    console.log(`   File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    
    // Count hardware nodes
    function countNodes(node) {
      let count = 1;
      if (node.Children && Array.isArray(node.Children)) {
        node.Children.forEach(child => {
          count += countNodes(child);
        });
      }
      return count;
    }
    
    const totalNodes = countNodes(data);
    console.log(`   Total nodes: ${totalNodes}`);
    
    // Count hardware types
    const hardwareTypes = new Set();
    function collectHardwareTypes(node) {
      if (node.Text && node.Children) {
        hardwareTypes.add(node.Text);
      }
      if (node.Children && Array.isArray(node.Children)) {
        node.Children.forEach(child => collectHardwareTypes(child));
      }
    }
    collectHardwareTypes(data);
    console.log(`   Hardware types detected: ${hardwareTypes.size}`);
    
    // List top-level hardware
    console.log('\nTop-level hardware detected:');
    if (data.Children && Array.isArray(data.Children)) {
      data.Children.forEach(hw => {
        const sensorCount = hw.Children ? hw.Children.length : 0;
        console.log(`   - ${hw.Text} (${sensorCount} sensor groups)`);
      });
    }
    
    console.log('\n✓ Sensor dump complete!');
    console.log(`\nYou can now compare ${outputPath} with the web endpoint format.`);
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Shutdown
    console.log('\n4. Shutting down...');
    try {
      await monitor.shutdown();
      console.log('   ✓ Shutdown successful');
    } catch (err) {
      console.error('   ✗ Shutdown error:', err.message);
    }
  }
}

// Run the dump
dumpAllSensors().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
