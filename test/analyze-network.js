/**
 * Analyze network adapters detected by LHM.
 * Shows which ones are physical vs virtual, active vs inactive.
 */

const path = require('path');
const distPath = path.resolve(__dirname, '../dist/native-libremon-napi');
const monitor = require(distPath);

async function run() {
  console.log('=== Network Adapter Analysis ===\n');
  
  monitor.init({
    cpu: false, gpu: false, motherboard: false,
    memory: false, storage: false,
    network: true,
    psu: false, controller: false, battery: false
  });

  const data = await monitor.poll();
  
  // Find network hardware
  const networks = data.Children?.[0]?.Children || [];
  
  console.log(`Found ${networks.length} network adapters:\n`);
  
  // Group by type (based on naming patterns)
  const physical = [];
  const virtual = [];
  const vpn = [];
  const other = [];
  
  for (const net of networks) {
    const name = net.Text || '';
    const nameLower = name.toLowerCase();
    
    // Get throughput to see if active
    let downloadSpeed = 0;
    let uploadSpeed = 0;
    
    if (net.Children) {
      for (const group of net.Children) {
        if (group.Children) {
          for (const sensor of group.Children) {
            if (sensor.Text === 'Download Speed') {
              downloadSpeed = parseFloat(sensor.Value) || 0;
            }
            if (sensor.Text === 'Upload Speed') {
              uploadSpeed = parseFloat(sensor.Value) || 0;
            }
          }
        }
      }
    }
    
    const hasActivity = downloadSpeed > 0 || uploadSpeed > 0;
    
    const info = {
      name,
      hasActivity,
      downloadSpeed,
      uploadSpeed
    };
    
    // Classify
    if (nameLower.includes('virtual') || 
        nameLower.includes('vmware') || 
        nameLower.includes('virtualbox') ||
        nameLower.includes('hyper-v') ||
        nameLower.includes('vethernet') ||
        nameLower.includes('docker') ||
        nameLower.includes('wsl')) {
      virtual.push(info);
    } else if (nameLower.includes('vpn') || 
               nameLower.includes('tap-') ||
               nameLower.includes('wireguard') ||
               nameLower.includes('nordlynx') ||
               nameLower.includes('openvpn')) {
      vpn.push(info);
    } else if (nameLower.includes('ethernet') || 
               nameLower.includes('wi-fi') ||
               nameLower.includes('wireless') ||
               nameLower.includes('intel') ||
               nameLower.includes('realtek') ||
               nameLower.includes('killer') ||
               nameLower.includes('mediatek') ||
               nameLower.includes('qualcomm') ||
               nameLower.includes('broadcom')) {
      physical.push(info);
    } else {
      other.push(info);
    }
  }
  
  console.log('=== Physical Adapters ===');
  for (const a of physical) {
    console.log(`  ${a.hasActivity ? '✓' : '○'} ${a.name}`);
  }
  
  console.log('\n=== Virtual Adapters ===');
  for (const a of virtual) {
    console.log(`  ${a.hasActivity ? '✓' : '○'} ${a.name}`);
  }
  
  console.log('\n=== VPN Adapters ===');
  for (const a of vpn) {
    console.log(`  ${a.hasActivity ? '✓' : '○'} ${a.name}`);
  }
  
  console.log('\n=== Other/Unknown ===');
  for (const a of other) {
    console.log(`  ${a.hasActivity ? '✓' : '○'} ${a.name}`);
  }
  
  console.log('\n=== Summary ===');
  console.log(`  Physical: ${physical.length} (${physical.filter(a => a.hasActivity).length} active)`);
  console.log(`  Virtual:  ${virtual.length} (${virtual.filter(a => a.hasActivity).length} active)`);
  console.log(`  VPN:      ${vpn.length} (${vpn.filter(a => a.hasActivity).length} active)`);
  console.log(`  Other:    ${other.length} (${other.filter(a => a.hasActivity).length} active)`);
  console.log(`  TOTAL:    ${networks.length}`);
  
  console.log('\n=== Potential Savings ===');
  const activePhysical = physical.filter(a => a.hasActivity).length || 1;
  const reduction = ((networks.length - activePhysical) / networks.length * 100).toFixed(0);
  console.log(`  If only polling active physical adapters: ${activePhysical} instead of ${networks.length}`);
  console.log(`  Reduction: ${reduction}%`);

  monitor.shutdown();
}

run().catch(console.error);
