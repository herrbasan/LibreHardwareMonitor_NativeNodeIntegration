/**
 * Copy .NET self-contained runtime files to build output
 * This ensures all necessary runtime DLLs are available for the native addon
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLISH_DIR = path.join(ROOT, 'managed', 'LibreHardwareMonitorBridge', 'bin', 'Release', 'net9.0', 'win-x64', 'publish');
const BUILD_DIR = path.join(ROOT, 'build', 'Release');

console.log('Copying .NET runtime files from publish to build output...');

if (!fs.existsSync(PUBLISH_DIR)) {
    console.error(`ERROR: Publish directory not found: ${PUBLISH_DIR}`);
    console.error('Run "npm run build:bridge" first.');
    process.exit(1);
}

if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}

// Get all DLL files from publish directory
const files = fs.readdirSync(PUBLISH_DIR);
const dllFiles = files.filter(f => f.endsWith('.dll') || f.endsWith('.json'));

let copiedCount = 0;
let skippedCount = 0;

for (const file of dllFiles) {
    const srcPath = path.join(PUBLISH_DIR, file);
    const dstPath = path.join(BUILD_DIR, file);
    
    // Special handling for runtimeconfig.json - remove includedFrameworks for self-contained
    if (file.endsWith('.runtimeconfig.json')) {
        const config = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
        
        // Remove includedFrameworks for self-contained deployments
        if (config.runtimeOptions && config.runtimeOptions.includedFrameworks) {
            console.log(`Fixing ${file}: Removing includedFrameworks for self-contained deployment`);
            delete config.runtimeOptions.includedFrameworks;
        }
        
        fs.writeFileSync(dstPath, JSON.stringify(config, null, 2));
        copiedCount++;
        continue;
    }
    
    // Check if file already exists and is identical (skip if so)
    if (fs.existsSync(dstPath)) {
        const srcStats = fs.statSync(srcPath);
        const dstStats = fs.statSync(dstPath);
        if (srcStats.size === dstStats.size && srcStats.mtime <= dstStats.mtime) {
            skippedCount++;
            continue;
        }
    }
    
    fs.copyFileSync(srcPath, dstPath);
    copiedCount++;
}

console.log(`✓ Copied ${copiedCount} files, skipped ${skippedCount} unchanged files`);
console.log(`Build output: ${BUILD_DIR}`);
