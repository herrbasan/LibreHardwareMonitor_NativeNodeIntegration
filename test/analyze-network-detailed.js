/**
 * Analyze network adapters to find distinguishing characteristics
 * for filtering virtual adapters
 */

const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function main() {
    console.log('Analyzing network adapters...\n');
    
    // Get detailed network adapter info using PowerShell
    const { stdout } = await execAsync(`powershell -Command "Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, MacAddress, Virtual, HardwareInterface | ConvertTo-Json"`, { maxBuffer: 1024 * 1024 });
    
    const adapters = JSON.parse(stdout);
    
    console.log('Adapter Analysis:');
    console.log('='.repeat(100));
    
    for (const adapter of adapters) {
        console.log(`Name: ${adapter.Name}`);
        console.log(`  Description: ${adapter.InterfaceDescription}`);
        console.log(`  Status: ${adapter.Status}`);
        console.log(`  Virtual: ${adapter.Virtual}`);
        console.log(`  HardwareInterface: ${adapter.HardwareInterface}`);
        console.log(`  MAC: ${adapter.MacAddress}`);
        console.log('');
    }
    
    // Also get WMI info which might have more details
    console.log('\nWMI Network Adapter Details:');
    console.log('='.repeat(100));
    
    const { stdout: wmiOut } = await execAsync(`powershell -Command "Get-WmiObject Win32_NetworkAdapter | Where-Object { $_.NetEnabled -ne $null } | Select-Object Name, Description, NetConnectionID, AdapterType, PhysicalAdapter, ServiceName | ConvertTo-Json"`, { maxBuffer: 1024 * 1024 });
    
    const wmiAdapters = JSON.parse(wmiOut);
    
    for (const adapter of wmiAdapters) {
        console.log(`Name: ${adapter.Name}`);
        console.log(`  NetConnectionID: ${adapter.NetConnectionID}`);
        console.log(`  Description: ${adapter.Description}`);
        console.log(`  AdapterType: ${adapter.AdapterType}`);
        console.log(`  PhysicalAdapter: ${adapter.PhysicalAdapter}`);
        console.log(`  ServiceName: ${adapter.ServiceName}`);
        console.log('');
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
