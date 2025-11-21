const path = require('path');
const addonPath = path.resolve(__dirname, '../dist/NativeLibremon_NAPI/index.js');
const monitor = require(addonPath);

async function testWithDimmDetection() {
  console.log('\n=== Test 1: WITH DIMM Detection (dimmDetection: true) ===');
  
  monitor.init({
    memory: true,
    dimmDetection: true  // Enable expensive per-DIMM sensors
  });

  const data = await monitor.poll();
  
  // Count memory hardware items
  const memoryHardware = data.Children[0].Children.filter(hw => 
    hw.Text.includes('Memory') || hw.Text.includes('Corsair') || hw.Text.includes('Skill')
  );
  
  console.log(`\nFound ${memoryHardware.length} memory hardware items:`);
  memoryHardware.forEach(hw => {
    console.log(`  - ${hw.Text} (${hw.HardwareId})`);
    
    // Count sensors
    let sensorCount = 0;
    hw.Children.forEach(group => {
      sensorCount += group.Children.length;
    });
    console.log(`    Sensors: ${sensorCount}`);
  });

  monitor.shutdown();
}

async function testWithoutDimmDetection() {
  console.log('\n=== Test 2: WITHOUT DIMM Detection (dimmDetection: false) ===');
  
  monitor.init({
    memory: true,
    dimmDetection: false  // Disable per-DIMM sensors for performance
  });

  const data = await monitor.poll();
  
  // Count memory hardware items
  const memoryHardware = data.Children[0].Children.filter(hw => 
    hw.Text.includes('Memory') || hw.Text.includes('Corsair') || hw.Text.includes('Skill')
  );
  
  console.log(`\nFound ${memoryHardware.length} memory hardware items:`);
  memoryHardware.forEach(hw => {
    console.log(`  - ${hw.Text} (${hw.HardwareId})`);
    
    // Count sensors
    let sensorCount = 0;
    hw.Children.forEach(group => {
      sensorCount += group.Children.length;
    });
    console.log(`    Sensors: ${sensorCount}`);
  });

  monitor.shutdown();
}

async function run() {
  try {
    console.log('Testing dimmDetection feature...\n');
    
    await testWithDimmDetection();
    
    // Wait a bit before next test
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testWithoutDimmDetection();
    
    console.log('\n=== Results ===');
    console.log('With dimmDetection=true: Should see Virtual Memory, Total Memory, and individual DIMMs (Corsair, G Skill)');
    console.log('With dimmDetection=false: Should only see Virtual Memory and Total Memory (no individual DIMMs)');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
