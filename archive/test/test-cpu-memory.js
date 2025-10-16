const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('Testing CPU + Memory together...\n');

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
    console.log('✅ Init:', response.success);
    cli.stdin.write(JSON.stringify({ cmd: 'poll' }) + '\n');
  } else if (responses.length === 2) {
    console.log('✅ Poll:', response.success);
    fs.writeFileSync('output/cpu-memory-poll.json', JSON.stringify(response, null, 2));
    
    if (response.success && response.data && response.data.Children) {
      console.log(`\nHardware detected: ${response.data.Children.length} devices\n`);
      response.data.Children.forEach(hw => {
        console.log(`${hw.Name} (${hw.HardwareType}):`);
        if (hw.Sensors && hw.Sensors.length > 0) {
          hw.Sensors.slice(0, 3).forEach(s => {
            console.log(`  - ${s.Name}: ${s.Value}`);
          });
          if (hw.Sensors.length > 3) {
            console.log(`  ... and ${hw.Sensors.length - 3} more sensors`);
          }
        } else {
          console.log('  (no sensors)');
        }
      });
    }
    
    cli.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n');
  }
});

cli.on('spawn', () => {
  cli.stdin.write(JSON.stringify({ cmd: 'init', flags: ['cpu', 'memory'] }) + '\n');
});

cli.on('exit', (code) => {
  console.log(`\n✅ Daemon exited: ${code}`);
});
