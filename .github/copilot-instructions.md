# LibreHardwareMonitor Node.js Native Addon - Development Guide

## Project Purpose

Provide a native Node.js addon (N-API) for hardware monitoring in Electron/Node.js applications on Windows. Built on a custom LibreHardwareMonitor fork with Intel GPU VRAM sensor support.

## Architecture

```
Node.js/Electron App
    ↓ (require/N-API)
librehardwaremonitor_native.node (C++)
    ↓ (.NET CLR Hosting API)
LibreHardwareMonitorBridge.dll (.NET 9.0)
    ↓
LibreHardwareMonitorLib.dll (Custom Fork)
    ↓
Hardware (Drivers, WMI, I/O Ports)
```

### Key Technologies

- **N-API (Node-API)**: Stable C API for Node.js addons
- **CLR Hosting**: .NET runtime embedded in native code
- **AsyncWorker**: Non-blocking hardware polls on libuv thread pool
- **LibreHardwareMonitor Fork**: Custom build with Intel GPU VRAM support

## Code Structure

```
NativeLibremon_NAPI/
├── src/                           # C++ N-API addon
│   ├── addon.cc                   # Entry point, exports init/poll/shutdown
│   ├── clr_host.cc/.h             # .NET runtime hosting layer
│   ├── hardware_monitor.cc/.h     # LibreHardwareMonitor wrapper
│   └── json_builder.cc/.h         # JSON marshaling (unused - C# handles)
├── lib/index.js                   # JavaScript wrapper
├── binding.gyp                    # node-gyp build configuration
└── package.json

managed/LibreHardwareMonitorBridge/
├── HardwareMonitorBridge.cs       # .NET interop layer
├── LibreHardwareMonitorBridge.csproj
└── [.NET 9.0 self-contained publish output]

deps/LibreHardwareMonitor-src/     # Git submodule (custom fork)

scripts/
└── build-napi.ps1                 # Build automation
```

## Build Process

### 1. LibreHardwareMonitor Build

```powershell
dotnet build deps/LibreHardwareMonitor-src/LibreHardwareMonitorLib/LibreHardwareMonitorLib.csproj `
  -c Release `
  -p:Platform=x64                   # Required by CsWin32
```

Output: `deps/LibreHardwareMonitor/LibreHardwareMonitorLib.dll`

### 2. Bridge Build

```powershell
dotnet publish managed/LibreHardwareMonitorBridge/LibreHardwareMonitorBridge.csproj `
  -c Release `
  -r win-x64 `
  -p:Platform=x64 `
  -p:SelfContained=true `
  --no-restore
```

Output: `managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/`

Includes:
- `LibreHardwareMonitorBridge.dll`
- `LibreHardwareMonitorLib.dll`
- `System.Management.dll`, `System.IO.Ports.dll`, etc.
- `DiskInfoToolkit.dll`, `HidSharp.dll`, `RAMSPDToolkit-NDD.dll`
- .NET 9.0 runtime DLLs (coreclr.dll, hostfxr.dll, etc.)

### 3. N-API Addon Build

```powershell
cd NativeLibremon_NAPI
npm install
node-gyp rebuild
```

`binding.gyp` configuration:
- Includes: `nethost.h` from .NET SDK (10.0.0 or 9.0.x)
- Links: `nethost.lib`
- Copies: All DLLs from bridge publish folder

Output: `NativeLibremon_NAPI/build/Release/librehardwaremonitor_native.node`

### 4. Distribution Assembly

```powershell
.\scripts\build-napi.ps1
```

Copies to `dist/NativeLibremon_NAPI/`:
- `librehardwaremonitor_native.node`
- All bridge publish DLLs
- All .NET runtime DLLs
- `nethost.dll` from .NET SDK
- `index.js` entry point

## Key Implementation Details

### Async Polling (addon.cc)

```cpp
class PollWorker : public Napi::AsyncWorker {
  void Execute() override {
    // Runs on libuv thread pool (non-blocking)
    jsonData = monitor->Poll();
  }
  
  void OnOK() override {
    // Marshals result to JS on main thread
    Napi::Value result = JSON.parse(jsonData);
    deferred.Resolve(result);
  }
};

Napi::Value Poll(const Napi::CallbackInfo& info) {
  PollWorker* worker = new PollWorker(env, g_hardwareMonitor);
  worker->Queue();
  return worker->GetPromise();
}
```

Benefits:
- Non-blocking: Node.js event loop remains responsive
- Fast Ctrl+C handling
- Concurrent operations possible

### .NET Hosting (clr_host.cc)

```cpp
// 1. Load hostfxr.dll
hostfxr_initialize_for_runtime_config()

// 2. Get runtime delegate
hostfxr_get_runtime_delegate(hostfxr_delegate_type_load_assembly_and_get_function_pointer)

// 3. Load managed DLL and get function pointers
load_assembly_and_get_function_pointer(
  "LibreHardwareMonitorBridge.dll",
  "LibreHardwareMonitorNative.HardwareMonitorBridge",
  "Initialize",
  &initialize_fn
)
```

### Hardware Configuration (HardwareMonitorBridge.cs)

```csharp
_computer = new Computer
{
    IsCpuEnabled = cpu,
    IsGpuEnabled = gpu,
    IsMotherboardEnabled = motherboard,
    IsMemoryEnabled = memory,
    IsStorageEnabled = storage,
    IsNetworkEnabled = network,
    IsPsuEnabled = psu,
    IsControllerEnabled = controller,
    IsBatteryEnabled = battery
};
_computer.Open();
```

### JSON Output Format

Matches LibreHardwareMonitor web endpoint (`/data.json`) exactly:

```csharp
// Sensor groups ordered by enum value (matches web endpoint)
var grouped = sensors
    .GroupBy(s => s.SensorType)
    .OrderBy(g => (int)g.Key);

// SmallData maps to "Data" group name
SensorType.SmallData => "Data",  // NOT "SmallData"
```

## Custom LibreHardwareMonitor Fork

Repository: `herrbasan/LibreHardwareMonitor-Fork`

### Key Changes

1. **Intel GPU VRAM Sensors**:
   - `GPU Memory Total`
   - `GPU Memory Used`
   - `GPU Memory Free`
   - Implemented in `Hardware/GPU/IntelGpu.cs`

2. **CsWin32 Integration**:
   - Replaces P/Invoke with source-generated Windows API bindings
   - Requires `Platform=x64` (AnyCPU not supported)

3. **Additional Dependencies**:
   - `DiskInfoToolkit` - Enhanced drive information
   - `HidSharp` - HID device support
   - `RAMSPDToolkit-NDD` - Memory module information

### Build Requirements

```xml
<PropertyGroup>
  <Platform>x64</Platform>  <!-- Required by CsWin32 -->
</PropertyGroup>

<PackageReference Include="DiskInfoToolkit" Version="1.0.6" />
<PackageReference Include="HidSharp" Version="2.6.4" />
<PackageReference Include="RAMSPDToolkit-NDD" Version="1.4.1" />
<PackageReference Include="System.Management" Version="10.0.0" />
<PackageReference Include="System.IO.Ports" Version="10.0.0" />
```

## Testing

### Unit Tests

```javascript
// test/gpu-poll.js
const monitor = require('../dist/NativeLibremon_NAPI');

monitor.init({ cpu: true, gpu: true, motherboard: true });

setInterval(async () => {
  const data = await monitor.poll();
  // Find Intel GPUs
  // Display VRAM usage
}, 1000);

process.on('SIGINT', () => {
  monitor.shutdown();
  process.exit();
});
```

Run as Administrator:
```powershell
node test/gpu-poll.js
```

## Administrator Privileges

### Why Required?

- **CPU**: MSR (Model-Specific Register) access via driver
- **Motherboard**: I/O port access for SuperIO chips
- **Storage**: Physical drive handles for SMART data
- **GPU**: Driver-level API queries

Without admin:
- `Computer.Open()` succeeds but hardware list is empty
- No error messages (hardware simply not detected)

### Electron Integration

```xml
<!-- app.manifest -->
<requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
```

## Troubleshooting

### Build Errors

**`nethost.h: No such file or directory`**
- Cause: .NET SDK not installed or incorrect path in `binding.gyp`
- Fix: Install .NET SDK 9.0+, update `binding.gyp` include paths

**`DiskInfoToolkit.dll not found`**
- Cause: Bridge didn't copy dependency
- Fix: Add to `binding.gyp` copy list, rebuild

### Runtime Errors

**`The specified module could not be found`**
- Cause: Missing .NET runtime DLLs (coreclr.dll, etc.)
- Fix: `.\scripts\build-napi.ps1` copies all dependencies

**`Failed to create CoreCLR`**
- Cause: Missing `System.Private.CoreLib.dll`
- Fix: Ensure bridge publish includes all .NET runtime files

**No GPU detected**
- Cause: GPU detection requires CPU/Motherboard initialization
- Fix: `monitor.init({ cpu: true, gpu: true, motherboard: true })`

## Performance

- **Poll latency**: 50-150ms (depends on enabled categories)
- **Memory**: ~50MB (includes .NET runtime)
- **CPU overhead**: <1% during 1Hz polling
- **Async**: Non-blocking, event loop stays responsive

## Security Considerations

- Requires administrator privileges (unavoidable for hardware access)
- All input validated before passing to managed code
- .NET runtime isolated in separate AppDomain (potential future enhancement)
- No external network access
- All drivers embedded in LHM DLL resources

## Future Enhancements

- [ ] Caching layer to reduce poll frequency
- [ ] Selective sensor filtering (reduce JSON size)
- [ ] Delta updates (only changed sensors)
- [ ] Multi-language support (currently English only)
- [ ] Linux support (would require different LHM backend)

---

**Status**: ✅ Production Ready  
**Last Updated**: November 2025
