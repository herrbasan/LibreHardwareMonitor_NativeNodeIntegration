const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('Detailed Storage Device Test\n');

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
    console.log('✅ Init successful');
    cli.stdin.write(JSON.stringify({ cmd: 'poll' }) + '\n');
  } else if (responses.length === 2) {
    console.log('✅ Poll successful\n');
    
    fs.writeFileSync('output/storage-detailed.json', JSON.stringify(response, null, 2));
    
    // Recursively find all storage-related nodes
    const findNodes = (node, parent = null) => {
      const results = [];
      
      // Check if this looks like a storage device
      const text = (node.text || '').toLowerCase();
      const id = (node.id || '').toLowerCase();
      const hasStorageIndicators = text.includes('storage') || text.includes('ssd') || 
                                   text.includes('hdd') || text.includes('nvme') ||
                                   id.includes('storage') || id.includes('hdd') || 
                                   id.includes('ssd') || id.includes('nvme');
      
      if (hasStorageIndicators && node.text) {
        results.push({
          text: node.text,
          id: node.id,
          parent: parent ? parent.text : null,
          hasChildren: node.children && node.children.length > 0,
          childCount: node.children ? node.children.length : 0
        });
      }
      
      if (node.children) {
        node.children.forEach(child => {
          results.push(...findNodes(child, node));
        });
      }
      
      return results;
    };
    
    if (response.data) {
      const storageNodes = findNodes(response.data);
      
      console.log(`Found ${storageNodes.length} storage-related nodes:\n`);
      storageNodes.forEach((node, idx) => {
        console.log(`${idx + 1}. ${node.text}`);
        console.log(`   ID: ${node.id}`);
        if (node.parent) console.log(`   Parent: ${node.parent}`);
        console.log(`   Children: ${node.childCount}`);
        console.log('');
      });
    }
    
    cli.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n');
  }
});

cli.on('spawn', () => {
  cli.stdin.write(JSON.stringify({ cmd: 'init', flags: ['storage'] }) + '\n');
});

cli.on('exit', (code) => {
  console.log(`Daemon exited: ${code}`);
});
