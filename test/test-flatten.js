/**
 * Test flattening functionality
 * Compares raw hierarchical output vs flattened output
 */

const monitor = require('../lib/index');
const fs = require('fs');
const path = require('path');

async function testFlatten() {
    console.log('LibreHardwareMonitor - Flatten Test\n');
    console.log('='.repeat(60));
    
    try {
        // Initialize with basic hardware
        console.log('\n1. Initializing...');
        await monitor.init({
            cpu: true,
            gpu: true,
            memory: true,
            motherboard: true
        });
        console.log('   ✓ Initialized');
        
        // Get raw data
        console.log('\n2. Polling raw (hierarchical) data...');
        const rawData = await monitor.poll({ flatten: false });
        console.log('   ✓ Raw data received');
        
        // Get flattened data
        console.log('\n3. Polling flattened data...');
        const flatData = await monitor.poll({ flatten: true });
        console.log('   ✓ Flattened data received');
        
        // Analyze structure
        console.log('\n4. Analyzing structures...');
        console.log('\n   Raw data structure:');
        console.log(`      - Root properties: ${Object.keys(rawData).join(', ')}`);
        console.log(`      - Hardware items: ${rawData.Children ? rawData.Children.length : 0}`);
        
        console.log('\n   Flattened data structure:');
        const hwTypes = Object.keys(flatData);
        console.log(`      - Hardware types: ${hwTypes.join(', ')}`);
        
        for (const type of hwTypes) {
            console.log(`      - ${type}: ${flatData[type].length} item(s)`);
            if (flatData[type].length > 0) {
                const first = flatData[type][0];
                console.log(`        * Name: ${first.name}`);
                const sensorTypes = Object.keys(first).filter(k => 
                    typeof first[k] === 'object' && first[k].name
                );
                if (sensorTypes.length > 0) {
                    console.log(`        * Sensor categories: ${sensorTypes.join(', ')}`);
                }
            }
        }
        
        // Show example CPU temperature if available
        console.log('\n5. Example sensor access:');
        if (flatData.cpu && flatData.cpu.length > 0) {
            const cpu = flatData.cpu[0];
            console.log(`\n   CPU: ${cpu.name}`);
            
            if (cpu.temperatures) {
                const tempSensors = Object.keys(cpu.temperatures).filter(k => 
                    typeof cpu.temperatures[k] === 'object' && cpu.temperatures[k].data
                );
                
                if (tempSensors.length > 0) {
                    console.log(`   Temperatures:`);
                    let displayed = 0;
                    for (const sensor of tempSensors) {
                        if (displayed >= 3) break; // Show max 3
                        const s = cpu.temperatures[sensor];
                        if (s.data && s.data.value !== null && s.data.value !== undefined) {
                            console.log(`      - ${s.name}: ${s.data.value}${s.data.unit}`);
                            if (s.data.min !== undefined && s.data.max !== undefined) {
                                console.log(`        Min: ${s.data.min}${s.data.unit}, Max: ${s.data.max}${s.data.unit}`);
                            }
                            displayed++;
                        }
                    }
                    if (displayed === 0) {
                        console.log(`      (No temperature readings available)`);
                    }
                }
            }
            
            if (cpu.load) {
                const loadSensors = Object.keys(cpu.load).filter(k => 
                    typeof cpu.load[k] === 'object' && cpu.load[k].data
                );
                
                if (loadSensors.length > 0) {
                    console.log(`   Load:`);
                    const totalLoad = cpu.load[loadSensors[0]];
                    if (totalLoad && totalLoad.data) {
                        console.log(`      - ${totalLoad.name}: ${totalLoad.data.value}${totalLoad.data.unit}`);
                    }
                }
            }
        }
        
        // Show example GPU info if available
        if (flatData.gpu && flatData.gpu.length > 0) {
            const gpu = flatData.gpu[0];
            console.log(`\n   GPU: ${gpu.name}`);
            
            if (gpu.temperatures) {
                const tempSensors = Object.keys(gpu.temperatures).filter(k => 
                    typeof gpu.temperatures[k] === 'object' && gpu.temperatures[k].data
                );
                
                if (tempSensors.length > 0) {
                    const temp = gpu.temperatures[tempSensors[0]];
                    if (temp && temp.data) {
                        console.log(`      - ${temp.name}: ${temp.data.value}${temp.data.unit}`);
                    }
                }
            }
            
            if (gpu.load) {
                const loadSensors = Object.keys(gpu.load).filter(k => 
                    typeof gpu.load[k] === 'object' && gpu.load[k].data
                );
                
                if (loadSensors.length > 0) {
                    const load = gpu.load[loadSensors[0]];
                    if (load && load.data) {
                        console.log(`      - ${load.name}: ${load.data.value}${load.data.unit}`);
                    }
                }
            }
        }
        
        // Save outputs for inspection
        const outputDir = path.join(__dirname, '../test');
        
        console.log('\n6. Saving output files...');
        fs.writeFileSync(
            path.join(outputDir, 'raw-output.json'),
            JSON.stringify(rawData, null, 2)
        );
        console.log('   ✓ Saved: test/raw-output.json');
        
        fs.writeFileSync(
            path.join(outputDir, 'flattened-output.json'),
            JSON.stringify(flatData, null, 2)
        );
        console.log('   ✓ Saved: test/flattened-output.json');
        
        // Size comparison
        const rawSize = JSON.stringify(rawData).length;
        const flatSize = JSON.stringify(flatData).length;
        
        console.log('\n7. Size comparison:');
        console.log(`   Raw JSON:       ${(rawSize / 1024).toFixed(2)} KB`);
        console.log(`   Flattened JSON: ${(flatSize / 1024).toFixed(2)} KB`);
        console.log(`   Difference:     ${((flatSize - rawSize) / 1024).toFixed(2)} KB (${((flatSize / rawSize - 1) * 100).toFixed(1)}%)`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✓ Test completed successfully!\n');
        
    } catch (err) {
        console.error('\n✗ Test failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        // Cleanup
        console.log('Shutting down...');
        await monitor.shutdown();
        console.log('✓ Shutdown complete');
    }
}

// Run test
testFlatten().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
