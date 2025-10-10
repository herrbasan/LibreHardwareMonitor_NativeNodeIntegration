const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const exePath = path.join(__dirname, 'dist', 'LibreMonCLI.exe');

console.log('='.repeat(80));
console.log('Testing FLAT MODE - Transformed Output (smaller, easier to consume)');
console.log('='.repeat(80));
console.log('Executable:', exePath);
console.log('='.repeat(80));
console.log('\nStarting daemon...\n');

const startTime = Date.now();
const daemon = spawn(exePath, ['--daemon']);

console.log('Process spawned with PID:', daemon.pid);
console.log('Command:', exePath, '--daemon');
console.log('');

const rl = readline.createInterface({
  input: daemon.stdout,
  crlfDelay: Infinity
});

daemon.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) {
    console.error('🔴 STDERR:', msg);
  }
});

let responseCount = 0;

rl.on('line', (line) => {
  responseCount++;
  const elapsed = Date.now() - startTime;
  
  try {
    const response = JSON.parse(line);
    
    if (response.success) {
      console.log(`✅ Response ${responseCount} (${elapsed}ms):`);
      
      if (response.data) {
        console.log('   Mode:', response.mode);
        console.log('   Timestamp:', response.timestamp);
        
        if (response.mode === 'flat' && response.data.hardware) {
          const hardwareTypes = Object.keys(response.data.hardware);
          console.log('   Hardware types:', hardwareTypes.join(', '));
          
          // Count total hardware devices
          let totalDevices = 0;
          hardwareTypes.forEach(type => {
            totalDevices += response.data.hardware[type].length;
          });
          console.log('   Total hardware devices:', totalDevices);
          
          // Show first hardware device in detail
          if (hardwareTypes.length > 0) {
            const firstType = hardwareTypes[0];
            const firstDevice = response.data.hardware[firstType][0];
            
            console.log('\n   📊 Example Hardware:', firstDevice.name);
            console.log('      Type:', firstType);
            console.log('      Slug:', firstDevice.slug);
            console.log('      ID:', firstDevice.id);
            
            if (firstDevice.sensorGroups) {
              const groups = Object.keys(firstDevice.sensorGroups);
              console.log('      Sensor Groups:', groups.join(', '));
              
              // Show first sensor from first group
              const firstGroup = groups[0];
              if (firstGroup && firstDevice.sensorGroups[firstGroup]?.sensors) {
                const sensors = Object.keys(firstDevice.sensorGroups[firstGroup].sensors);
                console.log(`\n      Example Sensor (${firstGroup}):`);
                const firstSensor = firstDevice.sensorGroups[firstGroup].sensors[sensors[0]];
                console.log('        Name:', firstSensor.name);
                console.log('        Slug:', firstSensor.slug);
                console.log('        Value:', firstSensor.value?.value, firstSensor.value?.type);
                console.log('        Min:', firstSensor.min?.value, firstSensor.min?.type);
                console.log('        Max:', firstSensor.max?.value, firstSensor.max?.type);
              }
            }
          }
          
          // Count total sensors
          let totalSensors = 0;
          hardwareTypes.forEach(hwType => {
            response.data.hardware[hwType].forEach(hw => {
              if (hw.sensorGroups) {
                Object.values(hw.sensorGroups).forEach(group => {
                  if (group.sensors) {
                    totalSensors += Object.keys(group.sensors).length;
                  }
                });
              }
            });
          });
          console.log(`\n   📈 Total sensors across all hardware: ${totalSensors}`);
          
          // Show output size
          const jsonSize = JSON.stringify(response).length;
          console.log(`   📦 Response size: ${(jsonSize / 1024).toFixed(2)} KB`);
        }
      } else {
        console.log('   Message:', response.message || 'OK');
      }
    } else {
      console.log(`❌ Error ${responseCount} (${elapsed}ms):`, response.error);
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    console.error('Raw line:', line.substring(0, 200) + '...');
  }
});

daemon.on('exit', (code) => {
  const totalTime = Date.now() - startTime;
  console.log('\n' + '='.repeat(80));
  console.log(`Daemon exited with code: ${code} (Total time: ${totalTime}ms)`);
  console.log('='.repeat(80));
  process.exit(code);
});

// Test sequence with FLAT MODE enabled
setTimeout(() => {
  console.log('📤 Sending INIT command with FLAT MODE enabled...\n');
  daemon.stdin.write('{"cmd":"init","flags":["cpu","gpu"],"flat":true}\n');
  
  setTimeout(() => {
    console.log('\n📤 Sending POLL command...\n');
    daemon.stdin.write('{"cmd":"poll"}\n');
    
    setTimeout(() => {
      console.log('\n📤 Sending SHUTDOWN command...\n');
      daemon.stdin.write('{"cmd":"shutdown"}\n');
      
      setTimeout(() => {
        process.exit(0);
      }, 500);
    }, 1000);
  }, 1000);
}, 500);
