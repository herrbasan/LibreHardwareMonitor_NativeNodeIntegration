# Submodule Integration Guide

This document explains how to integrate `librehardwaremonitor-native` as a git submodule in your Node.js or Electron project.

## Adding as Submodule

From your main project directory:

```bash
# Add as submodule (example: in a 'native' or 'lib' directory)
git submodule add https://github.com/herrbasan/LibreHardwareMonitor_NativeNodeIntegration.git lib/librehardwaremonitor-native

# Initialize and update submodule
git submodule update --init --recursive

# Commit the submodule addition
git add .gitmodules lib/librehardwaremonitor-native
git commit -m "Add librehardwaremonitor-native as submodule"
```

## Building the Submodule

### Prerequisites

The submodule requires:
- **Node.js** 16.x or later
- **.NET SDK** 6.0 or later (for building LibreHardwareMonitor)
- **Visual Studio 2019+** with C++ build tools
- **Python** 3.x (for node-gyp)

### Build Process

```bash
# Navigate to submodule directory
cd lib/librehardwaremonitor-native

# Install dependencies and build everything
npm install

# This will:
# 1. Build LibreHardwareMonitor from source (build:lhm)
# 2. Build the C# bridge (build:bridge)
# 3. Build the native addon (build:native)
```

The build output will be in `lib/librehardwaremonitor-native/build/Release/`:
- `librehardwaremonitor_native.node` - The native addon
- `LibreHardwareMonitorLib.dll` - LibreHardwareMonitor library
- `LibreHardwareMonitorBridge.dll` - C# bridge
- All required dependencies (.NET assemblies, HidSharp, etc.)

## Using in Your Project

### Option 1: Direct Require (Recommended for Development)

```javascript
// In your main project code
const nativeMonitor = require('./lib/librehardwaremonitor-native');

// Initialize with hardware types
await nativeMonitor.init({
  cpu: true,
  gpu: true,
  motherboard: true,
  memory: true,
  storage: false,
  network: false
});

// Poll sensors (returns JSON matching LibreHardwareMonitor web endpoint)
const sensorData = nativeMonitor.poll();

// Shutdown
nativeMonitor.shutdown();
```

### Option 2: Copy Build Artifacts (Recommended for Production)

For Electron apps, you may want to copy the built addon to your app's resources:

```javascript
// In your build script (e.g., electron-builder beforePack hook)
const fs = require('fs-extra');
const path = require('path');

const submodulePath = path.join(__dirname, 'lib/librehardwaremonitor-native/build/Release');
const targetPath = path.join(__dirname, 'app/native');

// Copy all required files
fs.copySync(submodulePath, targetPath);
```

Then require from the copied location:

```javascript
const nativeMonitor = require(path.join(__dirname, 'native/librehardwaremonitor_native.node'));
```

### Option 3: Package.json Integration

Add to your main project's `package.json`:

```json
{
  "scripts": {
    "postinstall": "cd lib/librehardwaremonitor-native && npm install",
    "build:native": "cd lib/librehardwaremonitor-native && npm run rebuild"
  }
}
```

## Updating the Submodule

When the native addon is updated:

```bash
# From your main project root
cd lib/librehardwaremonitor-native

# Pull latest changes
git pull origin main

# Rebuild if needed
npm run rebuild

# Commit the submodule update in your main project
cd ../..
git add lib/librehardwaremonitor-native
git commit -m "Update librehardwaremonitor-native submodule"
```

## Working on the Submodule

To make changes to the native addon while working in your main project:

```bash
# Navigate to submodule
cd lib/librehardwaremonitor-native

# Create a branch for your changes
git checkout -b feature/my-improvement

# Make changes, test, commit
git add .
git commit -m "Improve sensor polling performance"

# Push to submodule repository
git push origin feature/my-improvement

# Create PR in the submodule repository
# After merge, update main project to use new version
```

## Administrator Privileges

**IMPORTANT**: LibreHardwareMonitor requires elevated privileges for hardware access.

### For Development

Run your Node.js process or Electron app as Administrator:

```powershell
# PowerShell
Start-Process node -ArgumentList "your-app.js" -Verb RunAs

# Or for Electron
Start-Process electron -ArgumentList "." -Verb RunAs
```

### For Production (Electron)

Add to your application manifest (`app.manifest`):

```xml
<requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
```

And configure in `package.json` (electron-builder):

```json
{
  "build": {
    "win": {
      "requestedExecutionLevel": "requireAdministrator"
    }
  }
}
```

## Fallback Strategy

Implement graceful degradation to web polling if native addon fails:

```javascript
class HardwareMonitor {
  constructor() {
    this.backend = null;
    this.useNative = true;
  }
  
  async init() {
    if (this.useNative) {
      try {
        const native = require('./lib/librehardwaremonitor-native');
        await native.init({ cpu: true, gpu: true, memory: true });
        this.backend = native;
        console.log('✓ Using native hardware monitoring');
      } catch (err) {
        console.warn('Native monitoring unavailable:', err.message);
        console.log('Falling back to web polling...');
        this.backend = new WebPollingBackend();
        await this.backend.init();
      }
    }
  }
  
  poll() {
    return this.backend.poll();
  }
  
  shutdown() {
    if (this.backend && this.backend.shutdown) {
      this.backend.shutdown();
    }
  }
}
```

## Troubleshooting

### Submodule Not Initialized

```bash
git submodule update --init --recursive
```

### Build Fails

```bash
# Clean and rebuild
cd lib/librehardwaremonitor-native
npm run clean
npm run rebuild
```

### Missing .NET Runtime

Install .NET Runtime 6.0 or later:
https://dotnet.microsoft.com/download/dotnet/6.0

### Access Denied Errors

Ensure your application is running as Administrator.

### LibreHardwareMonitor DLL Not Found

Verify all files from `build/Release/` are deployed with your application:
- `librehardwaremonitor_native.node`
- `LibreHardwareMonitorLib.dll`
- `LibreHardwareMonitorBridge.dll`
- `HidSharp.dll`
- All `System.*.dll` files
- `nethost.dll`
- `.deps.json` and `.runtimeconfig.json` files

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build with Native Addon

on: [push, pull_request]

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
      with:
        submodules: recursive
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Setup .NET
      uses: actions/setup-dotnet@v3
      with:
        dotnet-version: '8.0.x'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build native addon
      run: |
        cd lib/librehardwaremonitor-native
        npm install
        npm run rebuild
    
    - name: Run tests
      run: npm test
```

## Support

For issues with:
- **Native addon functionality**: Open issue in [LibreHardwareMonitor_NativeNodeIntegration](https://github.com/herrbasan/LibreHardwareMonitor_NativeNodeIntegration)
- **LibreHardwareMonitor sensors**: Open issue in [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor)
- **Your application integration**: Check your application's error logs first

## License

This native addon is licensed under MIT. LibreHardwareMonitor is licensed under MPL 2.0.
