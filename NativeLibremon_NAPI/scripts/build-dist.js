#!/usr/bin/env node
/**
 * Build distribution folder
 * Creates a self-contained, copy-ready folder with:
 * - Native addon (.node file)
 * - All .NET runtime DLLs
 * - JavaScript wrapper (index.js)
 * - package.json for require() compatibility
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, '..', 'dist', 'native-libremon-napi');
const buildDir = path.join(root, 'build', 'Release');
const managedPublish = path.join(root, '..', 'managed', 'LibreHardwareMonitorBridge', 'bin', 'Release', 'net9.0', 'win-x64', 'publish-selfcontained');

// Clean dist directory
if (fs.existsSync(distDir)) {
    console.log('Cleaning existing dist folder...');
    fs.rmSync(distDir, { recursive: true, force: true });
}

fs.mkdirSync(distDir, { recursive: true });

console.log('Building distribution folder:', distDir);

// 1. Copy native addon
const addonSrc = path.join(buildDir, 'librehardwaremonitor_native.node');
const addonDst = path.join(distDir, 'librehardwaremonitor_native.node');

if (!fs.existsSync(addonSrc)) {
    console.error('❌ Native addon not found:', addonSrc);
    console.error('   Run "npm run build:native" first');
    process.exit(1);
}

console.log('✓ Copying native addon...');
fs.copyFileSync(addonSrc, addonDst);

// 2. Copy all .NET runtime DLLs
if (!fs.existsSync(managedPublish)) {
    console.error('❌ Managed runtime not found:', managedPublish);
    console.error('   Run "npm run build:managed" first');
    process.exit(1);
}

console.log('✓ Copying .NET runtime files...');
let dllCount = 0;
for (const file of fs.readdirSync(managedPublish)) {
    const src = path.join(managedPublish, file);
    const dst = path.join(distDir, file);
    
    if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dst);
        if (file.endsWith('.dll')) dllCount++;
    }
}

console.log(`  Copied ${dllCount} DLL files`);

// 3. Copy nethost.dll if not already present
if (!fs.existsSync(path.join(distDir, 'nethost.dll'))) {
    try {
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const packsRoot = path.join(programFiles, 'dotnet', 'packs', 'Microsoft.NETCore.App.Host.win-x64');
        
        if (fs.existsSync(packsRoot)) {
            const versions = fs.readdirSync(packsRoot)
                .filter(d => fs.statSync(path.join(packsRoot, d)).isDirectory())
                .sort()
                .reverse();
            
            for (const version of versions) {
                const candidate = path.join(packsRoot, version, 'runtimes', 'win-x64', 'native', 'nethost.dll');
                if (fs.existsSync(candidate)) {
                    fs.copyFileSync(candidate, path.join(distDir, 'nethost.dll'));
                    console.log('✓ Copied nethost.dll');
                    break;
                }
            }
        }
    } catch (err) {
        console.warn('⚠ Failed to copy nethost.dll:', err.message);
    }
}

// 4. Copy JavaScript wrapper
const indexJs = path.join(root, 'lib', 'index.js');
const indexDst = path.join(distDir, 'index.js');

if (fs.existsSync(indexJs)) {
    console.log('✓ Copying index.js...');
    fs.copyFileSync(indexJs, indexDst);
} else {
    console.warn('⚠ index.js not found in lib/, creating minimal version');
    fs.writeFileSync(indexDst, `// Generated wrapper
module.exports = require('./librehardwaremonitor_native.node');
`);
}

// 5. Create package.json for the dist folder
const packageJson = {
    name: 'native-libremon-napi',
    version: '0.1.0',
    description: 'LibreHardwareMonitor N-API addon - self-contained distribution',
    main: 'index.js',
    os: ['win32'],
    cpu: ['x64']
};

fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
);

console.log('✓ Created package.json');

// 6. Create README
const readme = `# native-libremon-napi

Self-contained LibreHardwareMonitor N-API addon.

## Usage

\`\`\`javascript
const monitor = require('./native-libremon-napi');

// Initialize
await monitor.init({
    cpu: true,
    gpu: true,
    memory: true
});

// Poll sensors
const data = await monitor.poll();
console.log(data);

// Cleanup
await monitor.shutdown();
\`\`\`

## Requirements

- Windows x64
- Administrator privileges for hardware access
- Node.js 16+ or Electron

## Contents

- \`librehardwaremonitor_native.node\` - Native N-API addon
- \`LibreHardwareMonitorBridge.dll\` - .NET bridge
- \`*.dll\` - Self-contained .NET 9.0 runtime (~200 files)
- \`index.js\` - JavaScript API wrapper
`;

fs.writeFileSync(path.join(distDir, 'README.md'), readme);
console.log('✓ Created README.md');

const stats = fs.statSync(distDir);
const files = fs.readdirSync(distDir);
const totalSize = files.reduce((sum, file) => {
    const filePath = path.join(distDir, file);
    return sum + (fs.statSync(filePath).isFile() ? fs.statSync(filePath).size : 0);
}, 0);

console.log('\n✅ Distribution built successfully!');
console.log(`   Location: ${distDir}`);
console.log(`   Files: ${files.length}`);
console.log(`   Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log('\n📦 Copy this folder to your project and require it:');
console.log(`   const monitor = require('./native-libremon-napi');`);
