const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('Testing CPU + Storage together...\n');

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
    fs.writeFileSync('output/cpu-storage-poll.json', JSON.stringify(response, null, 2));
    console.log('📁 Saved to output/cpu-storage-poll.json');
    
    if (response.success && response.data && response.data.children) {
      // Parse web endpoint format
      const devices = [];
      const traverse = (node, depth = 0) => {
        if (node.text && depth > 0) {
          devices.push({ text: node.text, id: node.id, imageURL: node.imageURL || '' });
        }
        if (node.children) {
          node.children.forEach(child => traverse(child, depth + 1));
        }
      };
      traverse(response.data);
      
      console.log(`\nDetected ${devices.length} hardware components:\n`);
      devices.slice(0, 10).forEach(d => {
        const icon = d.imageURL.includes('cpu') ? '🔥' : 
                     d.imageURL.includes('hdd') ? '💾' :
                     d.imageURL.includes('ssd') ? '⚡' :
                     d.imageURL.includes('nvme') ? '🚀' :
                     d.imageURL.includes('ram') ? '🧠' : '📊';
        console.log(`${icon} ${d.text} (${d.id})`);
      });
    }
    
    cli.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n');
  }
});

cli.on('spawn', () => {
  cli.stdin.write(JSON.stringify({ cmd: 'init', flags: ['cpu', 'storage'] }) + '\n');
});

cli.on('exit', (code) => {
  console.log(`\n✅ Daemon exited: ${code}`);
});
