/**
 * Benchmark poll time with ALL sensor groups enabled.
 * Tests whether poll time is sum of individual groups or optimized.
 * Run as admin for full hardware access.
 * 
 * Usage: node test/poll-all-benchmark.js
 */

const path = require('path');

const distPath = path.resolve(__dirname, '../dist/native-libremon-napi');
const monitor = require(distPath);

const POLL_COUNT = 50;
const WARMUP_COUNT = 5;

async function run() {
  console.log('=== All Groups Poll Benchmark ===\n');
  
  console.log('Initializing with ALL sensor groups enabled...');
  const initStart = Date.now();
  
  monitor.init({
    cpu: true,
    gpu: true,
    motherboard: true,
    memory: true,        // Note: slow init due to DIMM detection
    storage: true,
    network: true,
    psu: true,
    controller: true,
    battery: true,
    dimmDetection: true  // Full DIMM detection
  });
  
  const initTime = Date.now() - initStart;
  console.log(`Init time: ${initTime}ms\n`);

  // Warmup polls
  console.log(`Running ${WARMUP_COUNT} warmup polls...`);
  for (let i = 0; i < WARMUP_COUNT; i++) {
    await monitor.poll();
  }

  // Benchmark polls
  console.log(`Running ${POLL_COUNT} benchmark polls...\n`);
  
  const pollTimes = [];
  let sensorCount = 0;
  let hardwareCount = 0;
  
  for (let i = 0; i < POLL_COUNT; i++) {
    const pollStart = Date.now();
    const data = await monitor.poll();
    const pollTime = Date.now() - pollStart;
    pollTimes.push(pollTime);
    
    // Count on first poll
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
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  ${i + 1}/${POLL_COUNT} polls completed\r`);
    }
  }
  
  console.log('\n');

  // Calculate statistics
  pollTimes.sort((a, b) => a - b);
  
  const sum = pollTimes.reduce((a, b) => a + b, 0);
  const avg = sum / pollTimes.length;
  const min = pollTimes[0];
  const max = pollTimes[pollTimes.length - 1];
  const median = pollTimes[Math.floor(pollTimes.length / 2)];
  const p95 = pollTimes[Math.floor(pollTimes.length * 0.95)];
  const p99 = pollTimes[Math.floor(pollTimes.length * 0.99)];
  
  // Standard deviation
  const squaredDiffs = pollTimes.map(t => Math.pow(t - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  console.log('=== Results ===\n');
  console.log(`Hardware items: ${hardwareCount}`);
  console.log(`Total sensors:  ${sensorCount}`);
  console.log('');
  console.log('Poll Time Statistics:');
  console.log(`  Min:      ${min}ms`);
  console.log(`  Max:      ${max}ms`);
  console.log(`  Average:  ${avg.toFixed(1)}ms`);
  console.log(`  Median:   ${median}ms`);
  console.log(`  P95:      ${p95}ms`);
  console.log(`  P99:      ${p99}ms`);
  console.log(`  Std Dev:  ${stdDev.toFixed(1)}ms`);
  console.log('');
  console.log(`Max polling rate: ${(1000 / avg).toFixed(2)} Hz`);
  console.log('');
  
  // Distribution
  console.log('Distribution:');
  const buckets = {};
  for (const t of pollTimes) {
    const bucket = Math.floor(t / 50) * 50;
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }
  
  const sortedBuckets = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  for (const bucket of sortedBuckets) {
    const count = buckets[bucket];
    const bar = '█'.repeat(Math.ceil(count / POLL_COUNT * 50));
    console.log(`  ${bucket.toString().padStart(4)}-${(bucket + 49).toString().padStart(4)}ms: ${bar} (${count})`);
  }
  
  console.log('');
  console.log('Raw poll times (ms):');
  console.log('  ' + pollTimes.join(', '));
  
  // Comparison with individual category sums
  console.log('\n=== Analysis ===\n');
  console.log('Individual category poll times (from previous test):');
  console.log('  CPU:         252ms');
  console.log('  GPU:          91ms');
  console.log('  Storage:      15ms');
  console.log('  Memory:        9ms');
  console.log('  Motherboard:   4ms');
  console.log('  Network:       3ms');
  console.log('  Others:        3ms (psu+controller+battery)');
  console.log('  ─────────────────');
  console.log('  Sum:         377ms (if purely sequential)');
  console.log('');
  console.log(`Actual avg:    ${avg.toFixed(1)}ms`);
  console.log(`Difference:    ${(377 - avg).toFixed(1)}ms ${avg < 377 ? '(faster than sum - some optimization?)' : '(matches sequential)'}`);
  
  monitor.shutdown();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Error:', err);
  try { monitor.shutdown(); } catch {}
  process.exit(1);
});
