const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('='.repeat(80));
console.log('Poll Latency Benchmark - Testing daemon poll performance');
console.log('='.repeat(80));
console.log('\nStarting daemon...\n');

const daemon = spawn(exePath, ['--daemon']);

const rl = readline.createInterface({
  input: daemon.stdout,
  crlfDelay: Infinity
});

daemon.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString().trim());
});

let commandTimes = [];
let currentCommandTime = null;

rl.on('line', (line) => {
  const responseTime = Date.now();
  
  try {
    const response = JSON.parse(line);
    
    if (currentCommandTime) {
      const latency = responseTime - currentCommandTime.time;
      commandTimes.push({ command: currentCommandTime.command, latency });
      
      if (currentCommandTime.command === 'poll') {
        console.log(`Poll ${commandTimes.filter(c => c.command === 'poll').length}: ${latency}ms`);
      } else {
        console.log(`${currentCommandTime.command}: ${latency}ms`);
      }
      
      currentCommandTime = null;
    }
    
    if (!response.success) {
      console.error('Error:', response.error);
    }
  } catch (e) {
    console.error('Failed to parse:', e.message);
  }
});

daemon.on('exit', (code) => {
  console.log('\n' + '='.repeat(80));
  console.log('Benchmark Results:');
  console.log('='.repeat(80));
  
  const pollLatencies = commandTimes.filter(c => c.command === 'poll').map(c => c.latency);
  if (pollLatencies.length > 0) {
    const avg = pollLatencies.reduce((a, b) => a + b) / pollLatencies.length;
    const min = Math.min(...pollLatencies);
    const max = Math.max(...pollLatencies);
    
    console.log(`Total polls: ${pollLatencies.length}`);
    console.log(`Min latency: ${min}ms`);
    console.log(`Max latency: ${max}ms`);
    console.log(`Avg latency: ${avg.toFixed(2)}ms`);
    console.log(`\nTarget: 2-5ms per poll (spec requirement)`);
    console.log(`Actual: ${avg.toFixed(2)}ms per poll (${avg > 5 ? '❌ TOO SLOW' : '✅ GOOD'})`);
  }
  
  console.log('='.repeat(80));
  process.exit(code);
});

// Test sequence: init once, then poll 20 times rapidly
function sendCommand(cmd, cmdData) {
  currentCommandTime = { time: Date.now(), command: cmd };
  daemon.stdin.write(JSON.stringify(cmdData) + '\n');
}

setTimeout(() => {
  console.log('Initializing with ALL hardware types...\n');
  sendCommand('init', { 
    cmd: 'init', 
    flags: ['cpu', 'gpu', 'motherboard', 'memory', 'storage', 'network'], 
    flat: false 
  });
  
  setTimeout(() => {
    console.log('Running 20 rapid polls...\n');
    
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      sendCommand('poll', { cmd: 'poll' });
      pollCount++;
      
      if (pollCount >= 20) {
        clearInterval(pollInterval);
        
        setTimeout(() => {
          console.log('\nShutting down...\n');
          sendCommand('shutdown', { cmd: 'shutdown' });
          
          setTimeout(() => process.exit(0), 500);
        }, 100);
      }
    }, 100); // Send polls every 100ms (increased from 50ms)
    
  }, 2000); // Wait 2 seconds for init to complete
}, 500);
