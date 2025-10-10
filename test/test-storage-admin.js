/**
 * Test storage monitoring WITH administrator privileges
 * 
 * This file should be run from an elevated PowerShell:
 *   Start-Process powershell -Verb RunAs -ArgumentList "-Command `"cd '$PWD'; node test/test-storage-admin.js`""
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DAEMON_PATH = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

async function testStorage() {
  console.log('Testing storage detection (should be running as admin)...\n');

  const daemon = spawn(DAEMON_PATH, ['--daemon']);
  
  let response = null;

  daemon.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    lines.forEach(line => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);
        if (msg.success && msg.data) {
          response = msg;
        }
      } catch (e) {
        // Ignore
      }
    });
  });

  // Send init + poll
  daemon.stdin.write('{"cmd":"init","flags":["storage"]}\n');
  await new Promise(resolve => setTimeout(resolve, 1000));
  daemon.stdin.write('{"cmd":"poll"}\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  daemon.stdin.write('{"cmd":"shutdown"}\n');
  await new Promise(resolve => setTimeout(resolve, 500));
  daemon.kill();

  if (response) {
    // Count storage devices
    let count = 0;
    const traverse = (node) => {
      if (node.imageURL) {
        const img = node.imageURL.toLowerCase();
        if (img.includes('hdd') || img.includes('ssd') || img.includes('nvme')) {
          count++;
          console.log(`✅ Found: ${node.text} (${node.imageURL})`);
        }
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(response.data);

    console.log(`\nTotal storage devices detected: ${count}`);

    // Save response
    const outputPath = path.join(__dirname, 'output', 'storage-admin-test.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(response, null, 2));
    console.log(`Response saved to: ${outputPath}`);

    if (count > 0) {
      console.log('\n✅ SUCCESS: Storage detection works with admin privileges!');
    } else {
      console.log('\n❌ FAILURE: Still no storage devices detected even with admin!');
    }
  } else {
    console.log('❌ No response from daemon');
  }
}

testStorage().catch(console.error);
