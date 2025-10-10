const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

const categories = [
  'cpu',
  'gpu', 
  'motherboard',
  'memory',
  'storage',
  'network',
  'psu',
  'controller'
];

console.log('='.repeat(80));
console.log('Testing All Hardware Categories');
console.log('='.repeat(80));
console.log('');

let currentIndex = 0;
const results = {};

function testCategory(category) {
  return new Promise((resolve) => {
    console.log(`Testing: ${category}...`);
    
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
        if (!response.success) {
          results[category] = { status: 'INIT_FAILED', error: response.message };
          cli.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n');
          return;
        }
        cli.stdin.write(JSON.stringify({ cmd: 'poll' }) + '\n');
      } else if (responses.length === 2) {
        // Poll response
        if (!response.success) {
          results[category] = { status: 'POLL_FAILED', error: response.message };
        } else {
          // Count detected devices
          let deviceCount = 0;
          const traverse = (node, depth = 0) => {
            if (node.imageURL && depth > 1) { // Skip root nodes
              deviceCount++;
            }
            if (node.children) {
              node.children.forEach(child => traverse(child, depth + 1));
            }
          };
          
          if (response.data && response.data.children) {
            traverse(response.data);
          }
          
          // Save poll response for debugging
          fs.writeFileSync(`output/poll-${category}.json`, JSON.stringify(response, null, 2));
          
          results[category] = { 
            status: deviceCount > 0 ? 'WORKING' : 'NO_DEVICES',
            deviceCount 
          };
        }
        
        cli.stdin.write(JSON.stringify({ cmd: 'shutdown' }) + '\n');
      }
    });
    
    cli.on('exit', () => {
      resolve();
    });
    
    cli.on('spawn', () => {
      cli.stdin.write(JSON.stringify({ cmd: 'init', flags: [category] }) + '\n');
    });
    
    cli.stderr.on('data', (data) => {
      // Capture any errors
      if (!results[category]) {
        results[category] = { status: 'ERROR', error: data.toString() };
      }
    });
  });
}

async function runAllTests() {
  for (const category of categories) {
    await testCategory(category);
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('Results Summary');
  console.log('='.repeat(80));
  console.log('');
  
  categories.forEach(cat => {
    const result = results[cat];
    const icon = result.status === 'WORKING' ? '✅' : 
                 result.status === 'NO_DEVICES' ? '⚠️' :
                 '❌';
    
    let details = '';
    if (result.status === 'WORKING') {
      details = `${result.deviceCount} device(s) detected`;
    } else if (result.status === 'NO_DEVICES') {
      details = 'Initialized but no devices found';
    } else if (result.error) {
      details = result.error.substring(0, 60);
    }
    
    console.log(`${icon} ${cat.padEnd(15)} ${result.status.padEnd(15)} ${details}`);
  });
  
  // Save detailed results
  fs.writeFileSync('output/category-test-results.json', JSON.stringify(results, null, 2));
  console.log('');
  console.log('📁 Detailed results saved to output/category-test-results.json');
}

runAllTests().catch(console.error);
