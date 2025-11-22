# LibreHardwareMonitor N-API Addon Builder

Build system for producing a self-contained, ready-to-use N-API addon for hardware monitoring in Electron and Node.js applications on Windows.

> **🤖 AI-Generated Project**: Created by [Claude Sonnet 4.5](https://www.anthropic.com/claude).

## 🎯 What This Produces

A **self-contained Node.js module** (`dist/native-libremon-napi/`) containing:
- Native N-API addon (`.node` file)
- Entire .NET 9.0 runtime (self-contained)
- LibreHardwareMonitor library (custom fork with Intel GPU VRAM support)
- JavaScript wrapper API
- ~207 files, ~80MB total

**Key Feature**: The dist folder is completely portable - copy it to any Windows machine and `require()` it. No build tools or .NET installation needed on the target machine.

## ✨ Features

- **Native Performance**: Direct hardware access via N-API
- **Intel GPU VRAM Support**: Custom LibreHardwareMonitor fork with Intel Arc GPU VRAM sensors
- **Comprehensive Monitoring**: CPU, GPU, motherboard, memory, storage, network, PSU, battery, fan controllers
- **Self-Contained**: Bundles entire .NET runtime, works on any Windows machine
- **Simple Integration**: Single `require()` for Electron/Node.js apps

## 📋 Build Requirements

**Only needed if building from source:**

- **Windows 10/11 x64**
- **Node.js 16.0+**
- **Visual Studio 2019+ Build Tools** with:
  - MSVC v142 (Visual C++ 2019) toolset
  - Windows 10/11 SDK
  - C++ build tools
- **.NET SDK 9.0+**
- **Python 3.x** (for node-gyp)

> **Note**: ClangCL is **not required**. The build system automatically patches project files to use MSVC v142.

## 🚀 Building

```bash
# From repository root
npm run build

# Output: dist/native-libremon-napi/
```

This runs the complete build process:
1. Compiles C# managed bridge as self-contained .NET app
2. Compiles C++ native addon with N-API
3. Assembles everything into `dist/native-libremon-napi/`

## 📦 Using the Built Module

Copy `dist/native-libremon-napi/` to your project and require it:

```javascript
const monitor = require('./native-libremon-napi');

// Initialize hardware monitoring
monitor.init({
  cpu: true,
  gpu: true,
  motherboard: true,
  memory: true,
  storage: false,
  network: false
});

// Poll sensors (non-blocking)

const data = await monitor.poll();
console.log('Hardware Data:', data);

// Cleanup
monitor.shutdown();
```

> **Runtime Requirement**: Administrator privileges required for hardware access.

## 📁 Project Structure

```
LibreHardwareMonitor_NativeNodeIntegration/
├── NativeLibremon_NAPI/          # N-API addon source
│   ├── src/                      # C++ native code
│   ├── lib/                      # JavaScript wrapper
│   ├── scripts/                  # Build scripts
│   │   ├── build-dist.js         # Assembles dist folder
│   │   ├── fix-runtimeconfig.js  # Removes .NET framework dependency
│   │   └── check-windows.js      # Platform validation
│   └── package.json              # Build configuration
├── managed/                      # C# bridge source
│   └── LibreHardwareMonitorBridge/
├── deps/                         # Dependencies
│   └── LibreHardwareMonitor-src/ # LHM submodule (custom fork)
├── dist/                         # Build output
│   └── native-libremon-napi/     # ← Distributable module
└── package.json                  # Root build script
```

## 🔧 Build Process Details

From repository root, `npm run build` executes:

1. **Compile C# Bridge** (self-contained .NET 9.0 app)
   ```bash
   dotnet publish -c Release -r win-x64 --self-contained true
   ```

2. **Fix Runtime Config** (force bundled runtime usage)
   ```bash
   node scripts/fix-runtimeconfig.js
   ```

3. **Compile C++ Addon** (with automatic MSVC toolset patching)
   ```bash
   node-gyp configure && node patch-vcxproj.js && node-gyp build
   ```

4. **Assemble Distribution** (copy all artifacts to dist folder)
   ```bash
   node scripts/build-dist.js
   ```

> **Toolset Patching**: Node.js 24.9.0 requests ClangCL compiler, but build system automatically patches project files to use MSVC v142.

## 🏗️ Architecture

```
Node.js Application
    ↓ (N-API)
librehardwaremonitor_native.node
    ↓ (.NET Hosting)
LibreHardwareMonitorBridge.dll
    ↓
LibreHardwareMonitorLib.dll (Custom Fork)
    ↓
Hardware Drivers & WMI
```

### Key Components

- **N-API Addon** (`librehardwaremonitor_native.node`): Async worker for non-blocking polls
- **Bridge Layer** (`LibreHardwareMonitorBridge.dll`): .NET interop with LibreHardwareMonitor
- **LHM Fork** (`LibreHardwareMonitorLib.dll`): Custom build with Intel GPU VRAM support
- **Self-Contained Runtime**: All .NET dependencies bundled in `dist/`

## 📝 Recent Changes

### November 21, 2025 - LibreHardwareMonitor Update & API Compatibility Fixes

**Updated LibreHardwareMonitor Submodule**
- Updated `deps/LibreHardwareMonitor-src` to commit `5b2645bcbbe10373ec21afc3e95cda3a0a93c97e`
- Brings in latest Intel GPU VRAM sensor improvements and bug fixes

**Fixed Build System Issues**
1. **Removed obsolete `IsDimmDetectionEnabled` property**
   - Property was removed from LibreHardwareMonitor's `Computer` class in recent versions
   - Updated `HardwareMonitorBridge.cs` to remove reference (line 70)
   - DIMM detection is now always enabled when memory monitoring is enabled

2. **Changed LibreHardwareMonitorLib reference from DLL to ProjectReference**
   - **Previous**: Bridge referenced pre-built `deps/LibreHardwareMonitor/LibreHardwareMonitorLib.dll` (stale)
   - **Current**: Bridge now references `deps/LibreHardwareMonitor-src/LibreHardwareMonitorLib/LibreHardwareMonitorLib.csproj`
   - This ensures the bridge always uses the current source code from the submodule
   - Fixes runtime errors where managed code called obsolete .NET APIs

3. **Updated LibreHardwareMonitorBridge.csproj**
   - Changed from: `<Reference Include="LibreHardwareMonitorLib"><HintPath>..\..\deps\LibreHardwareMonitor\LibreHardwareMonitorLib.dll</HintPath></Reference>`
   - Changed to: `<ProjectReference Include="..\..\deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\LibreHardwareMonitorLib.csproj" />`
   - Ensures build system compiles LHM from source instead of using cached DLL

**Impact**: The addon now works correctly with the updated LibreHardwareMonitor source, providing access to the latest sensor improvements while maintaining API compatibility.

## 📊 Hardware Support

| Category | Status | Admin Required | Intel GPU VRAM | Notes |
|----------|--------|----------------|----------------|-------|
| **CPU** | ✅ Full | Yes | - | Temp, load, clocks, power |
| **GPU** | ✅ Full | Yes | ✅ **Yes** | Intel Arc VRAM support |
| **Motherboard** | ✅ Full | Yes | - | Voltage, fans, temps |
| **Memory** | ✅ Full | Yes | - | See DIMM detection below |
| **Storage** | ✅ Full | Yes | - | SMART, temps, activity |
| **Network** | ✅ Full | No | - | Bandwidth monitoring |

### Intel GPU VRAM Monitoring

The custom LibreHardwareMonitor fork adds:
- **GPU Memory Total** (MB)
- **GPU Memory Used** (MB)
- **GPU Memory Free** (MB)
- **GPU Memory Controller Load** (%)

Supported on Intel Arc GPUs and integrated graphics.

### Memory / DIMM Detection

Memory monitoring has two modes controlled by `dimmDetection`:

**`dimmDetection: false` (default - recommended)**
- Shows: Virtual Memory + Total Memory only
- Sensors: Load, Used, Available (~6 sensors total)
- Poll latency: Fast (~50-100ms)
- **Use for**: Production dashboards polling at 1Hz or faster

**`dimmDetection: true` (detailed)**
- Shows: Virtual Memory + Total Memory + Individual DIMMs
- Sensors: Temperature, Capacity, 17 timing parameters per DIMM (~20 sensors/DIMM)
- Poll latency: Slow (~150-250ms due to SMBus I2C reads)
- Requires: RAMSPDToolkit driver (may fail silently on some systems)
- **Use for**: Diagnostics or when DIMM details are essential

## 🔧 API Reference

### `monitor.init(config)`

Initialize hardware monitoring with desired categories.

```javascript
monitor.init({
  cpu: boolean,        // CPU sensors (temp, load, clocks)
  gpu: boolean,        // GPU sensors (temp, load, VRAM)
  motherboard: boolean, // Motherboard sensors (voltage, fans)
  memory: boolean,     // Memory usage
  storage: boolean,    // Drive temps, SMART data
  network: boolean,    // Network bandwidth
  controller: boolean, // HID controllers
  psu: boolean,        // Power supply (if supported)
  battery: boolean,    // Battery status (laptops)
  dimmDetection: boolean // Optional: Enable per-DIMM sensors (default: false)
});
```

**Performance Note**: `dimmDetection: true` enables detailed DIMM sensors (temperature, timing parameters) but adds ~100-150ms polling latency due to SMBus I2C reads. Use `false` (default) for production dashboards.

### `await monitor.poll()`

Poll current sensor values (async, non-blocking).

Returns hierarchical JSON matching LibreHardwareMonitor web endpoint format:

```javascript
{
  id: 0,
  Text: "Sensor",
  Children: [
    {
      id: 1,
      Text: "Intel(R) Arc(TM) A770 Graphics",
      Children: [
        {
          id: 2,
          Text: "Memory",
          Children: [
            { id: 3, Text: "GPU Memory Total", Value: "16256.0 MB" },
            { id: 4, Text: "GPU Memory Used", Value: "1740.4 MB" },
            { id: 5, Text: "GPU Memory Free", Value: "14515.6 MB" }
          ]
        }
      ]
    }
  ]
}
```

### `monitor.shutdown()`

Clean up resources and shutdown monitoring.

## 📁 Project Structure

```
├── dist/
│   └── NativeLibremon_NAPI/          # Pre-built distribution
│       ├── librehardwaremonitor_native.node
│       ├── LibreHardwareMonitorBridge.dll
│       ├── LibreHardwareMonitorLib.dll
│       ├── index.js                  # Entry point
│       └── [.NET runtime DLLs]
├── NativeLibremon_NAPI/              # Source code
│   ├── src/                          # C++ N-API code
│   │   ├── addon.cc                  # Entry point
│   │   ├── clr_host.cc               # .NET runtime hosting
│   │   ├── hardware_monitor.cc       # LHM wrapper
│   │   └── json_builder.cc           # JSON marshaling
│   ├── lib/index.js                  # JavaScript wrapper
│   ├── patch-vcxproj.js              # Build toolset patcher (ClangCL → MSVC)
│   ├── .npmrc                        # npm configuration (forces MSVC v142)
│   └── binding.gyp                   # Build configuration
├── managed/
│   └── LibreHardwareMonitorBridge/   # .NET bridge project
│       └── HardwareMonitorBridge.cs  # Managed interop
├── deps/
│   └── LibreHardwareMonitor-src/     # Git submodule (custom fork)
└── scripts/
    └── build-napi.ps1                # Build automation
```

## 🔨 Build Scripts

### `.\scripts\build-all.ps1`

Complete build script that builds everything from source:
1. Builds LibreHardwareMonitor from git submodule
2. Publishes .NET bridge with self-contained runtime
3. Compiles N-API addon with node-gyp
4. Copies all dependencies to `dist/NativeLibremon_NAPI/`

**Options**:
```powershell
# Full build from source
.\scripts\build-all.ps1

# Clean build (removes build artifacts first)
.\scripts\build-all.ps1 -Clean
```

### `.\scripts\build-napi.ps1`

Quick rebuild of just the N-API addon (assumes LibreHardwareMonitor and Bridge are already built):
```powershell
.\scripts\build-napi.ps1
```

## 🐛 Troubleshooting

### Build Issues

**Problem**: `nethost.h: No such file or directory`
```
Solution: Install .NET SDK 9.0+
Check: dotnet --version
```

**Problem**: `The build tools for ClangCL (Platform Toolset = 'ClangCL') cannot be found`
```
Solution: This is automatically handled by the build system
The N-API package.json includes a patch-vcxproj.js script that converts
ClangCL toolset references to MSVC v142 after node-gyp configure step.
If you encounter this error, ensure:
1. Visual Studio 2019 Build Tools installed with MSVC v142
2. .npmrc exists in NativeLibremon_NAPI/ with msvs_version=2019
3. patch-vcxproj.js exists in NativeLibremon_NAPI/
```

**Problem**: `Could not locate the assembly 'LibreHardwareMonitorLib'`
```
Solution: LibreHardwareMonitor DLL not built yet
Run: .\scripts\build-all.ps1
This builds LibreHardwareMonitor from source and copies to deps/
```

**Problem**: Git submodule is empty
```
Solution: Initialize submodules
Run: git submodule update --init --recursive
```

### Runtime Issues

**Problem**: `The specified module could not be found`
```
Solution: Run as Administrator - hardware access requires elevation
Right-click PowerShell → "Run as administrator"
```

**Problem**: `Failed to initialize .NET runtime`
```
Solution: All .NET dependencies should be in dist/NativeLibremon_NAPI/
If missing, rebuild: .\scripts\build-napi.ps1
```

**Problem**: No GPU sensors detected
```
Solution: Enable CPU and Motherboard flags - GPU detection often requires these:
monitor.init({ cpu: true, gpu: true, motherboard: true })
```

**Problem**: DIMM detection not working (dimmDetection: true)
```
Solution: RAMSPDToolkit driver may fail silently on some systems
This is a known limitation - use dimmDetection: false for basic memory monitoring
Basic Virtual Memory and Total Memory sensors always work without driver
```

## 📝 Example: GPU Monitor

See `test/gpu-poll.js` for a complete example that:
- Initializes with GPU monitoring
- Polls every second (async, non-blocking)
- Filters Intel GPUs
- Displays core usage and VRAM load
- Handles Ctrl+C gracefully

```powershell
# Run as Administrator
node test/gpu-poll.js
```

## 🔐 Security & Permissions

### Why Administrator Access?

LibreHardwareMonitor requires elevated privileges for:
- **CPU**: MSR (Model-Specific Register) access
- **Motherboard**: SuperIO chip I/O port access
- **Storage**: Physical drive handle access
- **GPU**: Driver-level API access

This is a Windows limitation, not a library choice.

### Production Deployment (Electron)

Add to your `app.manifest`:
```xml
<requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
```

Or check/request elevation at runtime.

## 📚 Custom LibreHardwareMonitor Fork

This project uses `herrbasan/LibreHardwareMonitor-Fork` with:
- Intel GPU VRAM sensor support
- CsWin32 for modern Windows API bindings
- Additional dependencies: `DiskInfoToolkit`, `HidSharp`, `RAMSPDToolkit-NDD`

The fork is maintained as a git submodule at `deps/LibreHardwareMonitor-src/`.

## 📄 License

MIT License - See LICENSE file

### Third-Party Components

- **LibreHardwareMonitor Fork**: MPL 2.0
- **Node.js/N-API**: MIT
- **.NET Runtime**: MIT
- **HidSharp**: Apache 2.0

## 🙏 Credits

- [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor)
- [herrbasan/LibreHardwareMonitor-Fork](https://github.com/herrbasan/LibreHardwareMonitor-Fork) - Intel GPU VRAM support
- [Node-API](https://nodejs.org/api/n-api.html)

---

**Status**: ✅ Production Ready  
**Architecture**: N-API addon with async polling  
**Last Updated**: November 21, 2025
