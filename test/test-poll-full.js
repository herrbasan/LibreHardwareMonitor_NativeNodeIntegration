const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

const exePath = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

console.log('='.repeat(80));
console.log('Full Poll Benchmark - All Available Hardware');
console.log('='.repeat(80));
console.log('\nTesting different hardware combinations...\n');

const tests = [
  { name: 'CPU only', flags: ['cpu'] },
  { name: 'GPU only', flags: ['gpu'] },
  { name: 'CPU + GPU', flags: ['cpu', 'gpu'] },
  { name: 'CPU + GPU + Motherboard', flags: ['cpu', 'gpu', 'motherboard'] },
  { name: 'CPU + GPU + Motherboard + Memory', flags: ['cpu', 'gpu', 'motherboard', 'memory'] },
];

let currentTest = 0;

function runTest(testConfig) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test: ${testConfig.name}`);
    console.log(`Flags: ${testConfig.flags.join(', ')}`);
    console.log('='.repeat(80));
    
    const daemon = spawn(exePath, ['--daemon']);
    const rl = readline.createInterface({
      input: daemon.stdout,
      crlfDelay: Infinity
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
          currentCommandTime = null;
        }
        
        if (!response.success && response.error) {
          console.log(`  Error: ${response.error}`);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });
    
    daemon.on('exit', () => {
      const pollLatencies = commandTimes.filter(c => c.command === 'poll').map(c => c.latency);
      if (pollLatencies.length > 0) {
        const avg = pollLatencies.reduce((a, b) => a + b) / pollLatencies.length;
        const min = Math.min(...pollLatencies);
        const max = Math.max(...pollLatencies);
        
        console.log(`  Polls: ${pollLatencies.length}`);
        console.log(`  Min: ${min}ms | Max: ${max}ms | Avg: ${avg.toFixed(2)}ms`);
      } else {
        console.log('  No successful polls');
      }
      
      resolve();
    });
    
    function sendCommand(cmd, cmdData) {
      currentCommandTime = { time: Date.now(), command: cmd };
      daemon.stdin.write(JSON.stringify(cmdData) + '\n');
    }
    
    setTimeout(() => {
      sendCommand('init', { cmd: 'init', flags: testConfig.flags, flat: false });
      
      setTimeout(() => {
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          sendCommand('poll', { cmd: 'poll' });
          pollCount++;
          
          if (pollCount >= 10) {
            clearInterval(pollInterval);
            setTimeout(() => {
              sendCommand('shutdown', { cmd: 'shutdown' });
            }, 100);
          }
        }, 50);
      }, 500);
    }, 200);
  });
}

async function runAllTests() {
  for (const test of tests) {
    await runTest(test);
    await new Promise(resolve => setTimeout(resolve, 500)); // Pause between tests
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('All tests complete!');
  console.log('='.repeat(80));
}

runAllTests().then(() => process.exit(0));
