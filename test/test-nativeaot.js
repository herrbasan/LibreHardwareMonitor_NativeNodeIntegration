const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const exePath = path.join(__dirname, 'dist', 'LibreMonCLI.exe');

console.log('='.repeat(80));
console.log('Testing NativeAOT Release Build');
console.log('='.repeat(80));
console.log('Executable:', exePath);
console.log('Size: 6.0 MB (standalone, no .NET Runtime needed)');
console.log('='.repeat(80));
console.log('\nStarting daemon...\n');

const startTime = Date.now();
const daemon = spawn(exePath, ['--daemon']);

console.log('Process spawned with PID:', daemon.pid);
console.log('Command:', exePath, '--daemon');
console.log('');

const rl = readline.createInterface({
  input: daemon.stdout,
  crlfDelay: Infinity
});

daemon.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) {
    console.error('🔴 STDERR:', msg);
  }
});

let responseCount = 0;

rl.on('line', (line) => {
  responseCount++;
  const elapsed = Date.now() - startTime;
  
  try {
    const response = JSON.parse(line);
    
    if (response.success) {
      console.log(`✅ Response ${responseCount} (${elapsed}ms):`);
      
      if (response.data) {
        // Show abbreviated data
        console.log('   Data keys:', Object.keys(response.data));
        if (response.data.Children) {
          console.log('   Hardware count:', response.data.Children.length);
        }
      } else {
        console.log('   Message:', response.message || 'OK');
      }
    } else {
      console.log(`❌ Error ${responseCount} (${elapsed}ms):`, response.error);
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    console.error('Raw line:', line.substring(0, 200) + '...');
  }
});

daemon.on('exit', (code) => {
  const totalTime = Date.now() - startTime;
  console.log('\n' + '='.repeat(80));
  console.log(`Daemon exited with code: ${code} (Total time: ${totalTime}ms)`);
  console.log('='.repeat(80));
  process.exit(code);
});

// Test sequence
setTimeout(() => {
  console.log('📤 Sending INIT command (CPU + GPU)...\n');
  daemon.stdin.write('{"cmd":"init","flags":["cpu","gpu"],"flat":false}\n');
  
  setTimeout(() => {
    console.log('\n📤 Sending POLL command...\n');
    daemon.stdin.write('{"cmd":"poll"}\n');
    
    setTimeout(() => {
      console.log('\n📤 Sending SHUTDOWN command...\n');
      daemon.stdin.write('{"cmd":"shutdown"}\n');
      
      setTimeout(() => {
        process.exit(0);
      }, 500);
    }, 1000);
  }, 1000);
}, 500);
