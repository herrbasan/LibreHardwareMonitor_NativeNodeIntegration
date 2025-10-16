#!/usr/bin/env node

/**
 * Performance Test: All Sensor Groups Enabled
 * Measures polling latency with CPU, GPU, Motherboard, Memory, Network, Storage
 * Uses persistent daemon (single instance) for accurate measurements
 */

const { spawn } = require('child_process');
const path = require('path');

const CLI_PATH = path.join(__dirname, '..', 'dist', 'LibreMonCLI.exe');

class PerformanceTest {
    constructor() {
        this.results = [];
        this.cli = null;
    }

    async run() {
        console.log('🚀 Starting LibreMonCLI Performance Test');
        console.log('📊 Testing all sensor groups: CPU, GPU, Motherboard, Memory, Network, Storage');
        console.log('⏱️  Measuring polling latency over 10 iterations\n');

        try {
            // Start daemon once (persistent)
            this.cli = spawn(CLI_PATH, ['--daemon', '--cpu', '--gpu', '--motherboard', '--memory', '--network', '--storage'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Wait for daemon to start
            await this.waitForReady();

            // Initialize once
            console.log('Initializing daemon...');
            const initResponse = await this.sendCommand({"cmd": "init", "flags": ["cpu", "gpu", "motherboard", "memory", "network", "storage"]});
            console.log('✅ Initialization complete\n');

            // Run performance test (multiple polls on same daemon)
            await this.runPerformanceTest();

            // Cleanup
            this.cli.kill();

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            if (this.cli) this.cli.kill();
            process.exit(1);
        }
    }

    waitForReady() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Daemon startup timeout'));
            }, 5000);

            this.cli.stdout.on('data', (data) => {
                clearTimeout(timeout);
                resolve();
            });

            this.cli.stderr.on('data', (data) => {
                console.log('Daemon stderr:', data.toString());
            });
        });
    }

    sendCommand(command) {
        return new Promise((resolve, reject) => {
            const jsonCommand = JSON.stringify(command) + '\n';
            const timeout = setTimeout(() => {
                reject(new Error('Command timeout'));
            }, 10000);

            let responseBuffer = '';

            const onData = (data) => {
                responseBuffer += data.toString();

                // Check for complete JSON response (ends with newline)
                if (responseBuffer.includes('\n')) {
                    clearTimeout(timeout);
                    this.cli.stdout.off('data', onData);

                    try {
                        const response = JSON.parse(responseBuffer.trim());
                        resolve(response);
                    } catch (e) {
                        reject(new Error('Invalid JSON response: ' + responseBuffer));
                    }
                }
            };

            this.cli.stdout.on('data', onData);
            this.cli.stdin.write(jsonCommand);
        });
    }

    async runPerformanceTest() {
        const iterations = 10;
        console.log(`Running ${iterations} polling iterations on persistent daemon...\n`);

        for (let i = 0; i < iterations; i++) {
            const startTime = process.hrtime.bigint();

            try {
                const response = await this.sendCommand({"cmd": "poll"});

                const endTime = process.hrtime.bigint();
                const latencyMs = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

                this.results.push(latencyMs);
                console.log(`📈 Poll ${i + 1}: ${latencyMs.toFixed(2)}ms`);

                // Brief pause between polls
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`❌ Poll ${i + 1} failed:`, error.message);
                this.results.push(null);
            }
        }

        this.analyzeResults();
    }

    analyzeResults() {
        const validResults = this.results.filter(r => r !== null);

        if (validResults.length === 0) {
            console.log('\n❌ No valid results to analyze');
            return;
        }

        const min = Math.min(...validResults);
        const max = Math.max(...validResults);
        const avg = validResults.reduce((a, b) => a + b, 0) / validResults.length;
        const median = this.calculateMedian(validResults);

        console.log('\n📊 Performance Results (All Sensor Groups):');
        console.log('=' .repeat(50));
        console.log(`Iterations: ${this.results.length}`);
        console.log(`Successful: ${validResults.length}`);
        console.log(`Failed: ${this.results.length - validResults.length}`);
        console.log(`Average: ${avg.toFixed(2)}ms`);
        console.log(`Median: ${median.toFixed(2)}ms`);
        console.log(`Min: ${min.toFixed(2)}ms`);
        console.log(`Max: ${max.toFixed(2)}ms`);
        console.log(`95th Percentile: ${this.calculatePercentile(validResults, 95).toFixed(2)}ms`);
        console.log(`99th Percentile: ${this.calculatePercentile(validResults, 99).toFixed(2)}ms`);

        // Recommendations
        console.log('\n💡 Recommendations:');
        if (avg < 50) {
            console.log('✅ Excellent performance - suitable for real-time monitoring');
        } else if (avg < 100) {
            console.log('⚠️ Good performance - consider 500ms+ polling intervals');
        } else {
            console.log('❌ High latency - optimize polling frequency or reduce sensor groups');
        }

        console.log(`\nRecommended polling interval: ${Math.ceil(avg * 2)}ms minimum`);
    }

    calculateMedian(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;

        if (upper >= sorted.length) return sorted[sorted.length - 1];
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
}

// Run the test
if (require.main === module) {
    const test = new PerformanceTest();
    test.run().catch(console.error);
}

module.exports = PerformanceTest;