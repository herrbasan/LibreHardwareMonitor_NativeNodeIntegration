# LibreHardwareMonitor Native Node Integration

Native Node.js addon providing direct access to LibreHardwareMonitor sensor data. Drop-in replacement for web endpoint polling.

## Project Status

**Current State**: Core implementation complete, structure matches web endpoint

**What Works**:
- Native addon with CLR hosting (C++ to .NET to LibreHardwareMonitor)
- JSON output structurally identical to /data.json web endpoint
- Hardware type filtering (CPU, GPU, motherboard, memory, storage, network)
- Virtual NIC filtering and DIMM filtering options
- Async polling with libuv thread pool (non-blocking)
- Pre-built dist/ folder for batteries-included usage
- Automatic build from LibreHardwareMonitor submodule

## Architecture

```
JavaScript (lib/index.js)
    (Node-API)
Native Addon (src/addon.cc)
    (CLR Hosting)
C# Bridge (managed/LibreHardwareMonitorBridge/)
    
LibreHardwareMonitor.dll
    
Hardware (ring-0 drivers, SMBus, etc.)
```

## Key Implementation Details

### Output Format Contract

**Critical**: Native addon must produce byte-identical JSON structure to web endpoint.

- Reference: docs/example/librehardwaremonitor_webservice_output.json
- Test: test/compare-web-vs-native.js validates structure match
- Sensor type groups ordered by enum value (.OrderBy((int)g.Key))
- SensorType.SmallData maps to "Data" group name (matches web endpoint)

### File Structure

```
lib/index.js                         # JavaScript API
src/                                 # Native C++ addon
managed/LibreHardwareMonitorBridge/  # C# bridge
deps/LibreHardwareMonitor-src/       # Submodule (source)
deps/LibreHardwareMonitor/           # Built DLLs (auto-generated)
dist/                                # Pre-built binaries (batteries included)
test/compare-web-vs-native.js        # Structure validation test
docs/                                # Documentation
```

### Build Process

1. LibreHardwareMonitor: Build from submodule (npm run build:lhm)
2. C# Bridge: Compile bridge DLL (npm run build:bridge)
3. Native Addon: Compile C++ addon (npm run build:native)
4. Distribution: Package for users (npm run dist)

All automated via npm run build.

### Critical Code Patterns

**Sensor Type Ordering** (HardwareMonitorBridge.cs ~line 220):

```csharp
var grouped = sensors
    .GroupBy(s => s.SensorType)
    .OrderBy(g => (int)g.Key);  // Must match web endpoint order
```

**Sensor Type Naming** (HardwareMonitorBridge.cs ~line 296):

```csharp
SensorType.SmallData => "Data",  // NOT "SmallData" - matches web endpoint
```

**Async Polling** (addon.cc):
- Uses napi_create_async_work for non-blocking sensor reads
- Executes on libuv thread pool (50-100ms polling time)
- Results marshaled back to main thread

### Dependencies & Requirements

**Build Requirements**:
- .NET SDK 6.0+ (to build LibreHardwareMonitor & bridge)
- Visual Studio 2019+ with C++ build tools
- Node.js 16.0.0+
- Python 3.x (node-gyp dependency)

**Runtime Requirements**:
- Windows 10/11 x64
- .NET Runtime 6.0+
- Administrator privileges (LibreHardwareMonitor limitation - driver loading)

### Configuration Options

```javascript
await monitor.init({
  motherboard: true,
  cpu: true,
  gpu: true,
  memory: true,
  storage: false,           // Disable HDD monitoring
  network: false,           // Disable network adapters
  filterVirtualNics: true,  // Remove virtual/disabled NICs
  filterDIMMs: true         // Remove individual DIMMs
});

const data = await monitor.poll();
await monitor.shutdown();
```

### Testing & Validation

**Structure Comparison**:

```bash
# Run web endpoint first (http://localhost:8085)
node test/compare-web-vs-native.js
```

Validates:
- Hardware-by-hardware structure match
- Sensor group ordering
- Sensor counts per group
- Output files: test/output/1-web-endpoint.json vs test/output/2-native-filtered.json

**Acceptable Differences**:
- Missing sensors (hardware-dependent, e.g., BIOS hides certain sensors)
- Extra sensors (native has more data than web - OK)
- Extra network adapters (real adapters, can be filtered)

**Unacceptable Differences**:
- Mismatched sensor group names
- Wrong sensor type ordering
- Structural hierarchy differences

### Common Issues & Solutions

**Missing Motherboard Sensors**:
- Some sensors may not appear programmatically vs web endpoint
- Hardware/BIOS-dependent, cannot be fixed in code
- Acceptable per project goals

**Virtual Network Adapters**:
- Native detects all NICs (virtual, disabled, etc.)
- Use filterVirtualNics: true to match web endpoint
- Or filter in application code

**SmallData vs Data Naming**:
- FIXED: SensorType.SmallData now maps to "Data" group
- Web endpoint groups SmallData TYPE sensors under "Data" NAME
- Critical for structure match

**Administrator Privileges**:
- LibreHardwareMonitor requires admin for driver loading
- No workaround - hardware access needs ring-0 drivers
- Application must run elevated or fail gracefully

### Distribution Strategy

**Batteries Included**: dist/ folder committed to repo
- Users can clone and use immediately
- No build tools required for end users
- All DLLs and runtime files included
- Modified lib/index.js loads from ../librehardwaremonitor_native.node

**Build Artifacts** (gitignored):
- build/ - node-gyp build output
- deps/LibreHardwareMonitor/ - generated DLLs
- Bridge bin/obj folders

### Memory & Threading

**Thread Safety**:
- Async work runs on libuv pool (dont block event loop)
- CLR calls happen on worker thread
- Results marshaled to main thread for JavaScript

**Memory Management**:
- Computer.Close() called on shutdown
- CLR unloaded via AtExit handler
- Reuse Computer instance (dont recreate per poll)

**Performance**:
- Polling: 50-100ms per cycle
- Memory: <50MB resident
- CPU: <1% average

## Development Workflow

### Making Changes

**C# Bridge Changes**:
1. Edit managed/LibreHardwareMonitorBridge/HardwareMonitorBridge.cs
2. Run npm run build:bridge && npm run build:native
3. Test with node test/compare-web-vs-native.js

**Native Addon Changes**:
1. Edit files in src/
2. Run npm run build:native
3. Test with comparison script

**Always Validate**:
- Run comparison test after structural changes
- Check sensor group ordering
- Verify no missing sensors (unless hardware-dependent)

### Updating LibreHardwareMonitor

```bash
cd deps/LibreHardwareMonitor-src
git fetch origin
git checkout <commit-hash>
cd ../..
npm run build
npm run dist
git add deps/LibreHardwareMonitor-src
git commit -m "Update LibreHardwareMonitor to <commit>"
```

## Project Principles

1. **Output Format is Sacred**: Must match web endpoint exactly
2. **No Data Transformation**: Library returns raw hierarchical JSON (flatten in app if needed)
3. **Graceful Degradation**: Missing sensors OK, wrong structure NOT OK
4. **Batteries Included**: Pre-built dist/ for easy adoption
5. **Build from Source**: Submodule approach for reproducibility

## Quick Reference

### Build Commands

- npm run build - Full build (LHM + bridge + native)
- npm run build:lhm - Build LibreHardwareMonitor from submodule
- npm run build:bridge - Build C# bridge only
- npm run build:native - Build native addon only
- npm run rebuild - Clean + full build
- npm run dist - Create distribution package
- npm run test - Run structure comparison test

### Important Files

- lib/index.js - JavaScript API
- src/addon.cc - Node-API entry point
- managed/LibreHardwareMonitorBridge/HardwareMonitorBridge.cs - C# bridge
- test/compare-web-vs-native.js - Structure validation
- dist/ - Pre-built binaries for distribution

### Git Workflow

- dist/ folder IS committed (batteries included)
- Build artifacts (build/, generated DLLs) are gitignored
- Submodule pinned to specific commit for reproducibility

---

**Note**: This project was 100% generated by Claude Sonnet 4.5.
