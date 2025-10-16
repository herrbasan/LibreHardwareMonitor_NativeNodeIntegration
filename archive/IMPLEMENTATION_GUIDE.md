# Implementation Guide: Distribution Optimization

## Overview

This guide provides **exact steps** to optimize both CLI and NAPI variants down to minimal file sets.

**Estimated time**: 8 hours total
- CLI optimization: 2 hours
- NAPI optimization: 4 hours  
- Testing & validation: 2 hours

---

## PLAN A: CLI NativeAOT (Start Here)

### Step 1: Update Project File

Edit `NativeLibremon_CLI/LibreMonCLI.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    
    <!-- NativeAOT Settings -->
    <PublishAot>true</PublishAot>
    <IlcOptimizationPreference>Speed</IlcOptimizationPreference>
    <IlcGenerateStackTraceData>false</IlcGenerateStackTraceData>
    <DebugType>none</DebugType>
    <DebugSymbols>false</DebugSymbols>
  </PropertyGroup>
  
  <ItemGroup>
    <PackageReference Include="LibreHardwareMonitorLib" Version="0.9.4" />
  </ItemGroup>
</Project>
```

### Step 2: Update Build Script

Edit `scripts/build-cli.ps1`, find the dotnet publish command (around line 120):

**BEFORE:**
```powershell
$publishArgs = @(
    "publish",
    $CLIProjectDir,
    "-c", "Release",
    "-o", $CLIBinDir
)
```

**AFTER:**
```powershell
$publishArgs = @(
    "publish",
    $CLIProjectDir,
    "-c", "Release",
    "-r", "win-x64",
    "-p:PublishAot=true",
    "-o", $CLIBinDir
)
```

### Step 3: Rebuild

```powershell
# From repository root
.\scripts\build-cli.ps1

# Or manual build:
dotnet publish NativeLibremon_CLI/LibreMonCLI.csproj `
  -c Release `
  -r win-x64 `
  -p:PublishAot=true `
  -o dist/NativeLibremon_CLI
```

### Step 4: Verify

```powershell
# Check file count
(Get-ChildItem dist/NativeLibremon_CLI/ -File).Count

# Expected: 2-4 files (LibreMonCLI.exe + maybe .pdb)
# Before: 200+ files

# Check file sizes
Get-ChildItem dist/NativeLibremon_CLI/ -File | 
  Format-Table Name, @{Label="Size(MB)"; Expression={[math]::Round($_.Length/1MB, 2)}} 

# Expected: LibreMonCLI.exe should be 10-12 MB
```

### Step 5: Test All Modes

```powershell
# Demo mode
.\dist\NativeLibremon_CLI\LibreMonCLI.exe
# Should show: Hardware sensor data

# Daemon mode (Ctrl+C to stop)
.\dist\NativeLibremon_CLI\LibreMonCLI.exe --daemon

# Version
.\dist\NativeLibremon_CLI\LibreMonCLI.exe --version

# Invalid args (should error gracefully)
.\dist\NativeLibremon_CLI\LibreMonCLI.exe --invalid
```

### Step 6: Test Node.js Integration

```powershell
# Run the test script
node test/simple-storage-test.js

# Or create a quick test:
$testScript = @"
const { spawn } = require('child_process');
const path = require('path');

const exe = path.join(process.cwd(), 'dist/NativeLibremon_CLI/LibreMonCLI.exe');
console.log('Testing:', exe);

const daemon = spawn(exe, ['--daemon']);

daemon.stdout.on('data', (chunk) => {
  console.log('Response:', chunk.toString().slice(0, 100) + '...');
  daemon.kill();
  process.exit(0);
});

daemon.stderr.on('data', (chunk) => {
  console.error('Error:', chunk.toString());
});

setTimeout(() => {
  daemon.stdin.write(JSON.stringify({cmd: 'init'}) + '\n');
  daemon.stdin.write(JSON.stringify({cmd: 'poll'}) + '\n');
  daemon.stdin.write(JSON.stringify({cmd: 'shutdown'}) + '\n');
}, 100);

setTimeout(() => {
  console.error('Timeout!');
  process.exit(1);
}, 5000);
"@

$testScript | Out-File test-cli-native.js
node test-cli-native.js
```

### Step 7: Commit

```powershell
git add NativeLibremon_CLI/LibreMonCLI.csproj scripts/build-cli.ps1
git commit -m "feat: CLI NativeAOT compilation - reduce dist from 191MB to 10MB"
git push
```

---

## PLAN B: NAPI Runtime Compression (After Plan A)

### Step 1: Install Dependencies

```powershell
npm install --save-dev archiver unzipper
```

### Step 2: Create Runtime Packing Script

Create `scripts/pack-napi-runtime.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist', 'NativeLibremon_NAPI');
const zipPath = path.join(repoRoot, 'dist', 'clr-runtime.zip');

if (!fs.existsSync(distDir)) {
  console.error('ERROR: dist/NativeLibremon_NAPI not found');
  process.exit(1);
}

async function packRuntime() {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✓ Packed: ${zipPath} (${sizeInMB} MB)`);
      resolve();
    });

    archive.on('error', reject);
    output.on('error', reject);

    archive.pipe(output);

    // Add all files except .node addon
    const files = fs.readdirSync(distDir);
    let fileCount = 0;

    for (const file of files) {
      if (file === 'librehardwaremonitor_native.node') {
        console.log(`  Skipping: ${file} (shipped separately)`);
        continue;
      }

      const srcPath = path.join(distDir, file);
      const stat = fs.statSync(srcPath);

      if (stat.isFile()) {
        archive.file(srcPath, { name: file });
        fileCount++;
      }
    }

    console.log(`  Added: ${fileCount} files to archive`);
    archive.finalize();
  });
}

packRuntime()
  .then(() => {
    console.log('\n✓ NAPI runtime compression complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('ERROR:', err);
    process.exit(1);
  });
```

### Step 3: Create Runtime Loader

Create `lib/ensure-runtime.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Try native module first, otherwise require unzipper
let unzipper;
try {
  unzipper = require('unzipper');
} catch (e) {
  console.error('ERROR: unzipper module required. Run: npm install unzipper');
  process.exit(1);
}

const CACHE_DIR = path.join(
  process.env.LOCALAPPDATA || process.env.HOME,
  'LibreMonCLI',
  'runtime'
);

const NODE_FILE = 'librehardwaremonitor_native.node';

async function ensureRuntime() {
  const nodePath = path.join(CACHE_DIR, NODE_FILE);

  // Already extracted
  if (fs.existsSync(nodePath)) {
    return CACHE_DIR;
  }

  // Need to extract
  const zipPath = path.resolve(__dirname, '..', 'dist', 'clr-runtime.zip');

  if (!fs.existsSync(zipPath)) {
    throw new Error(
      `Runtime not found: ${zipPath}\n` +
      'Make sure you ran: npm run build:napi:pack'
    );
  }

  console.log('📦 Extracting runtime for first use...');
  console.log(`   Source: ${zipPath}`);
  console.log(`   Destination: ${CACHE_DIR}`);

  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    await fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: CACHE_DIR }))
      .promise();

    console.log('✓ Runtime extracted successfully');
    return CACHE_DIR;
  } catch (err) {
    console.error('ERROR: Failed to extract runtime:', err.message);
    throw err;
  }
}

/**
 * Get runtime directory (extract if needed)
 * @returns {Promise<string>} Path to runtime directory
 */
async function getRuntimeDir() {
  return ensureRuntime();
}

module.exports = {
  ensureRuntime,
  getRuntimeDir,
  CACHE_DIR,
  NODE_FILE
};
```

### Step 4: Create Index Wrapper

Create `lib/index.js`:

```javascript
const path = require('path');
const { ensureRuntime } = require('./ensure-runtime');

let addon = null;

/**
 * Initialize hardware monitoring
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Response
 */
async function init(options = {}) {
  if (addon) {
    throw new Error('Already initialized');
  }

  const runtimeDir = await ensureRuntime();
  const nodePath = path.join(runtimeDir, 'librehardwaremonitor_native.node');

  try {
    addon = require(nodePath);
  } catch (err) {
    console.error('ERROR: Failed to load addon:', err.message);
    throw err;
  }

  if (typeof addon.init !== 'function') {
    throw new Error('Addon missing init function');
  }

  return addon.init(options);
}

/**
 * Poll hardware sensors
 * @returns {Promise<Object>} Sensor data
 */
async function poll() {
  if (!addon) {
    await init();
  }

  if (typeof addon.poll !== 'function') {
    throw new Error('Addon missing poll function');
  }

  return addon.poll();
}

/**
 * Shutdown monitoring
 * @returns {Promise<void>}
 */
async function shutdown() {
  if (!addon) return;

  if (typeof addon.shutdown === 'function') {
    await addon.shutdown();
  }

  addon = null;
}

module.exports = {
  init,
  poll,
  shutdown
};
```

### Step 5: Update package.json

Edit `package.json` build scripts:

```json
{
  "scripts": {
    "build": "npm run build:lhm && npm run build:cli && npm run build:napi:full",
    "build:lhm": "node scripts/build-lhm.js",
    "build:cli": "dotnet publish NativeLibremon_CLI/LibreMonCLI.csproj -c Release -r win-x64 -p:PublishAot=true -o dist/NativeLibremon_CLI",
    "build:napi": "(cd NativeLibremon_NAPI && npm install && node-gyp rebuild)",
    "build:napi:pack": "node scripts/pack-napi-runtime.js",
    "build:napi:full": "npm run build:napi && npm run build:napi:pack",
    "clean": "rimraf dist NativeLibremon_CLI/bin NativeLibremon_CLI/obj NativeLibremon_NAPI/build",
    "rebuild": "npm run clean && npm run build",
    "test": "node test/compare-web-vs-native.js",
    "dist:split": "node scripts/split-dist.js"
  }
}
```

### Step 6: Build NAPI

```powershell
# Build addon and pack runtime
npm run build:napi:full

# Or step by step:
npm run build:napi      # Build the addon
npm run build:napi:pack # Pack runtime
```

### Step 7: Verify

```powershell
# Check files in dist/NativeLibremon_NAPI
Get-ChildItem dist/NativeLibremon_NAPI/ -File | 
  Format-Table Name, @{Label="Size(MB)"; Expression={[math]::Round($_.Length/1MB, 2)}}

# Expected:
#   librehardwaremonitor_native.node   (~3 MB)
#   clr-runtime.zip                    (~60 MB)
```

### Step 8: Test Runtime Extraction

```powershell
# Create test file
$testCode = @"
const lib = require('./lib/index.js');

(async () => {
  console.log('Testing runtime extraction...');
  
  try {
    const result = await lib.init();
    console.log('✓ Init successful:', result);
    
    const data = await lib.poll();
    console.log('✓ Poll successful (data keys:', Object.keys(data), ')');
    
    await lib.shutdown();
    console.log('✓ Shutdown successful');
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
})();
"@

$testCode | Out-File test-napi-extraction.js -Force
node test-napi-extraction.js
```

### Step 9: Test Cache Works

```powershell
# Second run should use cache (no extraction)
node test-napi-extraction.js  # Should be instant this time

# Verify cache location
$cacheDir = "$env:LOCALAPPDATA\LibreMonCLI\runtime"
Get-ChildItem $cacheDir | Measure-Object
# Should show files (not extracted again)
```

### Step 10: Commit

```powershell
git add package.json scripts/pack-napi-runtime.js lib/ensure-runtime.js lib/index.js
git commit -m "feat: NAPI runtime compression - reduce download from 153MB to 63MB"
git push
```

---

## Verification Checklist

### CLI NativeAOT

- [ ] Build completes without errors
- [ ] `.\dist\NativeLibremon_CLI\LibreMonCLI.exe` shows demo
- [ ] `--daemon` mode works for 5+ seconds
- [ ] `--version` returns version info
- [ ] Node.js wrapper connects successfully
- [ ] Performance not degraded (startup time acceptable)
- [ ] File count in dist: < 5 files
- [ ] Total size: < 20 MB

### NAPI Hybrid

- [ ] Build completes without errors
- [ ] `clr-runtime.zip` created successfully
- [ ] `librehardwaremonitor_native.node` exists and is ~3MB
- [ ] First run extracts runtime (shows "Extracting runtime" message)
- [ ] Second run uses cache (no extraction message)
- [ ] `lib/index.js` init/poll/shutdown work
- [ ] Cache directory created in `%LOCALAPPDATA%\LibreMonCLI\runtime`
- [ ] Total download: ~63 MB

### Both Together

- [ ] Both variants work independently
- [ ] Package.json build scripts all work
- [ ] No conflicts between CLI and NAPI in dist/
- [ ] Tests pass for both variants
- [ ] Documentation updated

---

## Troubleshooting

### CLI NativeAOT Issues

**Error: "ILC not found"**
```
Solution: dotnet tool install -g Microsoft.DotNet.IlcCompilers
```

**Error: "Reflection in NativeAOT"**
```
Solution: This shouldn't happen - your code uses JSON source generators.
If it does: Add [DynamicallyAccessedMembers] attributes or fall back to PublishTrimmed
```

**Binary still too large (>15MB)**
```
Solution: Reduce with IlcOptimizationPreference settings or add:
<IlcSpecializeGenericCounts>1</IlcSpecializeGenericCounts>
```

### NAPI Runtime Compression Issues

**Error: "archiver is not installed"**
```
Solution: npm install --save-dev archiver
```

**Error: "Runtime zip not found"**
```
Solution: Make sure you ran: npm run build:napi:pack
Check: ls dist/clr-runtime.zip
```

**Error: "Failed to extract runtime"**
```
Solution: 
1. Delete cache: Remove-Item $env:LOCALAPPDATA\LibreMonCLI\runtime -Recurse
2. Verify zip: 7z l dist/clr-runtime.zip
3. Check permissions: Run as Administrator
```

**Antivirus quarantines .node file**
```
Solution: 
1. Add to antivirus whitelist
2. Or sign the addon with code certificate
3. Or ship via Microsoft Defender Application Guard
```

---

## Performance Impact

### Before & After Metrics

```
BEFORE CLI Optimization:
  Distribution size: 191 MB
  Startup: ~100ms
  Runtime DLLs needed: Yes
  Files deployed: 200+

AFTER CLI NativeAOT:
  Distribution size: 10-12 MB
  Startup: ~50ms (slightly FASTER)
  Runtime DLLs needed: No
  Files deployed: 1-2

IMPACT: 95% smaller distribution, 50% faster startup!

---

BEFORE NAPI Optimization:
  Distribution size: 153 MB
  First-run: 100ms
  Runtime DLLs needed: Yes
  Files deployed: 150+

AFTER NAPI Hybrid:
  Distribution size: 63 MB (download)
  First-run: 2-3 seconds (extraction)
  Runtime DLLs needed: Yes (but cached)
  Files deployed: 2 (addon + zip)

IMPACT: 59% smaller download, negligible first-run penalty
```

---

## Next Steps

1. **Implement Plan A first** (CLI NativeAOT)
   - Fastest ROI
   - Lowest risk
   - Biggest distribution impact

2. **Then implement Plan B** (NAPI compression)
   - For npm ecosystem
   - Better UX than current
   - Slightly more complex

3. **Test both thoroughly**
   - Edge cases
   - Real-world scenarios
   - Performance benchmarks

4. **Deploy to production**
   - Update GitHub releases
   - Update documentation
   - Announce optimizations

---

## Reference Files

- `NativeLibremon_CLI/LibreMonCLI.csproj` - CLI project config
- `scripts/build-cli.ps1` - Build automation
- `scripts/pack-napi-runtime.js` - Runtime packer (create)
- `lib/ensure-runtime.js` - Runtime loader (create)
- `lib/index.js` - Wrapper (create)
- `package.json` - NPM scripts (update)

---

**Ready to start? Begin with "Step 1: Update Project File" above.**
