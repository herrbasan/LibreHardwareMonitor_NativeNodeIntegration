const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('Testing storage monitoring...\n');

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
    if (!response.success) {
      console.log('❌ Error:', response.message);
    }
    cli.stdin.write(JSON.stringify({ cmd: 'poll' }) + '\n');
  } else if (responses.length === 2) {
    console.log('✅ Poll:', response.success);
    fs.writeFileSync('output/storage-poll.json', JSON.stringify(response, null, 2));
    
    if (response.success && response.data && response.data.children) {
      // Find storage hardware in web endpoint format (nested structure)
      const findStorage = (node) => {
        const results = [];
        if (node.text && (node.text.includes('Storage') || node.text.includes('SSD') || node.text.includes('HDD') || node.text.includes('NVMe'))) {
          results.push(node);
        }
        if (node.children) {
          node.children.forEach(child => results.push(...findStorage(child)));
        }
        return results;
      };
      
      const storageDevices = findStorage(response.data);
      console.log(`\nFound ${storageDevices.length} storage device(s):\n`);
      
      storageDevices.forEach(device => {
        console.log(`${device.text} (ID: ${device.id})`);
        if (device.children) {
          console.log(`  - Has ${device.children.length} sensor groups`);
        }
      });
    }
    
    cli.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n');
  }
});

cli.on('spawn', () => {
  console.log('Daemon started, testing storage flag...');
  cli.stdin.write(JSON.stringify({ cmd: 'init', flags: ['storage'] }) + '\n');
});

cli.on('exit', (code) => {
  console.log(`\n✅ Daemon exited: ${code}`);
});
