/**
 * Simple storage test - init then poll
 */
const { spawn } = require('child_process');
const path = require('path');

const daemon = spawn(path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe'), ['--daemon']);

let initComplete = false;
let pollComplete = false;

daemon.stdout.on('data', (chunk) => {
  const lines = chunk.toString().split('\n');
  lines.forEach(line => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      console.log('RESPONSE:', JSON.stringify(msg, null, 2));

      if (!initComplete && msg.success && msg.initialized) {
        console.log('Init successful, sending poll...');
        initComplete = true;
        daemon.stdin.write('{"cmd":"poll"}\n');
      } else if (initComplete && !pollComplete && msg.success && msg.data) {
        console.log('Poll successful!');
        pollComplete = true;
        daemon.stdin.write('{"cmd":"shutdown"}\n');
        setTimeout(() => daemon.kill(), 500);
      }
    } catch (e) {
      console.log('Parse error:', e.message, 'Line:', line);
    }
  });
});

daemon.stderr.on('data', (chunk) => {
  console.log('STDERR:', chunk.toString());
});

daemon.on('close', (code) => {
  console.log('Daemon exited with code:', code);
});

// Send init command
console.log('Sending init command...');
daemon.stdin.write('{"cmd":"init","flags":["storage"]}\n');

// Timeout
setTimeout(() => {
  if (!pollComplete) {
    console.log('Timeout - killing daemon');
    daemon.kill();
  }
}, 10000);