/**
 * Tests polling speed for each sensor category individually.
 * Measures how long each category takes to return data.
 * Run as admin for full hardware access.
 * 
 * Usage: node test/poll-speed-test.js
 */

const path = require('path');
const { execSync, spawn } = require('child_process');

// Since CLR can't be reinitialized, we need to run each test in a separate process
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

// Number of polls to average
const POLL_COUNT = 20;

// Test a single category in isolation
async function testCategoryInProcess(category) {
  return new Promise((resolve) => {
    const testCode = `
      const path = require('path');
      const distPath = '${distPath.replace(/\\/g, '\\\\')}';
      const monitor = require(distPath);
      
      const config = {
        cpu: false,
        gpu: false,
        motherboard: false,
        memory: false,
        storage: false,
        network: false,
        psu: false,
        controller: false,
        battery: false
      };
      config['${category}'] = true;
      
      async function run() {
        try {
          const initStart = Date.now();
          monitor.init(config);
          const initTime = Date.now() - initStart;
          
          const pollTimes = [];
          let sensorCount = 0;
          let hardwareCount = 0;
          
          for (let i = 0; i < ${POLL_COUNT}; i++) {
            const pollStart = Date.now();
            const data = await monitor.poll();
            const pollTime = Date.now() - pollStart;
            pollTimes.push(pollTime);
            
            // Count sensors and hardware on first poll
            if (i === 0) {
              function countSensors(node) {
                let count = 0;
                if (node.Value && node.Value !== 'Value') count++;
                if (node.Children) {
                  for (const child of node.Children) {
                    count += countSensors(child);
                  }
                }
                return count;
              }
              
              sensorCount = countSensors(data);
              hardwareCount = data.Children?.[0]?.Children?.length || 0;
            }
          }
          
          monitor.shutdown();
          
          const avgPollTime = pollTimes.reduce((a, b) => a + b, 0) / pollTimes.length;
          const minPollTime = Math.min(...pollTimes);
          const maxPollTime = Math.max(...pollTimes);
          
          console.log(JSON.stringify({
            success: true,
            initTime,
            avgPollTime: Math.round(avgPollTime),
            minPollTime,
            maxPollTime,
            pollTimes,
            sensorCount,
            hardwareCount
          }));
        } catch (err) {
          console.log(JSON.stringify({
            success: false,
            error: err.message
          }));
        }
      }
      
      run();
    `;

    const child = spawn('node', ['-e', testCode], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        // Find JSON in output (skip any preceding output)
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          resolve({ category, ...result });
        } else {
          resolve({ 
            category, 
            success: false, 
            error: stderr || 'No output received',
            stdout 
          });
        }
      } catch (err) {
        resolve({ 
          category, 
          success: false, 
          error: `Parse error: ${err.message}`,
          stdout,
          stderr 
        });
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      resolve({ category, success: false, error: 'Timeout (30s)' });
    }, 30000);
  });
}

async function runAllTests() {
  console.log('=== Sensor Category Poll Speed Test ===');
  console.log(`Testing ${categories.length} categories with ${POLL_COUNT} polls each`);
  console.log('Running each category in separate process (CLR limitation)\n');

  const results = [];

  for (const category of categories) {
    process.stdout.write(`Testing ${category.padEnd(12)}... `);
    const result = await testCategoryInProcess(category);
    results.push(result);

    if (result.success) {
      console.log(`avg: ${result.avgPollTime}ms, init: ${result.initTime}ms, sensors: ${result.sensorCount}, hw: ${result.hardwareCount}`);
    } else {
      console.log(`FAILED: ${result.error}`);
    }
  }

  // Print summary table
  console.log('\n=== Summary (sorted by avg poll time) ===\n');
  
  const successful = results.filter(r => r.success);
  successful.sort((a, b) => b.avgPollTime - a.avgPollTime);

  console.log('Category      | Init (ms) | Avg Poll | Min Poll | Max Poll | Sensors | Hardware');
  console.log('--------------|-----------|----------|----------|----------|---------|----------');

  for (const r of successful) {
    const cat = r.category.padEnd(13);
    const init = r.initTime.toString().padStart(9);
    const avg = r.avgPollTime.toString().padStart(8);
    const min = r.minPollTime.toString().padStart(8);
    const max = r.maxPollTime.toString().padStart(8);
    const sensors = r.sensorCount.toString().padStart(7);
    const hw = r.hardwareCount.toString().padStart(8);
    console.log(`${cat} | ${init} | ${avg} | ${min} | ${max} | ${sensors} | ${hw}`);
  }

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('\nFailed categories:');
    for (const r of failed) {
      console.log(`  ${r.category}: ${r.error}`);
    }
  }

  // Test combined categories
  console.log('\n=== Testing Combined Categories ===\n');
  
  const combinations = [
    { name: 'cpu+gpu', config: { cpu: true, gpu: true, motherboard: true } },
    { name: 'all-fast', config: { cpu: true, gpu: true, motherboard: true, network: true } },
    { name: 'all', config: { cpu: true, gpu: true, motherboard: true, memory: true, storage: true, network: true, psu: true, controller: true, battery: true } }
  ];

  for (const combo of combinations) {
    process.stdout.write(`Testing ${combo.name.padEnd(12)}... `);
    const result = await testCombinedInProcess(combo.name, combo.config);
    
    if (result.success) {
      console.log(`avg: ${result.avgPollTime}ms, init: ${result.initTime}ms, sensors: ${result.sensorCount}, hw: ${result.hardwareCount}`);
    } else {
      console.log(`FAILED: ${result.error}`);
    }
  }

  console.log('\nDone.');
}

async function testCombinedInProcess(name, config) {
  return new Promise((resolve) => {
    const configStr = JSON.stringify(config);
    const testCode = `
      const path = require('path');
      const distPath = '${distPath.replace(/\\/g, '\\\\')}';
      const monitor = require(distPath);
      
      const config = ${configStr};
      
      async function run() {
        try {
          const initStart = Date.now();
          monitor.init(config);
          const initTime = Date.now() - initStart;
          
          const pollTimes = [];
          let sensorCount = 0;
          let hardwareCount = 0;
          
          for (let i = 0; i < ${POLL_COUNT}; i++) {
            const pollStart = Date.now();
            const data = await monitor.poll();
            const pollTime = Date.now() - pollStart;
            pollTimes.push(pollTime);
            
            if (i === 0) {
              function countSensors(node) {
                let count = 0;
                if (node.Value && node.Value !== 'Value') count++;
                if (node.Children) {
                  for (const child of node.Children) {
                    count += countSensors(child);
                  }
                }
                return count;
              }
              
              sensorCount = countSensors(data);
              hardwareCount = data.Children?.[0]?.Children?.length || 0;
            }
          }
          
          monitor.shutdown();
          
          const avgPollTime = pollTimes.reduce((a, b) => a + b, 0) / pollTimes.length;
          const minPollTime = Math.min(...pollTimes);
          const maxPollTime = Math.max(...pollTimes);
          
          console.log(JSON.stringify({
            success: true,
            initTime,
            avgPollTime: Math.round(avgPollTime),
            minPollTime,
            maxPollTime,
            pollTimes,
            sensorCount,
            hardwareCount
          }));
        } catch (err) {
          console.log(JSON.stringify({
            success: false,
            error: err.message
          }));
        }
      }
      
      run();
    `;

    const child = spawn('node', ['-e', testCode], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          resolve({ name, ...result });
        } else {
          resolve({ name, success: false, error: stderr || 'No output received' });
        }
      } catch (err) {
        resolve({ name, success: false, error: `Parse error: ${err.message}` });
      }
    });

    setTimeout(() => {
      child.kill();
      resolve({ name, success: false, error: 'Timeout (30s)' });
    }, 30000);
  });
}

runAllTests().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
