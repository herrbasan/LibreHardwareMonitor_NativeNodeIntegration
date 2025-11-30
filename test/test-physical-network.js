/**
 * Test physicalNetworkOnly filter for network adapters
 * Compares network adapter count with and without the filter
 * Must run as Administrator
 */

const path = require('path');
const monitor = require(path.join(__dirname, '../dist/native-libremon-napi'));

async function main() {
    console.log('Testing physicalNetworkOnly filter...');
    console.log('='.repeat(60));
    
    // Get the physicalNetworkOnly setting from command line
    const physicalOnly = process.argv.includes('--physical-only');
    
    console.log(`\nConfiguration: physicalNetworkOnly = ${physicalOnly}`);
    console.log('');
    
    // Initialize
    const initStart = Date.now();
    await monitor.init({ 
        network: true,
        physicalNetworkOnly: physicalOnly
    });
    const initTime = Date.now() - initStart;
    console.log(`Init time: ${initTime}ms`);
    
    // Poll to get network data
    const pollStart = Date.now();
    const data = await monitor.poll();
    const pollTime = Date.now() - pollStart;
    console.log(`Poll time: ${pollTime}ms`);
    
    // Find network adapters
    const networks = [];
    
    function findNetworks(node, depth = 0) {
        if (node.ImageURL && node.ImageURL.includes('nic.png')) {
            networks.push({
                name: node.Text,
                id: node.id || node.HardwareId,
                sensors: node.Children ? node.Children.length : 0
            });
        }
        
        if (node.Children) {
            for (const child of node.Children) {
                findNetworks(child, depth + 1);
            }
        }
    }
    
    findNetworks(data);
    
    console.log(`\nNetwork adapters found: ${networks.length}`);
    console.log('-'.repeat(60));
    
    for (const net of networks) {
        console.log(`  ${net.name}`);
    }
    
    // Shutdown
    await monitor.shutdown();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
