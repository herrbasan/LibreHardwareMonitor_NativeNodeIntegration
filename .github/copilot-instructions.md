# LibreMonCLI - LibreHardwareMonitor Command-Line Interface# LibreHardwareMonitor Native Node Integration



Standalone .NET CLI tool that outputs hardware sensor data as JSON. Designed for integration with Electron apps and other processes that need hardware monitoring data.Native Node.js addon providing direct access to LibreHardwareMonitor sensor data. Drop-in replacement for web endpoint polling.



## Project Status## Project Status



**Current Phase**: Implementation of CLI from specification**Current State**: Core implementation complete, structure matches web endpoint



**Architecture Decision**: Moved from N-API addon to standalone CLI executable for better isolation, simpler deployment, and easier maintenance. See `archive/WHY_CLI_NOT_NAPI.md` for rationale.**What Works**:

- Native addon with CLR hosting (C++ to .NET to LibreHardwareMonitor)

## Project Purpose- JSON output structurally identical to /data.json web endpoint

- Hardware type filtering (CPU, GPU, motherboard, memory, storage, network)

This CLI tool provides hardware monitoring data by:- Virtual NIC filtering and DIMM filtering options

1. Building LibreHardwareMonitor from submodule- Async polling with libuv thread pool (non-blocking)

2. Creating a .NET console application that uses LibreHardwareMonitor- Pre-built dist/ folder for batteries-included usage

3. Outputting sensor data as JSON to stdout- Automatic build from LibreHardwareMonitor submodule



**Key Design Goals**:## Architecture

- Output format matches LibreHardwareMonitor web endpoint exactly

- Support both raw (web service format) and flat (transformed) output modes```

- Process isolation (crashes don't affect parent process)JavaScript (lib/index.js)

- Simple deployment (no Node.js version coupling)    (Node-API)

- Administrator privileges required (hardware access)Native Addon (src/addon.cc)

    (CLR Hosting)

## ArchitectureC# Bridge (managed/LibreHardwareMonitorBridge/)

    

```LibreHardwareMonitor.dll

Electron/Node.js App    

    (child_process.spawn)Hardware (ring-0 drivers, SMBus, etc.)

LibreMonCLI.exe```

    ↓

LibreHardwareMonitor.dll## Key Implementation Details

    ↓

Hardware (ring-0 drivers, SMBus, etc.)### Output Format Contract

```

**Critical**: Native addon must produce byte-identical JSON structure to web endpoint.

## Complete Specification

- Reference: docs/example/librehardwaremonitor_webservice_output.json

**See `LIBREMON_CLI_DEV_PLAN.md`** for comprehensive implementation details including:- Test: test/compare-web-vs-native.js validates structure match

- Command-line arguments and options- Sensor type groups ordered by enum value (.OrderBy((int)g.Key))

- Output format specifications (raw and flat modes)- SensorType.SmallData maps to "Data" group name (matches web endpoint)

- TypeScript interfaces for consumers

- C# implementation guidance### File Structure

- DataFlattener class specification

- Integration examples```

lib/index.js                         # JavaScript API

## Current File Structuresrc/                                 # Native C++ addon

managed/LibreHardwareMonitorBridge/  # C# bridge

```deps/LibreHardwareMonitor-src/       # Submodule (source)

managed/LibreHardwareMonitorBridge/  # Legacy bridge code (to be restructured)deps/LibreHardwareMonitor/           # Built DLLs (auto-generated)

deps/LibreHardwareMonitor-src/       # Submodule (LibreHardwareMonitor source)dist/                                # Pre-built binaries (batteries included)

deps/LibreHardwareMonitor/           # Built DLLs (auto-generated, gitignored)test/compare-web-vs-native.js        # Structure validation test

archive/napi-approach/               # Complete N-API implementation (preserved)docs/                                # Documentation

archive/WHY_CLI_NOT_NAPI.md          # Decision rationale```

LIBREMON_CLI_DEV_PLAN.md            # Complete CLI specification

```### Build Process



## Target File Structure1. LibreHardwareMonitor: Build from submodule (npm run build:lhm)

2. C# Bridge: Compile bridge DLL (npm run build:bridge)

```3. Native Addon: Compile C++ addon (npm run build:native)

managed/LibreMonCLI/                 # CLI project4. Distribution: Package for users (npm run dist)

├── LibreMonCLI.csproj              # Project file

├── Program.cs                       # Entry point, argument parsingAll automated via npm run build.

├── HardwareMonitor.cs               # LibreHardwareMonitor wrapper

├── OutputFormatter.cs               # Raw mode JSON output### Critical Code Patterns

└── DataFlattener.cs                 # Flat mode transformation

deps/LibreHardwareMonitor-src/       # Submodule**Sensor Type Ordering** (HardwareMonitorBridge.cs ~line 220):

scripts/

├── build.ps1                        # PowerShell build script```csharp

└── build.bat                        # Batch wrappervar grouped = sensors

```    .GroupBy(s => s.SensorType)

    .OrderBy(g => (int)g.Key);  // Must match web endpoint order

## Build Process```



**Target workflow**:**Sensor Type Naming** (HardwareMonitorBridge.cs ~line 296):

1. Build LibreHardwareMonitor from submodule: `dotnet build deps/LibreHardwareMonitor-src/`

2. Build CLI: `dotnet publish managed/LibreMonCLI/ -c Release -o dist````csharp

3. Result: `dist/LibreMonCLI.exe` with all dependenciesSensorType.SmallData => "Data",  // NOT "SmallData" - matches web endpoint

```

**Current state**: managed/ directory needs restructuring from bridge pattern to CLI project.

**Async Polling** (addon.cc):

## Critical Implementation Requirements- Uses napi_create_async_work for non-blocking sensor reads

- Executes on libuv thread pool (50-100ms polling time)

### Output Format Contract- Results marshaled back to main thread



**RAW MODE**: Must produce byte-identical JSON structure to LibreHardwareMonitor web endpoint### Dependencies & Requirements

- Sensor type groups ordered by enum value (`.OrderBy(g => (int)g.Key)`)

- `SensorType.SmallData` maps to `"Data"` group name (NOT "SmallData")**Build Requirements**:

- Hierarchical structure preserved exactly- .NET SDK 6.0+ (to build LibreHardwareMonitor & bridge)

- Visual Studio 2019+ with C++ build tools

**FLAT MODE**: Transform hierarchical data to flat array of sensor objects- Node.js 16.0.0+

- Reference implementation: `archive/napi-approach/reference/libre_hardware_flatten.js`- Python 3.x (node-gyp dependency)

- ~23% smaller output

- Easier consumption for many use cases**Runtime Requirements**:

- Windows 10/11 x64

### Hardware Filtering- .NET Runtime 6.0+

- Administrator privileges (LibreHardwareMonitor limitation - driver loading)

Support filtering by hardware type (matching web endpoint behavior):

- `--cpu`, `--gpu`, `--motherboard`, `--memory`, `--storage`, `--network`### Configuration Options

- `--filter-virtual-nics` - Remove virtual/disabled network adapters

- `--filter-dimms` - Remove individual DIMM slots, keep aggregated memory```javascript

await monitor.init({

### Dependencies & Requirements  motherboard: true,

  cpu: true,

**Build Requirements**:  gpu: true,

- .NET SDK 6.0+  memory: true,

- MSBuild (included with Visual Studio or Build Tools)  storage: false,           // Disable HDD monitoring

  network: false,           // Disable network adapters

**Runtime Requirements**:  filterVirtualNics: true,  // Remove virtual/disabled NICs

- Windows 10/11 x64  filterDIMMs: true         // Remove individual DIMMs

- .NET Runtime 6.0+ (or self-contained deployment)});

- Administrator privileges (LibreHardwareMonitor requires driver loading)

const data = await monitor.poll();

## Usage Examplesawait monitor.shutdown();

```

```bash

# Raw mode (web service format)### Testing & Validation

LibreMonCLI.exe --raw

**Structure Comparison**:

# Flat mode (transformed)

LibreMonCLI.exe --flat```bash

# Run web endpoint first (http://localhost:8085)

# Hardware filteringnode test/compare-web-vs-native.js

LibreMonCLI.exe --raw --cpu --gpu --filter-virtual-nics```



# From Node.js/ElectronValidates:

const { spawn } = require('child_process');- Hardware-by-hardware structure match

const cli = spawn('LibreMonCLI.exe', ['--raw', '--cpu', '--gpu']);- Sensor group ordering

cli.stdout.on('data', (chunk) => {- Sensor counts per group

  const data = JSON.parse(chunk);- Output files: test/output/1-web-endpoint.json vs test/output/2-native-filtered.json

  // Process data...

});**Acceptable Differences**:

```- Missing sensors (hardware-dependent, e.g., BIOS hides certain sensors)

- Extra sensors (native has more data than web - OK)

## Archive Reference- Extra network adapters (real adapters, can be filtered)



The `archive/napi-approach/` directory contains:**Unacceptable Differences**:

- Complete working N-API implementation- Mismatched sensor group names

- Structure validation tests (`test/compare-web-vs-native.js`)- Wrong sensor type ordering

- Flatten logic reference (`reference/libre_hardware_flatten.js`)- Structural hierarchy differences

- Bridge pattern C# code (template for CLI implementation)

- Build scripts and documentation### Common Issues & Solutions



Use archive files as reference but do NOT modify them. They serve as:**Missing Motherboard Sensors**:

1. Proof of concept for LibreHardwareMonitor integration- Some sensors may not appear programmatically vs web endpoint

2. Reference for output format validation- Hardware/BIOS-dependent, cannot be fixed in code

3. Source for data transformation logic- Acceptable per project goals



## Development Workflow**Virtual Network Adapters**:

- Native detects all NICs (virtual, disabled, etc.)

### Immediate Tasks- Use filterVirtualNics: true to match web endpoint

- Or filter in application code

1. **Restructure managed/ directory**:

   - Rename `LibreHardwareMonitorBridge/` to `LibreMonCLI/`**SmallData vs Data Naming**:

   - Create CLI project structure (Program.cs, etc.)- FIXED: SensorType.SmallData now maps to "Data" group

   - Adapt bridge code for direct console output- Web endpoint groups SmallData TYPE sensors under "Data" NAME

- Critical for structure match

2. **Implement core CLI**:

   - Argument parsing (--raw, --flat, hardware filters)**Administrator Privileges**:

   - Hardware initialization from LibreHardwareMonitor- LibreHardwareMonitor requires admin for driver loading

   - Raw mode output (reuse bridge JSON logic)- No workaround - hardware access needs ring-0 drivers

- Application must run elevated or fail gracefully

3. **Implement flat mode**:

   - Port flatten logic from `archive/napi-approach/reference/libre_hardware_flatten.js`### Distribution Strategy

   - Create DataFlattener.cs (see DEV_PLAN for specification)

**Batteries Included**: dist/ folder committed to repo

4. **Build automation**:- Users can clone and use immediately

   - Create `scripts/build.ps1` for PowerShell- No build tools required for end users

   - Create `scripts/build.bat` wrapper- All DLLs and runtime files included

   - Document build process in README- Modified lib/index.js loads from ../librehardwaremonitor_native.node



### Testing & Validation**Build Artifacts** (gitignored):

- build/ - node-gyp build output

**Structure Validation**: Compare CLI output to web endpoint- deps/LibreHardwareMonitor/ - generated DLLs

- Start LibreHardwareMonitor web service- Bridge bin/obj folders

- Capture web endpoint JSON: `Invoke-WebRequest http://localhost:8085/data.json -OutFile web.json`

- Run CLI: `LibreMonCLI.exe --raw > cli.json`### Memory & Threading

- Compare structure (can adapt archive test logic)

**Thread Safety**:

**Acceptable Differences**:- Async work runs on libuv pool (dont block event loop)

- Missing sensors (hardware/BIOS dependent)- CLR calls happen on worker thread

- Extra sensors (CLI has more data - acceptable)- Results marshaled to main thread for JavaScript

- Extra network adapters (use --filter-virtual-nics)

**Memory Management**:

**Unacceptable Differences**:- Computer.Close() called on shutdown

- Mismatched sensor group names- CLR unloaded via AtExit handler

- Wrong sensor type ordering- Reuse Computer instance (dont recreate per poll)

- Structural hierarchy differences

**Performance**:

## Project Principles- Polling: 50-100ms per cycle

- Memory: <50MB resident

1. **Output Format is Sacred**: Raw mode must match web endpoint exactly- CPU: <1% average

2. **Process Isolation**: CLI crashes should not affect parent process

3. **Simple Deployment**: Minimize runtime dependencies## Development Workflow

4. **Reference DEV_PLAN**: Don't duplicate specification - keep it in LIBREMON_CLI_DEV_PLAN.md

5. **Archive is Read-Only**: Learn from archive, don't modify it### Making Changes



## Quick Reference**C# Bridge Changes**:

1. Edit managed/LibreHardwareMonitorBridge/HardwareMonitorBridge.cs

### Key Files to Create2. Run npm run build:bridge && npm run build:native

- `managed/LibreMonCLI/Program.cs` - Entry point3. Test with node test/compare-web-vs-native.js

- `managed/LibreMonCLI/HardwareMonitor.cs` - LHM wrapper

- `managed/LibreMonCLI/OutputFormatter.cs` - Raw JSON output**Native Addon Changes**:

- `managed/LibreMonCLI/DataFlattener.cs` - Flat transformation1. Edit files in src/

- `scripts/build.ps1` - Build automation2. Run npm run build:native

3. Test with comparison script

### Key Reference Files

- `LIBREMON_CLI_DEV_PLAN.md` - Complete specification**Always Validate**:

- `archive/WHY_CLI_NOT_NAPI.md` - Architecture decision- Run comparison test after structural changes

- `archive/napi-approach/managed/LibreHardwareMonitorBridge/HardwareMonitorBridge.cs` - Template- Check sensor group ordering

- `archive/napi-approach/reference/libre_hardware_flatten.js` - Flatten logic- Verify no missing sensors (unless hardware-dependent)



### Important Patterns from Archive### Updating LibreHardwareMonitor



**Sensor Type Ordering** (must preserve):```bash

```csharpcd deps/LibreHardwareMonitor-src

var grouped = sensorsgit fetch origin

    .GroupBy(s => s.SensorType)git checkout <commit-hash>

    .OrderBy(g => (int)g.Key);  // Critical for structure matchcd ../..

```npm run build

npm run dist

**Sensor Type Naming** (must preserve):git add deps/LibreHardwareMonitor-src

```csharpgit commit -m "Update LibreHardwareMonitor to <commit>"

SensorType.SmallData => "Data",  // NOT "SmallData"```

```

## Project Principles

---

1. **Output Format is Sacred**: Must match web endpoint exactly

**Note**: This project pivoted from N-API addon to CLI on October 10, 2025. All N-API code is preserved in `archive/napi-approach/` for reference.2. **No Data Transformation**: Library returns raw hierarchical JSON (flatten in app if needed)

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
