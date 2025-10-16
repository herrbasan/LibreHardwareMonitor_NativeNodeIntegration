// Migrated test from archive/napi-approach/test/test-native-init.js
/**
 * Simple test to verify native module initialization and polling
 */

console.log('Testing LibreHardwareMonitor Native Module');
console.log('='.repeat(60));

try {
	console.log('\n1. Loading native module...');
	const lhm = require('../lib/index.js');
	console.log('   ✓ Module loaded successfully');
    
	console.log('\n2. Initializing hardware monitoring...');
    
	(async () => {
		try {
			await lhm.init({
				cpu: true,
				gpu: true,
				motherboard: false,
				memory: true,
				storage: false,
				network: false,
				psu: false,
				controller: false,
				battery: false
			});
            
			console.log('   ✓ Initialization successful');
            
			console.log('\n3. Polling hardware data...');
			const data = await lhm.poll();
            
			console.log('   ✓ Poll successful');
			console.log('   ✓ Data keys:', Object.keys(data).join(', '));
            
			// Check CPU data
			if (data.cpu && data.cpu.length > 0) {
				const cpu = data.cpu[0];
				console.log('\n4. CPU Information:');
				console.log('   Name:', cpu.name);
				console.log('   Sensors found:', Object.keys(cpu.sensors || {}).length);
                
				if (cpu.sensors && cpu.sensors.temperature) {
					console.log('   Temperature sensors:', cpu.sensors.temperature.length);
				}
				if (cpu.sensors && cpu.sensors.load) {
					console.log('   Load sensors:', cpu.sensors.load.length);
				}
			}
            
			// Check GPU data
			if (data.gpu && data.gpu.length > 0) {
				console.log('\n5. GPU Information:');
				data.gpu.forEach((gpu, idx) => {
					console.log(`   GPU ${idx + 1}: ${gpu.name}`);
					console.log(`   Sensors found: ${Object.keys(gpu.sensors || {}).length}`);
				});
			}
            
			console.log('\n✓ ALL TESTS PASSED - Native polling is working!');
			console.log('='.repeat(60));
		} catch (error) {
			console.error('\n✗ TEST FAILED:', error.message);
			console.error(error.stack);
			process.exit(1);
		}
	})();
    
} catch (error) {
	console.error('\n✗ TEST FAILED:', error.message);
	console.error(error.stack);
	process.exit(1);
}
