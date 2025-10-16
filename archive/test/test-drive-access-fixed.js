/**
 * Test physical drive access with correct PowerShell syntax
 */
const { spawn } = require('child_process');

console.log('Testing physical drive access with correct PowerShell syntax...\n');

// Test CreateFile equivalent in PowerShell
const testDrive = (driveIndex) => {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-Command',
      `
        try {
          $handle = [System.IO.File]::Open("\\\\.\\PHYSICALDRIVE${driveIndex}", [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::ReadWrite);
          $handle.Close();
          Write-Host "SUCCESS: PHYSICALDRIVE${driveIndex} accessible";
        } catch {
          Write-Host "FAILED: PHYSICALDRIVE${driveIndex} - \$($_.Exception.Message)";
        }
      `
    ]);

    let output = '';
    ps.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    ps.on('close', () => {
      console.log(`Drive ${driveIndex}: ${output.trim()}`);
      resolve();
    });
  });
};

// Test all drives
const drives = [0, 1, 2, 3, 4];
(async () => {
  for (const drive of drives) {
    await testDrive(drive);
  }

  console.log('\nTesting with ReadOnly access...');
  // Test with read-only access
  for (const drive of drives) {
    const ps = spawn('powershell.exe', [
      '-Command',
      `
        try {
          $handle = [System.IO.File]::Open("\\\\.\\PHYSICALDRIVE${drive}", [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite);
          $handle.Close();
          Write-Host "READONLY SUCCESS: PHYSICALDRIVE${drive}";
        } catch {
          Write-Host "READONLY FAILED: PHYSICALDRIVE${drive} - \$($_.Exception.Message)";
        }
      `
    ]);

    ps.stdout.on('data', (chunk) => {
      console.log(`ReadOnly Drive ${drive}: ${chunk.toString().trim()}`);
    });
  }
})();