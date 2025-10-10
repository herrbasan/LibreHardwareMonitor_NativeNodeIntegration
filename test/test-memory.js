const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('Testing memory monitoring support...\n');

const daemon = spawn(exePath, ['--daemon']);
const rl = readline.createInterface({
  input: daemon.stdout,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    
    if (response.success) {
      console.log('✅ Success:', response.message || 'OK');
      if (response.data && response.data.Children) {
        console.log('   Hardware detected:');
        response.data.Children[0].Children.forEach(hw => {
          console.log(`   - ${hw.Text}`);
        });
      }
    } else {
      console.log('❌ Error:', response.error);
      console.log('   Code:', response.errorCode);
    }
    
    daemon.stdin.write('{"cmd":"shutdown"}\n');
  } catch (e) {
    console.error('Parse error:', e.message);
  }
});

daemon.on('exit', (code) => {
  console.log(`\nDaemon exited with code: ${code}`);
  process.exit(code);
});

setTimeout(() => {
  console.log('Sending init with MEMORY enabled...\n');
  daemon.stdin.write('{"cmd":"init","flags":["cpu","memory"],"flat":false}\n');
  
  setTimeout(() => {
    daemon.stdin.write('{"cmd":"poll"}\n');
  }, 1000);
}, 500);
