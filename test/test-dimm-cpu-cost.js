/**
 * Compare CPU cost with and without dimmDetection.
 * Run as admin for full hardware access.
 */

const path = require('path');
const { spawn } = require('child_process');

const distPath = path.resolve(__dirname, '../dist/native-libremon-napi');
const POLL_COUNT = 50;

async function testMemoryCPU(dimmDetection) {
  return new Promise((resolve) => {
    const testCode = `
      const path = require('path');
      const os = require('os');
      const distPath = '${distPath.replace(/\\/g, '\\\\')}';
      const monitor = require(distPath);
      
      async function run() {
        try {
          monitor.init({
            cpu: false, gpu: false, motherboard: false,
            memory: true,
            storage: false, network: false, psu: false,
            controller: false, battery: false,
            dimmDetection: ${dimmDetection}
          });
          
          // Warmup
          for (let i = 0; i < 3; i++) await monitor.poll();
          
          const processCpuBefore = process.cpuUsage();
          const startTime = Date.now();
          
          let sensorCount = 0;
          let hardwareCount = 0;
          
          for (let i = 0; i < ${POLL_COUNT}; i++) {
            const data = await monitor.poll();
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
              hardwareCount = data.Children?.[0]?.Children?.length || 0;
            }
          }
          
          const processCpuAfter = process.cpuUsage(processCpuBefore);
          const wallTime = Date.now() - startTime;
          
          const processUserMs = processCpuAfter.user / 1000;
          const processSysMs = processCpuAfter.system / 1000;
          const processTotalMs = processUserMs + processSysMs;
          const wallTimePerPoll = wallTime / ${POLL_COUNT};
          const cpuTimePerPoll = processTotalMs / ${POLL_COUNT};
          const cpuPercent = (processTotalMs / wallTime) * 100;
          
          monitor.shutdown();
          
          console.log(JSON.stringify({
            success: true,
            dimmDetection: ${dimmDetection},
            wallTime,
            wallTimePerPoll: Math.round(wallTimePerPoll * 100) / 100,
            cpuTimePerPoll: Math.round(cpuTimePerPoll * 100) / 100,
            cpuPercent: Math.round(cpuPercent * 10) / 10,
            sensorCount,
            hardwareCount
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
    
    setTimeout(() => { child.kill(); resolve({ success: false, error: 'Timeout' }); }, 60000);
  });
}

async function main() {
  console.log('=== CPU Cost: dimmDetection Comparison ===');
  console.log(`Running ${POLL_COUNT} polls per test\n`);

  console.log('Testing with dimmDetection: false...');
  const noDetect = await testMemoryCPU(false);
  
  console.log('Testing with dimmDetection: true...');
  const withDetect = await testMemoryCPU(true);

  console.log('\n=== Results ===\n');
  
  console.log('                        | dimmDetection: false | dimmDetection: true');
  console.log('------------------------|----------------------|---------------------');
  
  if (noDetect.success && withDetect.success) {
    console.log(`Wall time/poll          | ${noDetect.wallTimePerPoll.toString().padStart(17)}ms | ${withDetect.wallTimePerPoll.toString().padStart(16)}ms`);
    console.log(`CPU time/poll           | ${noDetect.cpuTimePerPoll.toString().padStart(17)}ms | ${withDetect.cpuTimePerPoll.toString().padStart(16)}ms`);
    console.log(`CPU %                   | ${(noDetect.cpuPercent + '%').padStart(18)} | ${(withDetect.cpuPercent + '%').padStart(17)}`);
    console.log(`Sensors                 | ${noDetect.sensorCount.toString().padStart(18)} | ${withDetect.sensorCount.toString().padStart(17)}`);
    console.log(`Hardware items          | ${noDetect.hardwareCount.toString().padStart(18)} | ${withDetect.hardwareCount.toString().padStart(17)}`);
    
    console.log('\n=== Savings ===');
    const cpuSaved = withDetect.cpuTimePerPoll - noDetect.cpuTimePerPoll;
    const wallSaved = withDetect.wallTimePerPoll - noDetect.wallTimePerPoll;
    console.log(`CPU time saved:  ${cpuSaved.toFixed(2)}ms per poll (${((cpuSaved / withDetect.cpuTimePerPoll) * 100).toFixed(0)}% reduction)`);
    console.log(`Wall time saved: ${wallSaved.toFixed(2)}ms per poll`);
  } else {
    if (!noDetect.success) console.log(`dimmDetection: false FAILED: ${noDetect.error}`);
    if (!withDetect.success) console.log(`dimmDetection: true FAILED: ${withDetect.error}`);
  }

  console.log('\nDone.');
}

main().catch(console.error);
