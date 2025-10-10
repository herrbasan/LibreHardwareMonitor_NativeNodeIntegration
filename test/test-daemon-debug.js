const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const exePath = path.join(__dirname, 'managed', 'LibreMonCLI', 'bin', 'Debug', 'net9.0', 'win-x64', 'LibreMonCLI.exe');

console.log('Starting daemon (Debug build)...');
console.log('Path:', exePath);

const daemon = spawn(exePath, ['--daemon']);

const rl = readline.createInterface({
  input: daemon.stdout,
  crlfDelay: Infinity
});

daemon.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString());
});

rl.on('line', (line) => {
  console.log('RESPONSE:', line);
  try {
    const response = JSON.parse(line);
    console.log('PARSED:', JSON.stringify(response, null, 2));
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
  }
});

daemon.on('exit', (code) => {
  console.log('Daemon exited with code:', code);
  process.exit(code);
});

// Wait a bit for daemon to start
setTimeout(() => {
  console.log('\n=== Sending init command ===');
  daemon.stdin.write('{"cmd":"init","flags":["cpu","gpu"],"flat":false}\n');
  
  setTimeout(() => {
    console.log('\n=== Sending poll command ===');
    daemon.stdin.write('{"cmd":"poll"}\n');
    
    setTimeout(() => {
      console.log('\n=== Sending shutdown command ===');
      daemon.stdin.write('{"cmd":"shutdown"}\n');
      
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    }, 2000);
  }, 2000);
}, 1000);
