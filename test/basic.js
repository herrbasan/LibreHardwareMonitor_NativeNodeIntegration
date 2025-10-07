/**
 * Basic test to verify the native addon loads and functions work
 */

const monitor = require('../lib/index');

async function test() {
    console.log('LibreHardwareMonitor Native - Basic Test\n');
    
    try {
        console.log('1. Initializing hardware monitor...');
        await monitor.init({
            cpu: true,
            gpu: true,
            motherboard: true,
            memory: true
        });
        console.log('   ✓ Initialization successful\n');
        
        console.log('2. Polling sensors...');
        const data = await monitor.poll();
        console.log('   ✓ Poll successful');
        console.log('   Data:', JSON.stringify(data, null, 2), '\n');
        
        console.log('3. Shutting down...');
        await monitor.shutdown();
        console.log('   ✓ Shutdown successful\n');
        
        console.log('All tests passed! ✓');
        
    } catch (err) {
        console.error('Test failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

test();
