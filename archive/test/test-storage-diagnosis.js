/**
 * Storage Detection Diagnostic Test
 * 
 * This test examines WHY storage detection fails by checking:
 * 1. Are physical drives detected by WMI?
 * 2. What error occurs when trying to open drive handles?
 * 3. Are we running with admin privileges?
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DAEMON_PATH = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

// WMI query to list physical drives
async function queryPhysicalDrives() {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-Command',
      `Get-WmiObject -Class Win32_DiskDrive | Select-Object DeviceId, Index, Model, Size, MediaType | ConvertTo-Json`
    ]);

    let output = '';
    let error = '';

    ps.stdout.on('data', (chunk) => output += chunk);
    ps.stderr.on('data', (chunk) => error += chunk);

    ps.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PowerShell failed: ${error}`));
      } else {
        try {
          const drives = JSON.parse(output);
          resolve(Array.isArray(drives) ? drives : [drives]);
        } catch (e) {
          reject(new Error(`Failed to parse WMI output: ${e.message}`));
        }
      }
    });
  });
}

// Check if running as administrator
async function checkAdminPrivileges() {
  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-Command',
      `([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`
    ]);

    let output = '';
    ps.stdout.on('data', (chunk) => output += chunk);
    ps.on('close', () => {
      resolve(output.trim() === 'True');
    });
  });
}

// Test daemon storage detection
async function testDaemonStorageDetection() {
  return new Promise((resolve, reject) => {
    const daemon = spawn(DAEMON_PATH, ['--daemon']);
    
    let initComplete = false;
    let pollComplete = false;
    let response = '';

    daemon.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      lines.forEach(line => {
        if (!line.trim()) return;

        try {
          const msg = JSON.parse(line);

          if (!initComplete) {
            if (msg.success) {
              console.log('✅ Init succeeded');
              initComplete = true;
              // Send poll command
              daemon.stdin.write('{"cmd":"poll"}\n');
            } else {
              console.error('❌ Init failed:', msg.error);
              daemon.kill();
              reject(new Error('Init failed'));
            }
          } else if (!pollComplete) {
            if (msg.success) {
              console.log('✅ Poll succeeded');
              pollComplete = true;
              response = msg;
              daemon.stdin.write('{"cmd":"shutdown"}\n');
              setTimeout(() => daemon.kill(), 500);
              resolve(response);
            } else {
              console.error('❌ Poll failed:', msg.error);
              daemon.kill();
              reject(new Error('Poll failed'));
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
    });

    daemon.stderr.on('data', (chunk) => {
      console.log('STDERR:', chunk.toString());
    });

    daemon.on('close', (code) => {
      if (!pollComplete) {
        reject(new Error('Daemon closed before poll completed'));
      }
    });

    // Send init command
    daemon.stdin.write('{"cmd":"init","flags":["storage"]}\n');

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!pollComplete) {
        daemon.kill();
        reject(new Error('Timeout waiting for poll response'));
      }
    }, 10000);
  });
}

// Count storage devices in response
function countStorageDevices(data) {
  let count = 0;

  const traverse = (node, depth = 0) => {
    // Look for nodes with "hdd" or "ssd" or "nvme" in imageURL
    if (node.imageURL) {
      const img = node.imageURL.toLowerCase();
      if (img.includes('hdd') || img.includes('ssd') || img.includes('nvme')) {
        count++;
        console.log(`  Found storage device: ${node.text} (${node.imageURL})`);
      }
    }

    if (node.children) {
      node.children.forEach(child => traverse(child, depth + 1));
    }
  };

  traverse(data);
  return count;
}

// Main diagnostic
(async () => {
  console.log('=== Storage Detection Diagnostic ===\n');

  // Step 1: Check admin privileges
  console.log('Step 1: Checking administrator privileges...');
  const isAdmin = await checkAdminPrivileges();
  console.log(`  Running as administrator: ${isAdmin ? '✅ YES' : '❌ NO'}`);
  if (!isAdmin) {
    console.log('  ⚠️  WARNING: This process is not running as administrator!');
    console.log('  ⚠️  Storage detection requires admin privileges.');
  }
  console.log();

  // Step 2: Query physical drives via WMI
  console.log('Step 2: Querying physical drives via WMI...');
  try {
    const drives = await queryPhysicalDrives();
    console.log(`  WMI detected ${drives.length} physical drive(s):`);
    drives.forEach(drive => {
      const sizeGB = Math.round(drive.Size / 1024 / 1024 / 1024);
      console.log(`    ${drive.DeviceId} (Index ${drive.Index}): ${drive.Model} - ${sizeGB} GB - ${drive.MediaType || 'Unknown'}`);
    });
  } catch (e) {
    console.error('  ❌ WMI query failed:', e.message);
  }
  console.log();

  // Step 3: Test daemon storage detection
  console.log('Step 3: Testing daemon storage detection...');
  try {
    const response = await testDaemonStorageDetection();
    const deviceCount = countStorageDevices(response.data);
    console.log(`  Daemon detected ${deviceCount} storage device(s)`);

    if (deviceCount === 0) {
      console.log();
      console.log('❌ DIAGNOSIS: Daemon detected 0 storage devices despite WMI showing drives exist!');
      console.log();
      console.log('Possible causes:');
      console.log('  1. Handle creation fails due to exclusive locks (Windows has disk open)');
      console.log('  2. DeviceIoControl IOCTL_STORAGE_QUERY_PROPERTY fails');
      console.log('  3. Drives are marked as removable/virtual');
      console.log('  4. CsWin32 P/Invoke issue with CreateFile/DeviceIoControl');
      console.log();
      console.log('Next steps:');
      console.log('  - Check if changing FileAccess.ReadWrite to FileAccess.Read helps');
      console.log('  - Add diagnostic logging to WindowsStorage.GetStorageInfo()');
      console.log('  - Test with LibreHardwareMonitor GUI to compare');
    }

    // Save response for inspection
    fs.writeFileSync(
      path.join(__dirname, 'output', 'storage-diagnosis-poll.json'),
      JSON.stringify(response, null, 2)
    );
  } catch (e) {
    console.error('  ❌ Daemon test failed:', e.message);
  }

  console.log('\n=== Diagnostic Complete ===');
})();
