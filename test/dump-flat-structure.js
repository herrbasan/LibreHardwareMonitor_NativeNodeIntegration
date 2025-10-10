const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('Capturing flat mode JSON structure...\n');

const daemon = spawn(exePath, ['--daemon']);

const rl = readline.createInterface({
  input: daemon.stdout,
  crlfDelay: Infinity
});

let responseCount = 0;

rl.on('line', (line) => {
  responseCount++;
  
  try {
    const response = JSON.parse(line);
    
    if (response.success && response.data && response.mode === 'flat') {
      console.log('Flat mode JSON structure captured!');
      console.log('Writing to test/output/flat-structure.json...\n');
      
      // Save full JSON
      fs.mkdirSync('output', { recursive: true });
      fs.writeFileSync('output/flat-structure.json', JSON.stringify(response.data, null, 2));
      
      // Show structure overview
      console.log('Hardware types:', Object.keys(response.data.hardware).join(', '));
      
      // Show first hardware device structure
      const firstType = Object.keys(response.data.hardware)[0];
      const firstDevice = response.data.hardware[firstType][0];
      
      console.log(`\nExample device (${firstType}):`, firstDevice.name);
      console.log('Device keys:', Object.keys(firstDevice).join(', '));
      
      if (firstDevice.sensorGroups) {
        const firstGroup = Object.keys(firstDevice.sensorGroups)[0];
        console.log(`\nFirst sensor group: "${firstGroup}"`);
        console.log('Group keys:', Object.keys(firstDevice.sensorGroups[firstGroup]).join(', '));
        
        if (firstDevice.sensorGroups[firstGroup].sensors) {
          const firstSensor = Object.keys(firstDevice.sensorGroups[firstGroup].sensors)[0];
          console.log(`\nFirst sensor: "${firstSensor}"`);
          console.log('Sensor structure:');
          console.log(JSON.stringify(firstDevice.sensorGroups[firstGroup].sensors[firstSensor], null, 2));
        }
      }
      
      daemon.stdin.write('{"cmd":"shutdown"}\n');
    }
  } catch (e) {
    console.error('Parse error:', e.message);
  }
});

daemon.on('exit', () => {
  console.log('\nDone! Check test/output/flat-structure.json for full output.');
  process.exit(0);
});

setTimeout(() => {
  daemon.stdin.write('{"cmd":"init","flags":["cpu","gpu"],"flat":true}\n');
  setTimeout(() => {
    daemon.stdin.write('{"cmd":"poll"}\n');
  }, 1000);
}, 500);
