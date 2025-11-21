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

**`too many arguments for call` when adding new C# parameter**
- Cause: C++ function pointer typedef doesn't match new signature
- Fix: Update typedef in `hardware_monitor.h` to include new parameter
- Example: When adding `dimmDetection` parameter, update `LHM_InitializeFn` typedef from 9 to 10 parameters

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

### DLL Synchronization Issues

**Changes to C# code not reflected after N-API rebuild**
- **Critical**: `node-gyp rebuild` only rebuilds C++ addon, NOT managed assemblies
- **Root Cause**: N-API build script assumes DLLs in `deps/` and bridge publish folder are current
- **Symptoms**: 
  - New C# features don't work despite successful build
  - Different MD5 hashes between `deps/LibreHardwareMonitor/LibreHardwareMonitorLib.dll` and `dist/NativeLibremon_NAPI/LibreHardwareMonitorLib.dll`
  - Runtime behavior doesn't match code changes
- **Fix**: Always rebuild in correct order:
  1. `dotnet build` LibreHardwareMonitorLib project
  2. `Copy-Item` built DLL to `deps/LibreHardwareMonitor/`
  3. `dotnet publish` LibreHardwareMonitorBridge (references updated DLL)
  4. `.\scripts\build-napi.ps1` (copies all DLLs to dist)
- **Verification**: Compare DLL hashes: `Get-FileHash -Algorithm MD5 <path>`
- **Lesson**: When debugging "feature not working", verify DLL timestamps/hashes FIRST before investigating code logic

## Performance

- **Poll latency**: 50-150ms (depends on enabled categories)
- **Memory**: ~50MB (includes .NET runtime)
- **CPU overhead**: <1% during 1Hz polling
- **Async**: Non-blocking, event loop stays responsive

## DIMM Detection Feature

### Overview

The `dimmDetection` parameter (added November 2025) allows disabling expensive per-DIMM SPD sensor detection while keeping basic Virtual Memory and Total Memory sensors.

### Implementation Chain

1. **JavaScript** (`lib/index.js`): Parse `dimmDetection` from config (default: false)
2. **C++ N-API** (`hardware_monitor.cc`): Pass to `HardwareConfig.dimmDetection` → managed bridge
3. **Bridge** (`HardwareMonitorBridge.cs`): Pass to `Computer.IsDimmDetectionEnabled` property
4. **LibreHardwareMonitor** (`Computer.cs` line 533): Pass to `MemoryGroup` constructor
5. **MemoryGroup** (`MemoryGroup.cs` lines 40-42): Early return if disabled, skipping RAMSPDToolkit initialization

### Behavior

**`dimmDetection: false` (default)**
- Shows: Virtual Memory + Total Memory only (2 items)
- Sensors: ~3 per item (Load, Used, Available)
- Poll time: Fast (~50-100ms)
- No driver loading required

**`dimmDetection: true`**
- Shows: Virtual Memory + Total Memory + Individual DIMMs (6+ items)
- Sensors: ~20 per DIMM (Temperature, Capacity, 17 timing parameters)
- Poll time: Slow (~150-250ms per poll due to SMBus I2C reads)
- **Requires**: RAMSPDToolkit driver must load successfully
- **Known Issue**: Driver may fail silently on some systems (lines 52-55 in MemoryGroup.cs)

### Testing Limitations

**CLR Reinitialization**: Cannot test both `dimmDetection: true` and `false` in same Node.js process
- CLR (.NET runtime) doesn't support reinitialization after shutdown
- **Solution**: Create separate test files for each scenario

**Async Requirement**: `monitor.poll()` returns a Promise that MUST be awaited
- Wrong: `const data = monitor.poll();` → returns empty `{}`
- Correct: `const data = await monitor.poll();` → returns full sensor tree

### Debugging Checklist

When adding new parameters to the stack:

1. ✅ Update C++ typedef in `hardware_monitor.h` (LHM_InitializeFn signature)
2. ✅ Update C++ call site in `hardware_monitor.cc` (m_initializeFn arguments)
3. ✅ Update JavaScript parser in `lib/index.js` (config object)
4. ✅ Update C# bridge signature in `HardwareMonitorBridge.cs` (Initialize method)
5. ✅ Update C# usage in `Computer.cs` (pass to hardware groups)
6. ✅ Rebuild ALL layers (LHM DLL → copy → Bridge → N-API)
7. ✅ Verify DLL hashes match between `deps/` and `dist/`
8. ✅ Test in fresh Node.js process (CLR can't reinitialize)

### Performance Impact

Measured with 4x 32GB DIMMs (2x Corsair CMW64GX4M2D3600C18, 2x G.Skill F4-4400C19-32GTZR):

| Configuration | Hardware Items | Total Sensors | Poll Latency | RAM Read Access |
|--------------|----------------|---------------|--------------|-----------------|
| `dimmDetection: false` | 2 | ~6 | 50-100ms | None (WMI only) |
| `dimmDetection: true` | 6 | ~86 | 150-250ms | SMBus I2C per poll |

**Recommendation**: Use `dimmDetection: false` for production dashboards polling at 1Hz or faster.

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
- [ ] Fix RAMSPDToolkit driver loading (investigate silent failures in MemoryGroup.cs lines 52-55)

## Lessons Learned

### DLL Synchronization is Critical

The build chain involves multiple independent compilation steps. Changes to C# code require rebuilding:
1. LibreHardwareMonitorLib.dll
2. Copying to deps/
3. LibreHardwareMonitorBridge.dll (self-contained publish)
4. N-API addon build (copies all DLLs to dist/)

**Key Insight**: `node-gyp rebuild` only rebuilds C++ code - it does NOT recompile managed assemblies. Old DLLs will be copied to dist/ unless manually rebuilt first.

**Diagnostic Tool**: Always compare MD5 hashes when debugging "code changes not working":
```powershell
Get-FileHash -Path "deps/LibreHardwareMonitor/LibreHardwareMonitorLib.dll" -Algorithm MD5
Get-FileHash -Path "dist/NativeLibremon_NAPI/LibreHardwareMonitorLib.dll" -Algorithm MD5
```

Different hashes = stale DLLs in dist folder.

### Function Pointer Signatures Must Match Exactly

When adding parameters to managed bridge functions:
- C++ typedef must match the C# signature EXACTLY
- Example: Adding `dimmDetection` required updating `LHM_InitializeFn` from 9 to 10 parameters
- Compiler error: "too many arguments for call" means typedef is out of sync

### CLR Cannot Be Reinitialized

The .NET runtime can only be initialized once per process. After `shutdown()`:
- Cannot call `init()` again in same Node.js process
- Test files must be run in separate processes
- Use `powershell -Command` or create separate test scripts for different configurations

### Async Patterns in N-API

`monitor.poll()` returns a Promise because it uses `Napi::AsyncWorker`:
- Must use `await` or `.then()` to get results
- Synchronous access returns empty `{}` because Promise hasn't resolved
- This is BY DESIGN for non-blocking hardware access

### Silent Failures in Hardware Detection

LibreHardwareMonitor silently skips hardware that fails to initialize:
- MemoryGroup constructor returns early if driver fails (no exception, no log)
- RAMSPDToolkit driver loading can fail without visible error
- **Debug Strategy**: Add console output in managed code to trace initialization flow
- Hardware count mismatches often indicate silent initialization failures, not logic bugs

### Testing Requires Administrator Rights

DIMM detection uses kernel drivers (RAMSPDToolkit) requiring admin privileges:
- Driver loads silently fail without admin rights
- No error messages - hardware simply doesn't appear
- Always test with elevated PowerShell session

---

**Status**: ✅ Production Ready  
**Last Updated**: November 21, 2025
