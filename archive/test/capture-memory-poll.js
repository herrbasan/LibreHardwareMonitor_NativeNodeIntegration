const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('Capturing poll response with memory enabled...\n');

const cli = spawn(exePath, ['--daemon']);

const rl = readline.createInterface({
  input: cli.stdout,
  crlfDelay: Infinity
});

let responses = [];

rl.on('line', (line) => {
  const response = JSON.parse(line);
  responses.push(response);
  
  if (responses.length === 1) {
    // Init response
    console.log('✅ Init:', response.success);
    cli.stdin.write(JSON.stringify({ cmd: 'poll' }) + '\n');
  } else if (responses.length === 2) {
    // Poll response
    console.log('✅ Poll:', response.success);
    fs.writeFileSync('output/memory-poll-response.json', JSON.stringify(response, null, 2));
    console.log('📁 Saved to output/memory-poll-response.json\n');
    
    // Analyze memory hardware
    if (response.success && response.data && response.data.Children) {
      const memoryHw = response.data.Children.filter(h => h.HardwareType === 'Memory');
      console.log(`Found ${memoryHw.length} Memory hardware:`);
      memoryHw.forEach(hw => {
        console.log(`\n${hw.Name} (${hw.Identifier}):`);
        hw.Sensors.forEach(s => {
          console.log(`  - ${s.Name}: ${s.Value} (${s.SensorType})`);
        });
      });
    }
    
    cli.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n');
  }
});

cli.on('spawn', () => {
  cli.stdin.write(JSON.stringify({ cmd: 'init', flags: ['memory'] }) + '\n');
});

cli.on('exit', (code) => {
  console.log(`\n✅ Daemon exited: ${code}`);
});
