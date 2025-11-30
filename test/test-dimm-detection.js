/**
 * Test dimmDetection flag - compares memory with and without DIMM detection.
 * Requires running in separate processes since CLR can't reinit.
 * Run as admin for full hardware access.
 */

const path = require('path');
const { spawn } = require('child_process');

const distPath = path.resolve(__dirname, '../dist/native-libremon-napi');

async function testMemory(dimmDetection) {
  return new Promise((resolve) => {
    const testCode = `
      const path = require('path');
      const distPath = '${distPath.replace(/\\/g, '\\\\')}';
      const monitor = require(distPath);
      
      async function run() {
        try {
          const initStart = Date.now();
          monitor.init({
            cpu: false, gpu: false, motherboard: false,
            memory: true,
            storage: false, network: false, psu: false,
            controller: false, battery: false,
            dimmDetection: ${dimmDetection}
          });
          const initTime = Date.now() - initStart;
          
          // Warmup
          await monitor.poll();
          
          // Measure
          const pollTimes = [];
          let sensorCount = 0;
          let hardwareCount = 0;
          let hardwareNames = [];
          
          for (let i = 0; i < 50; i++) {
            const start = Date.now();
            const data = await monitor.poll();
            pollTimes.push(Date.now() - start);
            
            if (i === 0) {
              function countSensors(node) {
                let count = 0;
                if (node.Value && node.Value !== 'Value') count++;
                if (node.Children) {
                  for (const child of node.Children) count += countSensors(child);
                }
                return count;
              }
              sensorCount = countSensors(data);
              
              if (data.Children?.[0]?.Children) {
                hardwareCount = data.Children[0].Children.length;
                hardwareNames = data.Children[0].Children.map(h => h.Text);
              }
            }
          }
          
          monitor.shutdown();
          
          const avg = pollTimes.reduce((a,b) => a+b, 0) / pollTimes.length;
          console.log(JSON.stringify({
            success: true,
            dimmDetection: ${dimmDetection},
            initTime,
            avgPollTime: Math.round(avg),
            sensorCount,
            hardwareCount,
            hardwareNames
          }));
        } catch (err) {
          console.log(JSON.stringify({ success: false, error: err.message }));
        }
      }
      run();
    `;

    const child = spawn('node', ['-e', testCode], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname
    });

    let stdout = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.on('close', () => {
      try {
        const match = stdout.match(/\{[\s\S]*\}/);
        if (match) resolve(JSON.parse(match[0]));
        else resolve({ success: false, error: 'No output' });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
    
    setTimeout(() => { child.kill(); resolve({ success: false, error: 'Timeout' }); }, 30000);
  });
}

async function main() {
  console.log('=== Testing dimmDetection Flag ===\n');

  console.log('Testing with dimmDetection: false...');
  const noDetect = await testMemory(false);
  
  console.log('Testing with dimmDetection: true...');
  const withDetect = await testMemory(true);

  console.log('\n=== Results ===\n');
  
  console.log('dimmDetection: false');
  if (noDetect.success) {
    console.log(`  Init time:    ${noDetect.initTime}ms`);
    console.log(`  Avg poll:     ${noDetect.avgPollTime}ms`);
    console.log(`  Hardware:     ${noDetect.hardwareCount} items`);
    console.log(`  Sensors:      ${noDetect.sensorCount}`);
    console.log(`  Items:        ${noDetect.hardwareNames.join(', ')}`);
  } else {
    console.log(`  ERROR: ${noDetect.error}`);
  }

  console.log('\ndimmDetection: true');
  if (withDetect.success) {
    console.log(`  Init time:    ${withDetect.initTime}ms`);
    console.log(`  Avg poll:     ${withDetect.avgPollTime}ms`);
    console.log(`  Hardware:     ${withDetect.hardwareCount} items`);
    console.log(`  Sensors:      ${withDetect.sensorCount}`);
    console.log(`  Items:        ${withDetect.hardwareNames.join(', ')}`);
  } else {
    console.log(`  ERROR: ${withDetect.error}`);
  }

  if (noDetect.success && withDetect.success) {
    console.log('\n=== Comparison ===');
    console.log(`  Init speedup:     ${withDetect.initTime}ms → ${noDetect.initTime}ms (${((1 - noDetect.initTime/withDetect.initTime) * 100).toFixed(0)}% faster)`);
    console.log(`  Poll speedup:     ${withDetect.avgPollTime}ms → ${noDetect.avgPollTime}ms`);
    console.log(`  Hardware reduced: ${withDetect.hardwareCount} → ${noDetect.hardwareCount} items`);
    console.log(`  Sensors reduced:  ${withDetect.sensorCount} → ${noDetect.sensorCount}`);
  }

  console.log('\nDone.');
}

main().catch(console.error);
