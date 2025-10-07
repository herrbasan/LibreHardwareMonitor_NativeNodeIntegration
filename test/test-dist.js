/**
 * Test distribution package
 * 
 * This verifies the dist/ folder works without any build tools.
 */

const monitor = require('../dist');

async function testDist() {
    console.log('Testing Distribution Package\n');
    console.log('='.repeat(60));
    
    try {
        console.log('\n1. Initializing from dist/...');
        await monitor.init({
            cpu: true,
            gpu: true,
            memory: true
        });
        console.log('   ✓ Initialization successful');
        
        console.log('\n2. Polling sensors...');
        const data = await monitor.poll();
        console.log('   ✓ Poll successful');
        console.log(`   Data size: ${JSON.stringify(data).length} bytes`);
        
        console.log('\n3. Testing flattened output...');
        const flat = await monitor.poll({ flatten: true });
        console.log('   ✓ Flattening successful');
        console.log(`   Hardware types: ${Object.keys(flat).join(', ')}`);
        
        console.log('\n4. Shutting down...');
        await monitor.shutdown();
        console.log('   ✓ Shutdown successful');
        
        console.log('\n' + '='.repeat(60));
        console.log('✓ Distribution package works correctly!');
        console.log('\nThe dist/ folder is ready for distribution.');
        console.log('Users can extract and use without any build tools!\n');
        
    } catch (err) {
        console.error('\n✗ Test failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

testDist();
