const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('Testing memory sensor output...\n');

const cli = spawn(exePath, ['--daemon'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const rl = readline.createInterface({
  input: cli.stdout,
  crlfDelay: Infinity
});

let step = 0;

rl.on('line', (line) => {
  const response = JSON.parse(line);
  
  if (step === 0) {
    console.log('✅ Init complete');
    step = 1;
    cli.stdin.write(JSON.stringify({ cmd: 'poll' }) + '\n');
  } else if (step === 1) {
    console.log('✅ Poll complete\n');
    
    // Save full output
    fs.writeFileSync('output/memory-sensors-raw.json', JSON.stringify(response, null, 2));
    console.log('Saved full output to output/memory-sensors-raw.json\n');
    
    // Extract memory hardware
    if (response.success && response.data && response.data.Children) {
      const memoryHardware = response.data.Children.filter(hw => hw.HardwareType === 'Memory');
      console.log(`Found ${memoryHardware.length} memory hardware device(s):\n`);
      
      memoryHardware.forEach(hw => {
        console.log(`Hardware: ${hw.Name}`);
        console.log(`  Sensors:`);
        hw.Sensors.forEach(sensor => {
          console.log(`    ${sensor.Name}: ${sensor.Value} ${sensor.SensorType}`);
        });
        console.log('');
      });
    }
    
    cli.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n');
  }
});

cli.on('spawn', () => {
  console.log('Daemon started, sending init command...');
  // Send init immediately - no "ready" message
  cli.stdin.write(JSON.stringify({ cmd: 'init', flags: ['memory'] }) + '\n');
});

cli.on('exit', (code) => {
  console.log(`\nDaemon exited with code: ${code}`);
});
