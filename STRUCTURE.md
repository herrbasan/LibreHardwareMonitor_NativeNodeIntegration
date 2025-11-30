# Directory Structure

Clean, focused structure for N-API addon development.

## Essential Directories

### `NativeLibremon_NAPI/`
**The core N-API addon source and build system.**

```
NativeLibremon_NAPI/
├── src/              # C++ native addon source
├── lib/              # JavaScript wrapper (index.js)
├── scripts/          # Build scripts
│   ├── build-dist.js           # Assembles distribution
│   ├── fix-runtimeconfig.js    # .NET runtime config
│   └── check-windows.js        # Platform check
├── test/             # Test files
├── binding.gyp       # node-gyp configuration
├── patch-vcxproj.js  # MSVC toolset patcher
├── .npmrc            # Build toolset configuration
└── package.json      # Build scripts and dependencies
```

**Key Files:**
- `package.json` - Run `npm run build` to build everything
- `binding.gyp` - Defines C++ compilation settings
- `patch-vcxproj.js` - Patches ClangCL → MSVC v142

### `managed/`
**C# bridge layer between N-API and LibreHardwareMonitor.**

```
managed/
└── LibreHardwareMonitorBridge/
    ├── HardwareMonitorBridge.cs     # Main interop class
    ├── JsonSensorHelper.cs          # Sensor → JSON serialization
    └── LibreHardwareMonitorBridge.csproj
```

**Compiles to**: Self-contained .NET 9.0 app with bundled runtime

### `deps/`
**External dependencies (git submodules).**

```
deps/
└── LibreHardwareMonitor-src/  # Git submodule
    └── LibreHardwareMonitorLib/
```

**Note**: This is a custom fork with Intel GPU VRAM support.

### `dist/`
**Build output - the distributable module.**

```
dist/
└── native-libremon-napi/           # ← Ready to copy
    ├── librehardwaremonitor_native.node
    ├── index.js
    ├── package.json
    ├── LibreHardwareMonitorBridge.dll
    ├── LibreHardwareMonitorLib.dll
    ├── coreclr.dll
    ├── nethost.dll
    └── [~200 more .NET runtime DLLs]
```

**This folder is self-contained** - copy it anywhere and require it.

## Reference Directories

### `docs/`
Documentation and architecture notes.

### `examples/`
Example usage code.

### `test/`
Test scripts and comparison utilities.

### `archive/`
**Archived legacy code** - unused in current workflow:
- Old CLI build scripts
- Deprecated utilities
- Historical implementations

## Root Files

- **`package.json`** - Top-level build script (`npm run build`)
- **`README.md`** - Comprehensive documentation
- **`BUILD.md`** - Build instructions
- **`CHANGELOG.md`** - Version history
- **`LibreHardwareMonitor_NativeNodeIntegration.sln`** - Visual Studio solution (optional)
- **`NuGet.Config`** - NuGet package sources

## Build Flow

```
1. User runs: npm run build (root)
   ↓
2. Executes: cd NativeLibremon_NAPI && npm install && npm run build
   ↓
3. NativeLibremon_NAPI/package.json runs:
   - build:managed  → Compiles C# bridge + .NET runtime
   - build:native   → Compiles C++ addon
   - build:dist     → Assembles dist/native-libremon-napi/
   ↓
4. Output: dist/native-libremon-napi/ (ready to use)
```

## What to Ignore

- `build/` - Temporary build artifacts (in NativeLibremon_NAPI/)
- `node_modules/` - npm dependencies
- `bin/`, `obj/` - C# compilation artifacts
- `archive/` - Legacy code
- `.git/` - Git metadata

## Quick Commands

```bash
# Build everything
npm run build

# Clean and rebuild
cd NativeLibremon_NAPI && npm run clean && cd .. && npm run build

# Test the built module
node test/test-native-init.js
```

## Configuration Options

The addon supports filtering options to improve performance:

| Option | Default | Description |
|--------|---------|-------------|
| `dimmDetection` | `false` | Enable per-DIMM memory sensors (slower, uses SMBus I2C) |
| `physicalNetworkOnly` | `false` | Filter virtual network adapters (VirtualBox, VMware, VPN, etc.) |

**Recommended for production dashboards:**
```javascript
monitor.init({
  cpu: true,
  gpu: true,
  memory: true,
  network: true,
  dimmDetection: false,      // Skip per-DIMM sensors (99% faster init)
  physicalNetworkOnly: true  // Physical adapters only (91% fewer, 89% faster)
});
```
