# LibreHardwareMonitor N-API Addon

N-API addon providing hardware monitoring for Electron and Node.js on Windows. Bundles LibreHardwareMonitor with a self-contained .NET 9.0 runtime.

**Output**: `dist/native-libremon-napi/` (~207 files, ~80MB) - portable, requires no external dependencies.

**Features**: CPU, GPU (Intel VRAM support), motherboard, memory, storage, network sensors. Requires administrator privileges.

## Build Requirements

- Windows 10/11 x64
- Node.js 16.0+
- Visual Studio 2019+ Build Tools (MSVC v142, Windows SDK, C++ tools)
- .NET SDK 9.0+
- Python 3.x (for node-gyp)

ClangCL not required - build system patches to MSVC v142.

## Building

```bash
npm run build  # Output: dist/native-libremon-napi/
```

Build steps:
1. Compiles C# bridge (self-contained .NET 9.0)
2. Compiles C++ N-API addon (auto-patches to MSVC v142)
3. Assembles distribution folder

## Usage

```javascript
const monitor = require('./native-libremon-napi');

monitor.init({
  cpu: true,
  gpu: true,
  motherboard: true,
  memory: true,
  storage: false,
  network: true,
  dimmDetection: false,      // Skip per-DIMM sensors (faster)
  physicalNetworkOnly: true  // Filter virtual adapters (faster)
});

const data = await monitor.poll();
console.log('Hardware Data:', data);

monitor.shutdown();
```

Administrator privileges required.

## Project Structure

```
LibreHardwareMonitor_NativeNodeIntegration/
├── NativeLibremon_NAPI/          # N-API addon source
│   ├── src/                      # C++ native code
│   ├── lib/index.js              # JavaScript wrapper
│   ├── scripts/                  # Build scripts
│   └── package.json
├── managed/                      # C# bridge source
│   └── LibreHardwareMonitorBridge/
├── deps/
│   └── LibreHardwareMonitor-src/ # LHM submodule (custom fork)
└── dist/
    └── native-libremon-napi/     # Build output (~207 files, ~80MB)
```

## Architecture

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

## Recent Changes (November 30, 2025)

- Added `physicalNetworkOnly` filter option (91% fewer adapters, 89% faster polling)
- Re-implemented `dimmDetection` toggle in LHM fork (99% faster memory init)
- Filters VirtualBox, VMware, Hyper-V, Docker, VPN, NDIS lightweight filters
- Updated LibreHardwareMonitor submodule with network filtering support

### Previous Changes (November 21, 2025)

- Updated LibreHardwareMonitor submodule to `5b2645bcbbe10373ec21afc3e95cda3a0a93c97e`
- Changed bridge to use `ProjectReference` instead of pre-built DLL
- Ensures bridge compiles against current LHM source

## Hardware Support

| Category | Admin Required | Notes |
|----------|----------------|-------|
| CPU | Yes | Temp, load, clocks, power |
| GPU | Yes | Intel Arc VRAM support (Total/Used/Free MB, Load %) |
| Motherboard | Yes | Voltage, fans, temps |
| Memory | Yes | Load, Used, Available. Use `dimmDetection: true` for per-DIMM sensors |
| Storage | Yes | SMART, temps, activity |
| Network | No | Bandwidth monitoring. Use `physicalNetworkOnly: true` to filter virtual adapters |

### Memory / DIMM Detection

**`dimmDetection: false` (default)**
- Virtual Memory + Total Memory only
- Fast polling (~50-100ms)
- ~6 sensors total

**`dimmDetection: true`**
- Adds individual DIMM sensors
- Slow polling (~150-250ms, SMBus I2C reads)
- Temperature, capacity, timing parameters per DIMM
- Requires RAMSPDToolkit driver (may fail silently)

### Network / Physical Adapter Filtering

**`physicalNetworkOnly: false` (default)**
- All network adapters (~46 on typical system with VMs)
- Includes NDIS filters, VirtualBox, VMware, Hyper-V, VPN adapters
- Higher CPU usage during polling

**`physicalNetworkOnly: true`**
- Physical adapters only (~3-5 typically)
- Keeps: Ethernet, Wi-Fi, Bluetooth
- Filters: VirtualBox, VMware, Hyper-V, Docker, VPN, NDIS filters
- **91% fewer adapters, 89% faster polling, ~100% less CPU**

## API Reference

### `monitor.init(config)`

Initialize hardware monitoring with sensor categories.

```javascript
monitor.init({
  cpu: boolean,
  gpu: boolean,
  motherboard: boolean,
  memory: boolean,
  storage: boolean,
  network: boolean,
  controller: boolean,
  psu: boolean,
  battery: boolean,
  dimmDetection: boolean,      // Optional: Enable per-DIMM sensors (default: false)
  physicalNetworkOnly: boolean // Optional: Filter virtual network adapters (default: false)
});
```

### `await monitor.poll()`

Poll current sensor values (async). Returns hierarchical JSON:

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

## Build Scripts

**`.\scripts\build-all.ps1`** - Complete build from source:
1. Builds LibreHardwareMonitor from submodule
2. Publishes .NET bridge with self-contained runtime
3. Compiles N-API addon
4. Copies to `dist/NativeLibremon_NAPI/`

```powershell
.\scripts\build-all.ps1         # Full build
.\scripts\build-all.ps1 -Clean  # Clean build
```

**`.\scripts\build-napi.ps1`** - Quick N-API rebuild only

## Troubleshooting

**Build Issues:**
- `nethost.h: No such file or directory` - Install .NET SDK 9.0+ (`dotnet --version`)
- `ClangCL platform toolset cannot be found` - Automatically handled by patch-vcxproj.js (requires VS2019 Build Tools with MSVC v142)
- `Could not locate assembly 'LibreHardwareMonitorLib'` - Run `.\scripts\build-all.ps1`
- `Git submodule is empty` - Run `git submodule update --init --recursive`

**Runtime Issues:**
- `The specified module could not be found` - Run as Administrator
- `Failed to initialize .NET runtime` - Rebuild: `.\scripts\build-napi.ps1`
- `No GPU sensors detected` - Enable CPU and Motherboard: `monitor.init({ cpu: true, gpu: true, motherboard: true })`
- `DIMM detection not working` - RAMSPDToolkit driver may fail silently (use `dimmDetection: false`)

## Example Usage

See `test/gpu-poll.js` for GPU monitoring example. Run as Administrator:
```powershell
node test/gpu-poll.js
```

## Security & Permissions

Requires Administrator access for hardware sensor I/O (MSR, SuperIO, physical drive handles).

**Electron Deployment** - Add to `app.manifest`:
```xml
<requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
```

## Custom Fork

Uses `herrbasan/LibreHardwareMonitor-Fork` (git submodule at `deps/LibreHardwareMonitor-src/`) with Intel GPU VRAM support and additional hardware dependencies.

## Known Issues

- **DIMM Detection**: RAMSPDToolkit driver may fail silently on some systems. Basic memory monitoring (Virtual Memory + Total Memory) always works without the driver.
- **.NET CLR Limitation**: Cannot reinitialize the addon in the same process due to .NET runtime restrictions. Requires process restart to change sensor configuration.
- **GPU Detection**: Some GPUs require CPU and Motherboard flags enabled for proper detection.

## Credits

- [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) - Base hardware monitoring library
- [herrbasan/LibreHardwareMonitor-Fork](https://github.com/herrbasan/LibreHardwareMonitor-Fork) - Intel GPU VRAM support
- [Node-API](https://nodejs.org/api/n-api.html) - Native addon interface

## License

MIT License

**Third-Party Components:**
- LibreHardwareMonitor Fork (MPL 2.0)
- Node.js/N-API (MIT)
- .NET Runtime (MIT)
- HidSharp (Apache 2.0)
