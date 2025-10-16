/**
 * Test direct physical drive access
 */
const { spawn } = require('child_process');

console.log('Testing direct physical drive access...\n');

// Test if we can access physical drives directly
const drives = [0, 1, 2, 3, 4]; // Based on WMI output

drives.forEach(driveIndex => {
  const ps = spawn('powershell.exe', [
    '-Command',
    `try { $handle = [System.IO.File]::Open("\\\\.\\PHYSICALDRIVE${driveIndex}", 'ReadWrite'); $handle.Close(); Write-Host "SUCCESS: PHYSICALDRIVE${driveIndex} accessible" } catch { Write-Host "FAILED: PHYSICALDRIVE${driveIndex} - $($_.Exception.Message)" }`
  ]);

  ps.stdout.on('data', (chunk) => {
    console.log(`Drive ${driveIndex}: ${chunk.toString().trim()}`);
  });

  ps.stderr.on('data', (chunk) => {
    console.log(`Drive ${driveIndex} STDERR: ${chunk.toString().trim()}`);
  });
});

// Also test WMI query
console.log('\nTesting WMI query...');
const wmiPs = spawn('powershell.exe', [
  '-Command',
  `Get-WmiObject -Class Win32_DiskDrive | Select-Object DeviceId, Index, Model, Size | Format-Table -AutoSize`
]);

wmiPs.stdout.on('data', (chunk) => {
  console.log(chunk.toString());
});

wmiPs.stderr.on('data', (chunk) => {
  console.log('WMI STDERR:', chunk.toString());
});