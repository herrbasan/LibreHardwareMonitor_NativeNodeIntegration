# LibreHardwareMonitor Node.js Native Addon

Native Node.js addon (N-API) providing hardware monitoring for Electron and Node.js applications on Windows. Built on a custom LibreHardwareMonitor fork with Intel GPU VRAM sensor support.

> **🤖 AI-Generated Project**: This project was created by [Claude Sonnet 4.5](https://www.anthropic.com/claude).

## ✨ Features

- **Native Performance**: Direct hardware access via N-API with async polling
- **Intel GPU VRAM Support**: Custom LibreHardwareMonitor fork with Intel Arc GPU VRAM sensors
- **Comprehensive Monitoring**: CPU, GPU, motherboard, memory, storage, network sensors
- **Production Ready**: Self-contained build with all dependencies included
- **Simple Integration**: Single `require()` for Electron/Node.js apps

## 📋 Requirements

- **Windows 10/11 x64**
- **Node.js 16.0+**
- **Administrator privileges** (required for hardware access)

### Build Requirements (source only)

- **Visual Studio 2019+** with C++ build tools
- **.NET SDK 9.0+**
- **Python 3.x** (for node-gyp)

## 🚀 Quick Start

### Using Pre-built Distribution

```javascript
const monitor = require('./dist/NativeLibremon_NAPI');

// Initialize hardware monitoring
monitor.init({
  cpu: true,
  gpu: true,
  motherboard: true,
  memory: true,
  storage: false,
  network: false
});

// Poll sensors (async, non-blocking)
const data = await monitor.poll();
console.log('GPU Data:', data);

// Cleanup
monitor.shutdown();
```

### Building from Source

```powershell
# Clone with submodules
git clone --recurse-submodules https://github.com/herrbasan/LibreHardwareMonitor_NativeNodeIntegration.git
cd LibreHardwareMonitor_NativeNodeIntegration

# Build everything
.\scripts\build-napi.ps1

# Output: dist/NativeLibremon_NAPI/ (ready to require)
```

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

## 📊 Hardware Support

| Category | Status | Admin Required | Intel GPU VRAM |
|----------|--------|----------------|----------------|
| **CPU** | ✅ Full | Yes | - |
| **GPU** | ✅ Full | Yes | ✅ **Yes** |
| **Motherboard** | ✅ Full | Yes | - |
| **Memory** | ✅ Full | Yes | - |
| **Storage** | ✅ Full | Yes | - |
| **Network** | ✅ Full | No | - |

### Intel GPU VRAM Monitoring

The custom LibreHardwareMonitor fork adds:
- **GPU Memory Total** (MB)
- **GPU Memory Used** (MB)
- **GPU Memory Free** (MB)
- **GPU Memory Controller Load** (%)

Supported on Intel Arc GPUs and integrated graphics.

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
  battery: boolean     // Battery status (laptops)
});
```

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

### `.\scripts\build-napi.ps1`

Main build script that:
1. Builds LibreHardwareMonitor from submodule
2. Publishes .NET bridge with self-contained runtime
3. Compiles N-API addon with node-gyp
4. Copies all dependencies to `dist/NativeLibremon_NAPI/`

**Options**:
```powershell
# Full build
.\scripts\build-napi.ps1

# Skip LibreHardwareMonitor build (if already built)
.\scripts\build-napi.ps1 -SkipLHM

# Clean build
.\scripts\build-napi.ps1 -Clean
```

## 🐛 Troubleshooting

### Build Issues

**Problem**: `nethost.h: No such file or directory`
```
Solution: The build script automatically locates nethost.h from .NET SDK
If issues persist, verify .NET SDK 9.0+ is installed: dotnet --version
```

**Problem**: `DiskInfoToolkit.dll not found`
```
Solution: This is a dependency of the custom LHM fork
Rebuild with: .\scripts\build-napi.ps1 -Clean
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
**Last Updated**: November 2025
