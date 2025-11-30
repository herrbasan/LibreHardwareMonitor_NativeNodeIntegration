/**
 * Benchmark CPU cost of network polling with and without physicalNetworkOnly filter
 * Runs in separate processes due to CLR limitation
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const POLL_COUNT = 20;

function runTest(physicalOnly) {
    const tempFile = path.join(os.tmpdir(), `network-bench-${Date.now()}.json`);
    const scriptFile = path.join(os.tmpdir(), `network-bench-${Date.now()}.js`);
    
    const script = `
const path = require('path');
const fs = require('fs');
const monitor = require('${path.join(__dirname, '../dist/native-libremon-napi').replace(/\\/g, '\\\\')}');

async function main() {
    const physicalOnly = ${physicalOnly};
    
    await monitor.init({ 
        network: true,
        physicalNetworkOnly: physicalOnly
    });
    
    // Count adapters
    const data = await monitor.poll();
    let adapterCount = 0;
    function countAdapters(node) {
        if (node.ImageURL && node.ImageURL.includes('nic.png')) adapterCount++;
        if (node.Children) node.Children.forEach(countAdapters);
    }
    countAdapters(data);
    
    // Warm up
    for (let i = 0; i < 3; i++) await monitor.poll();
    
    // Benchmark
    const times = [];
    const cpuStart = process.cpuUsage();
    const wallStart = Date.now();
    
    for (let i = 0; i < ${POLL_COUNT}; i++) {
        const start = Date.now();
        await monitor.poll();
        times.push(Date.now() - start);
    }
    
    const wallTime = Date.now() - wallStart;
    const cpuUsage = process.cpuUsage(cpuStart);
    const cpuTimeMs = (cpuUsage.user + cpuUsage.system) / 1000;
    
    await monitor.shutdown();
    
    fs.writeFileSync('${tempFile.replace(/\\/g, '\\\\')}', JSON.stringify({
        physicalOnly,
        adapterCount,
        polls: ${POLL_COUNT},
        avgPollMs: times.reduce((a,b) => a+b, 0) / times.length,
        minPollMs: Math.min(...times),
        maxPollMs: Math.max(...times),
        totalWallMs: wallTime,
        totalCpuMs: cpuTimeMs,
        cpuPercent: (cpuTimeMs / wallTime * 100).toFixed(1)
    }));
}

main().catch(e => { console.error(e); process.exit(1); });
`;
    
    fs.writeFileSync(scriptFile, script);
    
    try {
        execSync(`node "${scriptFile}"`, {
            stdio: 'ignore',
            timeout: 60000
        });
        
        const result = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
        fs.unlinkSync(tempFile);
        fs.unlinkSync(scriptFile);
        return result;
    } catch (e) {
        if (fs.existsSync(tempFile)) {
            const result = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            fs.unlinkSync(tempFile);
            fs.unlinkSync(scriptFile);
            return result;
        }
        throw e;
    }
}

async function main() {
    console.log('Network Polling CPU Benchmark');
    console.log('='.repeat(60));
    console.log(`Polls per test: ${POLL_COUNT}`);
    console.log('');

    console.log('Testing WITHOUT physicalNetworkOnly filter...');
    const withoutFilter = runTest(false);
    
    console.log('Testing WITH physicalNetworkOnly filter...');
    const withFilter = runTest(true);
    
    console.log('');
    console.log('Results:');
    console.log('='.repeat(60));
    console.log('');
    
    console.log('Without filter (physicalNetworkOnly: false):');
    console.log(`  Adapters:      ${withoutFilter.adapterCount}`);
    console.log(`  Avg poll:      ${withoutFilter.avgPollMs.toFixed(1)}ms`);
    console.log(`  Min/Max:       ${withoutFilter.minPollMs}ms / ${withoutFilter.maxPollMs}ms`);
    console.log(`  Total wall:    ${withoutFilter.totalWallMs}ms`);
    console.log(`  Total CPU:     ${withoutFilter.totalCpuMs.toFixed(1)}ms`);
    console.log(`  CPU usage:     ${withoutFilter.cpuPercent}%`);
    console.log('');
    
    console.log('With filter (physicalNetworkOnly: true):');
    console.log(`  Adapters:      ${withFilter.adapterCount}`);
    console.log(`  Avg poll:      ${withFilter.avgPollMs.toFixed(1)}ms`);
    console.log(`  Min/Max:       ${withFilter.minPollMs}ms / ${withFilter.maxPollMs}ms`);
    console.log(`  Total wall:    ${withFilter.totalWallMs}ms`);
    console.log(`  Total CPU:     ${withFilter.totalCpuMs.toFixed(1)}ms`);
    console.log(`  CPU usage:     ${withFilter.cpuPercent}%`);
    console.log('');
    
    console.log('Improvement:');
    console.log(`  Adapters:      ${withoutFilter.adapterCount} → ${withFilter.adapterCount} (${((1 - withFilter.adapterCount / withoutFilter.adapterCount) * 100).toFixed(0)}% reduction)`);
    console.log(`  Avg poll:      ${withoutFilter.avgPollMs.toFixed(1)}ms → ${withFilter.avgPollMs.toFixed(1)}ms (${((1 - withFilter.avgPollMs / withoutFilter.avgPollMs) * 100).toFixed(0)}% faster)`);
    console.log(`  CPU time:      ${withoutFilter.totalCpuMs.toFixed(1)}ms → ${withFilter.totalCpuMs.toFixed(1)}ms (${((1 - withFilter.totalCpuMs / withoutFilter.totalCpuMs) * 100).toFixed(0)}% less CPU)`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
