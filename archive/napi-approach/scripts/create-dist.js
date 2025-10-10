/**
 * Create distribution package
 * 
 * This script packages all necessary files for distribution:
 * - Built native addon (.node file)
 * - All DLL dependencies
 * - Runtime config files
 * - JavaScript interface files
 * - README and license
 * 
 * Users can extract and use without building from source.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build', 'Release');
const DIST_DIR = path.join(ROOT, 'dist');
const LIB_DIR = path.join(ROOT, 'lib');

// Get version from package.json
const packageJson = require(path.join(ROOT, 'package.json'));
const VERSION = packageJson.version;

// Helper: Recursively remove directory
function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(file => {
            const curPath = path.join(dir, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                removeDir(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(dir);
    }
}

// Helper: Recursively copy directory
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Creating Distribution Package');
console.log('='.repeat(60));
console.log(`Version: ${VERSION}\n`);

async function createDistribution() {
    try {
        // 1. Clean dist directory
        console.log('1. Cleaning dist directory...');
        if (fs.existsSync(DIST_DIR)) {
            removeDir(DIST_DIR);
        }
        fs.mkdirSync(DIST_DIR, { recursive: true });
        console.log('   ✓ Cleaned\n');

        // 2. Check if build exists
        console.log('2. Checking build artifacts...');
        if (!fs.existsSync(BUILD_DIR)) {
            console.error('   ✗ Build directory not found!');
            console.error('   Run "npm run build" first.');
            process.exit(1);
        }
        
        const addonFile = path.join(BUILD_DIR, 'librehardwaremonitor_native.node');
        if (!fs.existsSync(addonFile)) {
            console.error('   ✗ Native addon not found!');
            console.error('   Run "npm run build:native" first.');
            process.exit(1);
        }
        console.log('   ✓ Build artifacts found\n');

        // 3. Copy native addon
        console.log('3. Copying native addon...');
        fs.copyFileSync(
            addonFile,
            path.join(DIST_DIR, 'librehardwaremonitor_native.node')
        );
        console.log('   ✓ librehardwaremonitor_native.node\n');

        // 4. Copy all DLL dependencies from build/Release
        // The build process already copied everything we need there
        console.log('4. Copying DLL dependencies from build output...');
        
        const buildFiles = fs.readdirSync(BUILD_DIR);
        const dllAndConfigFiles = buildFiles.filter(f => 
            f.endsWith('.dll') || 
            f.endsWith('.json') || 
            f.endsWith('.pdb')
        );
        
        let copiedCount = 0;
        for (const file of dllAndConfigFiles) {
            const srcPath = path.join(BUILD_DIR, file);
            const dstPath = path.join(DIST_DIR, file);
            
            // Skip debug symbols (.pdb files) to reduce size
            if (file.endsWith('.pdb')) {
                continue;
            }
            
            fs.copyFileSync(srcPath, dstPath);
            console.log(`   ✓ ${file}`);
            copiedCount++;
        }
        
        console.log(`   Copied ${copiedCount} files\n`);

        // 5. Copy JavaScript interface with modified paths
        console.log('5. Copying JavaScript interface...');
        fs.mkdirSync(path.join(DIST_DIR, 'lib'), { recursive: true });
        
        // Create modified index.js for dist (load .node from parent directory)
        const indexContent = fs.readFileSync(path.join(LIB_DIR, 'index.js'), 'utf8');
        const modifiedIndex = indexContent.replace(
            "require('../build/Release/librehardwaremonitor_native.node')",
            "require('../librehardwaremonitor_native.node')"
        );
        fs.writeFileSync(
            path.join(DIST_DIR, 'lib', 'index.js'),
            modifiedIndex
        );
        
        console.log('   ✓ lib/index.js (modified for dist)\n');

        // 6. Create package.json for dist
        console.log('6. Creating package.json...');
        const distPackageJson = {
            name: packageJson.name,
            version: VERSION,
            description: packageJson.description + ' (pre-built distribution)',
            main: 'lib/index.js',
            keywords: packageJson.keywords,
            author: packageJson.author,
            license: packageJson.license,
            repository: packageJson.repository,
            engines: packageJson.engines,
            os: packageJson.os,
            dependencies: {
                // No build dependencies needed for pre-built dist
            }
        };
        fs.writeFileSync(
            path.join(DIST_DIR, 'package.json'),
            JSON.stringify(distPackageJson, null, 2)
        );
        console.log('   ✓ package.json\n');

        // 7. Copy documentation
        console.log('7. Copying documentation...');
        const docFiles = [
            'README.md',
            'LICENSE'
        ];
        for (const file of docFiles) {
            const srcPath = path.join(ROOT, file);
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, path.join(DIST_DIR, file));
                console.log(`   ✓ ${file}`);
            }
        }
        
        // Copy docs from docs/ folder
        const docsToInclude = [
            'SUBMODULE_INTEGRATION.md'
        ];
        for (const file of docsToInclude) {
            const srcPath = path.join(ROOT, 'docs', file);
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, path.join(DIST_DIR, file));
                console.log(`   ✓ ${file} (from docs/)`);
            }
        }
        console.log();

        // 8. Get LibreHardwareMonitor submodule info
        console.log('8. Reading LibreHardwareMonitor version info...');
        let lhmCommit = 'unknown';
        let lhmDate = 'unknown';
        let lhmMessage = 'unknown';
        
        const lhmPath = path.join(ROOT, 'deps', 'LibreHardwareMonitor-src');
        if (fs.existsSync(path.join(lhmPath, '.git'))) {
            try {
                lhmCommit = execSync('git log -1 --format="%H"', { 
                    cwd: lhmPath, 
                    encoding: 'utf8' 
                }).trim().replace(/"/g, '');
                
                lhmDate = execSync('git log -1 --format="%ai"', { 
                    cwd: lhmPath, 
                    encoding: 'utf8' 
                }).trim().replace(/"/g, '');
                
                lhmMessage = execSync('git log -1 --format="%s"', { 
                    cwd: lhmPath, 
                    encoding: 'utf8' 
                }).trim().replace(/"/g, '');
                
                console.log(`   ✓ LibreHardwareMonitor commit: ${lhmCommit.substring(0, 7)}`);
                console.log(`   ✓ Date: ${lhmDate.split(' ')[0]}`);
            } catch (err) {
                console.warn('   ⚠ Could not read LibreHardwareMonitor git info');
            }
        }
        console.log();

        // 9. Create DIST_README.md with usage instructions
        console.log('9. Creating distribution README...');
        const distReadme = `# LibreHardwareMonitor Native - Pre-built Distribution

This is a **pre-built distribution** of librehardwaremonitor-native v${VERSION}.

## ⚡ Quick Start (No Build Required!)

This package contains all compiled binaries. No build tools needed!

### Requirements

- **Windows 10/11** (64-bit)
- **.NET Runtime 6.0+** ([Download](https://dotnet.microsoft.com/download/dotnet/6.0))
- **Node.js 16.0.0+**
- **Administrator privileges** (LibreHardwareMonitor limitation)

### Usage

\`\`\`javascript
const monitor = require('./path/to/dist');

async function main() {
    await monitor.init({ cpu: true, gpu: true, memory: true });
    const data = await monitor.poll();
    console.log(data);
    await monitor.shutdown();
}

main();
\`\`\`

### Files Included

- \`librehardwaremonitor_native.node\` - Native Node.js addon
- \`LibreHardwareMonitorLib.dll\` - LibreHardwareMonitor library
- \`LibreHardwareMonitorBridge.dll\` - C# bridge
- All required .NET dependencies
- JavaScript interface (\`lib/\`)

### LibreHardwareMonitor Version

This distribution includes LibreHardwareMonitor built from source:

- **Commit**: [\`${lhmCommit.substring(0, 7)}\`](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/commit/${lhmCommit})
- **Date**: ${lhmDate.split(' ')[0]}
- **Message**: ${lhmMessage}

Full commit: \`${lhmCommit}\`

**Note**: You can replace \`LibreHardwareMonitorLib.dll\` with a different version if needed (e.g., for bug fixes or newer hardware support). Ensure the replacement version is API-compatible. If you experience crashes, verify you have the matching .NET dependencies. For major LHM updates, rebuilding from source is recommended.

### Administrator Privileges

LibreHardwareMonitor requires admin rights for hardware access:

\`\`\`powershell
# Development
Start-Process node -ArgumentList "your-app.js" -Verb RunAs

# Production (Electron)
# Add to app.manifest:
# <requestedExecutionLevel level="requireAdministrator" />
\`\`\`

### Filtering Options

\`\`\`javascript
// Filter out virtual network adapters
await monitor.init({ 
    cpu: true, 
    gpu: true, 
    filterVirtualNics: true 
});

// Filter out individual memory DIMMs (keep only total/virtual memory)
await monitor.init({ 
    memory: true, 
    filterDIMMs: true 
});
\`\`\`

**Note**: Data flattening should be implemented in your application code if needed.
The library provides raw hierarchical JSON matching LibreHardwareMonitor's web endpoint format.

## 📦 Build From Source Alternative

If you prefer building from source (recommended for development):

\`\`\`bash
git clone --recurse-submodules https://github.com/herrbasan/LibreHardwareMonitor_NativeNodeIntegration.git
cd LibreHardwareMonitor_NativeNodeIntegration
npm install
\`\`\`

See main README.md for details.

## 📄 License

MIT - See LICENSE file

## 🤖 Note

100% of this project was generated by Claude Sonnet 4.5.

---

**Version**: ${VERSION}  
**Build Date**: ${new Date().toISOString()}  
**LibreHardwareMonitor**: [\`${lhmCommit.substring(0, 7)}\`](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/commit/${lhmCommit}) (${lhmDate.split(' ')[0]})  
**Repository**: https://github.com/herrbasan/LibreHardwareMonitor_NativeNodeIntegration
`;
        
        fs.writeFileSync(path.join(DIST_DIR, 'DIST_README.md'), distReadme);
        console.log('   ✓ DIST_README.md\n');

        // 10. Get total size
        console.log('10. Calculating package size...');
        const getDirectorySize = (dir) => {
            let size = 0;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    size += getDirectorySize(filePath);
                } else {
                    size += stats.size;
                }
            }
            return size;
        };
        
        const totalSize = getDirectorySize(DIST_DIR);
        console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`);

        // Summary
        console.log('='.repeat(60));
        console.log('✓ Distribution package created successfully!\n');
        console.log('Output:');
        console.log(`  - dist/ folder (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log('\nUsage:');
        console.log('  1. Clone repository to get dist/ folder');
        console.log('  2. Users require: require("./dist")');
        console.log('  3. No build tools required!\n');

    } catch (err) {
        console.error('\n✗ Distribution creation failed:');
        console.error(err.message);
        process.exit(1);
    }
}

createDistribution();
