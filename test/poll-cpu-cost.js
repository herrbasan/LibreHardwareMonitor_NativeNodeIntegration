/**
 * Measures CPU cost of polling each sensor category.
 * Uses process.cpuUsage() to track user/system CPU time.
 * Run as admin for full hardware access.
 * 
 * Usage: node test/poll-cpu-cost.js
 */

const path = require('path');
const { spawn } = require('child_process');

const distPath = path.resolve(__dirname, '../dist/native-libremon-napi');

// All available sensor categories
const categories = [
  'cpu',
  'gpu', 
  'motherboard',
  'memory',
  'storage',
  'network',
  'psu',
  'controller',
  'battery'
];

const POLL_COUNT = 20;

async function testCategoryInProcess(category) {
  return new Promise((resolve) => {
    const testCode = `
      const path = require('path');
      const os = require('os');
      const distPath = '${distPath.replace(/\\/g, '\\\\')}';
      const monitor = require(distPath);
      
      const config = {
        cpu: false, gpu: false, motherboard: false, memory: false,
        storage: false, network: false, psu: false, controller: false, battery: false
      };
      config['${category}'] = true;
      
      async function run() {
        try {
          monitor.init(config);
          
          // Warmup
          for (let i = 0; i < 3; i++) await monitor.poll();
          
          // Get baseline CPU usage
          const cpusBefore = os.cpus().map(c => ({ ...c.times }));
          const processCpuBefore = process.cpuUsage();
          const startTime = Date.now();
          const startHrTime = process.hrtime.bigint();
          
          // Run polls
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
          
          // Measure CPU usage
          const endHrTime = process.hrtime.bigint();
          const processCpuAfter = process.cpuUsage(processCpuBefore);
          const cpusAfter = os.cpus().map(c => ({ ...c.times }));
          const wallTime = Date.now() - startTime;
          const wallTimeNs = Number(endHrTime - startHrTime);
          
          // Calculate system-wide CPU usage during test
          let totalUser = 0, totalSys = 0, totalIdle = 0;
          for (let i = 0; i < cpusBefore.length; i++) {
            totalUser += cpusAfter[i].user - cpusBefore[i].user;
            totalSys += cpusAfter[i].sys - cpusBefore[i].sys;
            totalIdle += cpusAfter[i].idle - cpusBefore[i].idle;
          }
          
          // Process CPU time (user + system) in microseconds
          const processUserMs = processCpuAfter.user / 1000;
          const processSysMs = processCpuAfter.system / 1000;
          const processTotalMs = processUserMs + processSysMs;
          
          // CPU percentage = (CPU time used / wall time) * 100
          // For multi-core: divide by number of cores to get single-core equivalent
          const numCores = cpusBefore.length;
          const cpuPercent = (processTotalMs / wallTime) * 100;
          const cpuPercentPerCore = cpuPercent / numCores;
          
          // Per-poll metrics
          const wallTimePerPoll = wallTime / ${POLL_COUNT};
          const cpuTimePerPoll = processTotalMs / ${POLL_COUNT};
          
          monitor.shutdown();
          
          console.log(JSON.stringify({
            success: true,
            wallTime,
            wallTimePerPoll: Math.round(wallTimePerPoll * 10) / 10,
            processUserMs: Math.round(processUserMs * 10) / 10,
            processSysMs: Math.round(processSysMs * 10) / 10,
            processTotalMs: Math.round(processTotalMs * 10) / 10,
            cpuTimePerPoll: Math.round(cpuTimePerPoll * 100) / 100,
            cpuPercent: Math.round(cpuPercent * 10) / 10,
            sensorCount,
            hardwareCount,
            numCores
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
    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => {});

    child.on('close', () => {
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          resolve({ category, ...JSON.parse(jsonMatch[0]) });
        } else {
          resolve({ category, success: false, error: 'No output' });
        }
      } catch (err) {
        resolve({ category, success: false, error: err.message });
      }
    });

    setTimeout(() => { child.kill(); resolve({ category, success: false, error: 'Timeout' }); }, 60000);
  });
}

async function testAllCategories() {
  return new Promise((resolve) => {
    const testCode = `
      const path = require('path');
      const os = require('os');
      const distPath = '${distPath.replace(/\\/g, '\\\\')}';
      const monitor = require(distPath);
      
      async function run() {
        try {
          monitor.init({
            cpu: true, gpu: true, motherboard: true, memory: true,
            storage: true, network: true, psu: true, controller: true, battery: true,
            dimmDetection: true
          });
          
          // Warmup
          for (let i = 0; i < 3; i++) await monitor.poll();
          
          const processCpuBefore = process.cpuUsage();
          const startTime = Date.now();
          
          let sensorCount = 0, hardwareCount = 0;
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
            wallTime,
            wallTimePerPoll: Math.round(wallTimePerPoll * 10) / 10,
            processUserMs: Math.round(processUserMs * 10) / 10,
            processSysMs: Math.round(processSysMs * 10) / 10,
            processTotalMs: Math.round(processTotalMs * 10) / 10,
            cpuTimePerPoll: Math.round(cpuTimePerPoll * 100) / 100,
            cpuPercent: Math.round(cpuPercent * 10) / 10,
            sensorCount,
            hardwareCount,
            numCores: os.cpus().length
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
    child.stdout.on('data', (data) => stdout += data.toString());
    child.on('close', () => {
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          resolve({ category: 'ALL', ...JSON.parse(jsonMatch[0]) });
        } else {
          resolve({ category: 'ALL', success: false, error: 'No output' });
        }
      } catch (err) {
        resolve({ category: 'ALL', success: false, error: err.message });
      }
    });

    setTimeout(() => { child.kill(); resolve({ category: 'ALL', success: false, error: 'Timeout' }); }, 120000);
  });
}

async function runAllTests() {
  console.log('=== Sensor Category CPU Cost Benchmark ===');
  console.log(`Running ${POLL_COUNT} polls per category\n`);

  const results = [];

  for (const category of categories) {
    process.stdout.write(`Testing ${category.padEnd(12)}... `);
    const result = await testCategoryInProcess(category);
    results.push(result);

    if (result.success) {
      console.log(`wall: ${result.wallTimePerPoll}ms/poll, cpu: ${result.cpuTimePerPoll}ms/poll (${result.cpuPercent}% CPU)`);
    } else {
      console.log(`FAILED: ${result.error}`);
    }
  }

  // Test all combined
  process.stdout.write(`Testing ALL         ... `);
  const allResult = await testAllCategories();
  results.push(allResult);
  if (allResult.success) {
    console.log(`wall: ${allResult.wallTimePerPoll}ms/poll, cpu: ${allResult.cpuTimePerPoll}ms/poll (${allResult.cpuPercent}% CPU)`);
  } else {
    console.log(`FAILED: ${allResult.error}`);
  }

  // Summary table
  console.log('\n=== Summary (sorted by CPU time per poll) ===\n');
  
  const successful = results.filter(r => r.success);
  successful.sort((a, b) => b.cpuTimePerPoll - a.cpuTimePerPoll);

  console.log('Category      | Wall (ms) | CPU (ms) | CPU %  | Sensors | Efficiency');
  console.log('--------------|-----------|----------|--------|---------|------------');

  for (const r of successful) {
    const cat = r.category.padEnd(13);
    const wall = r.wallTimePerPoll.toString().padStart(9);
    const cpu = r.cpuTimePerPoll.toString().padStart(8);
    const pct = (r.cpuPercent.toString() + '%').padStart(6);
    const sensors = r.sensorCount.toString().padStart(7);
    
    // Efficiency: how much wall time is NOT CPU time (waiting for I/O, drivers, etc.)
    const efficiency = ((r.cpuTimePerPoll / r.wallTimePerPoll) * 100).toFixed(1) + '%';
    
    console.log(`${cat} | ${wall} | ${cpu} | ${pct} | ${sensors} | ${efficiency.padStart(10)}`);
  }

  console.log('\n=== Analysis ===\n');
  console.log('CPU Time = actual CPU cycles used by our process');
  console.log('Wall Time = real-world time elapsed (includes I/O waits, driver calls)');
  console.log('Efficiency = CPU Time / Wall Time (higher = more CPU-bound, lower = more I/O-bound)');
  console.log('');
  
  const cpuResult = results.find(r => r.category === 'cpu');
  const gpuResult = results.find(r => r.category === 'gpu');
  
  if (cpuResult?.success && gpuResult?.success) {
    console.log('Observations:');
    console.log(`  - CPU category: ${cpuResult.cpuTimePerPoll}ms CPU time for ${cpuResult.wallTimePerPoll}ms wall time`);
    console.log(`    → ${((cpuResult.cpuTimePerPoll / cpuResult.wallTimePerPoll) * 100).toFixed(0)}% CPU-bound (MSR reads are fast but require thread affinity)`);
    console.log(`  - GPU category: ${gpuResult.cpuTimePerPoll}ms CPU time for ${gpuResult.wallTimePerPoll}ms wall time`);
    console.log(`    → ${((gpuResult.cpuTimePerPoll / gpuResult.wallTimePerPoll) * 100).toFixed(0)}% CPU-bound (waiting on GPU driver calls)`);
  }

  console.log('\nDone.');
}

runAllTests().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
