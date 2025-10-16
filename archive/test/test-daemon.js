const { spawn } = require('child_process');
const readline = require('readline');

console.log('Starting daemon...');
const daemon = spawn('dist\\LibreMonCLI.exe', ['--daemon'], {
  cwd: __dirname
});

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
  console.log('\nSending init command...');
  daemon.stdin.write('{"cmd":"init","flags":["cpu","gpu"],"flat":false}\n');
  
  setTimeout(() => {
    console.log('\nSending poll command...');
    daemon.stdin.write('{"cmd":"poll"}\n');
    
    setTimeout(() => {
      console.log('\nSending shutdown command...');
      daemon.stdin.write('{"cmd":"shutdown"}\n');
      
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    }, 2000);
  }, 2000);
}, 1000);
