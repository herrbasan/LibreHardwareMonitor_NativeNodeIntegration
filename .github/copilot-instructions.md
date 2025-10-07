# LibreHardwareMonitor Native Node Integration

Direct hardware monitoring integration for Node and Electron projects, providing native access to LibreHardwareMonitor data through a Node.js addon.

## Project Goals

**Priority Ranking**: Reliability > Low Footprint > Performance

### Objectives
- Produce identical JSON structure to LibreHardwareMonitor web server endpoint (`/data.json`)
- Provide drop-in replacement for web-based polling implementations
- Eliminate external process dependency on LibreHardwareMonitor.exe
- High reliability with graceful degradation on failures
- Minimal memory and CPU footprint

## Architecture Decision: Standalone Library

Built as standalone project for:
- **Clean Interface Contract**: Forces exact JSON format specification matching web endpoint
- **Easy Integration**: Drop-in replacement for web-based polling
- **Parallel Development**: Run both implementations side-by-side during transition
- **Rollback Safety**: Fallback to web polling if native approach fails
- **Reusability**: Ships as standalone library for any Node.js/Electron project

## Implementation Plan

### Phase 1: Native Addon Development
Build Node.js addon matching LibreHardwareMonitor web endpoint data format:

```
librehardwaremonitor-native/
├── binding.gyp              # Native addon build config
├── package.json
├── README.md
├── src/
│   ├── addon.cc             # Node-API entry point
│   ├── clr_host.cc          # .NET runtime hosting
│   ├── clr_host.h
│   ├── hardware_monitor.cc  # LibreHardwareMonitor wrapper
│   ├── hardware_monitor.h
│   ├── json_builder.cc      # Data marshaling to JSON
│   └── json_builder.h
├── lib/
│   ├── index.js             # JS interface matching web endpoint format
│   └── flatten.js           # Optional data flattening utility
├── deps/
│   └── LibreHardwareMonitor/  # LHM DLLs and dependencies
├── test/
│   ├── compatibility.js     # Validates output === web JSON
│   └── schema.test.js       # JSON structure validation
├── example/
│   └── librehardwaremonitor_webservice_output.json  # Reference output format
├── reference/
│   └── flatten_logic.js     # Reference flattening implementation
└── docs/
    ├── json_schema.md       # LibreHardwareMonitor endpoint format specification
    └── clr_hosting.md       # CLR hosting implementation guide
```

### Phase 2: Application Integration
Integration into your Node.js or Electron application:

```javascript
// Example configuration
{
  "use_native_polling": false,  // Feature flag
  "native_polling_fallback": true  // Auto-revert on failure
}
```

Replace web polling implementation:
- Swap web fetch calls for native addon
- Maintain identical data flow to application logic
- No changes to downstream data consumers

### Phase 3: A/B Testing
Long-term reliability validation:
- Track crashes, missing sensors, memory usage
- Compare web vs native performance metrics
- Monitor error rates across different hardware configurations

### Phase 4: Production Rollout
After proven stability:
- Default `use_native_polling: true`
- Remove external LibreHardwareMonitor.exe dependency
- Keep web polling as emergency fallback

## Technology Stack

### Core Architecture Decision: CLR Hosting + LibreHardwareMonitor DLL

**Chosen Approach**: Wrap LibreHardwareMonitor's C# DLL via CLR hosting in a native Node.js addon.

```
Native Node.js Addon (C++)
    ↓ (Node-API interface)
CLR Host Layer (embeds .NET runtime)
    ↓
LibreHardwareMonitor.dll
    ↓
Hardware (kernel drivers, SMBus, etc.)
```

### Rationale for CLR Hosting Approach

**Why NOT Direct WMI**:
- WMI provides only basic sensor data (limited CPU temp, basic system info)
- Cannot access GPU sensors, detailed motherboard sensors, fan speeds, etc.
- **Impossible to replicate LibreHardwareMonitor's output** - LHM uses ring-0 drivers and direct hardware access
- Would require reverse-engineering thousands of lines of hardware-specific code

**Why Wrap LibreHardwareMonitor DLL**:
- ✅ **Guaranteed Output Compatibility**: Exact same sensor data as web endpoint
- ✅ **Proven Sensor Coverage**: Inherits all LHM's hardware support
- ✅ **Maintainable**: LHM updates automatically provide new sensor support
- ✅ **LLM-Friendly**: Wrapping existing library is tractable for AI-assisted development
- ✅ **Lower Risk**: Leverages battle-tested hardware access code
- ✅ **No Additional Dependencies**: .NET runtime already required for LibreHardwareMonitor.exe

### Node-API (N-API) for Addon Interface
- **Rationale**: Stable ABI across Node.js versions (vs legacy NAN)
- **Benefit**: Survives Electron updates without recompilation
- **Industry Standard**: Recommended approach for all new native addons
- **Reference Implementation**: See [drivers.gpu.control-library](https://github.com/herrbasan/drivers.gpu.control-library) for practical N-API wrapper examples

### Implementation Components

1. **Native Addon Layer** (`src/hardware.cc`)
   - Exposes JavaScript API via Node-API
   - Manages lifecycle of CLR host
   - Marshals data between .NET and JavaScript

2. **CLR Host Layer** (`src/clr_host.cc`)
   - Initializes .NET runtime using CoreCLR hosting APIs
   - Loads LibreHardwareMonitor.dll
   - Creates Computer instance with hardware type configuration
   - Invokes sensor polling methods
   - Converts .NET objects to C++ structures

3. **Data Marshaling** (`src/json_builder.cc`)
   - Converts LibreHardwareMonitor data structures to JSON
   - Ensures byte-identical output to web endpoint format
   - Handles sensor hierarchies and metadata

### Hardware Type Configuration

LibreHardwareMonitor's `Computer` class supports enabling/disabling hardware types via properties:

```csharp
// LibreHardwareMonitor C# API
var computer = new Computer();
computer.IsCpuEnabled = true;
computer.IsGpuEnabled = true;
computer.IsMotherboardEnabled = true;
computer.IsMemoryEnabled = true;
computer.IsStorageEnabled = false;  // Disable storage monitoring
computer.IsNetworkEnabled = false;
computer.IsPsuEnabled = false;
computer.IsControllerEnabled = false;
computer.IsBatteryEnabled = false;
computer.Open();
```

The native addon will expose these options through JavaScript configuration, translating them to the appropriate .NET property calls during CLR initialization. This replaces the XML configuration file approach used by the standalone LibreHardwareMonitor.exe application.

## Memory Management

### Managed/Unmanaged Boundary

The native addon creates a boundary between Node.js (unmanaged C++) and .NET (managed):

```
Node.js (unmanaged) ←→ Native Addon (C++) ←→ CLR Host ←→ LibreHardwareMonitor (managed C#)
```

**Critical Cleanup Requirements**:

1. **Dispose Computer Object**:
   ```cpp
   // In cleanup/shutdown function
   void Shutdown() {
     if (computer != nullptr) {
       computer->Close();  // Unloads drivers, releases hardware locks
       delete computer;
       computer = nullptr;
     }
   }
   ```

2. **Unload CLR on Exit**:
   ```cpp
   // Proper CLR shutdown sequence
   void CleanupCLR() {
     // Dispose all managed objects first
     ShutdownHardwareMonitor();
     
     // Then unload the CLR
     if (clrHostHandle != nullptr) {
       clrHostHandle->shutdown();
       clrHostHandle = nullptr;
     }
   }
   ```

3. **Register Node.js Exit Handler**:
   ```cpp
   // In addon initialization
   node::AtExit(env, [](void* arg) {
     CleanupCLR();
   });
   ```

### GC Pressure Mitigation

**Problem**: Frequent polling creates short-lived .NET objects (sensor readings, string conversions).

**Solutions**:
- Reuse managed objects where possible (don't recreate Computer instance per poll)
- Pool string buffers for JSON serialization
- Call `Computer.Accept(updateVisitor)` to refresh sensors instead of recreating objects
- Avoid boxing/unboxing in hot paths

**Memory Leak Detection**:
```javascript
// Monitor memory growth over time
const initialMemory = process.memoryUsage();
setInterval(() => {
  const current = process.memoryUsage();
  const growth = current.heapUsed - initialMemory.heapUsed;
  if (growth > 50 * 1024 * 1024) { // 50MB growth
    console.warn('Possible memory leak detected');
  }
}, 60000);
```

## Threading Model

### Thread Safety Considerations

**Node.js Threading**:
- JavaScript runs on single main thread
- Native addons invoked on main thread by default
- Long operations block the event loop

**LibreHardwareMonitor Threading**:
- `Computer.Accept(visitor)` is thread-safe
- Sensor updates happen synchronously
- Driver communication may take 10-50ms per poll

**Recommended Approach**: Use libuv thread pool for polling to avoid blocking event loop.

```cpp
// Async worker pattern (Node-API)
napi_value PollAsync(napi_env env, napi_callback_info info) {
  // Create async work
  napi_create_async_work(
    env,
    nullptr,
    resource_name,
    ExecutePoll,      // Runs on thread pool
    CompletePoll,     // Runs on main thread
    data,
    &work
  );
  
  napi_queue_async_work(env, work);
  return promise;
}

// Runs on worker thread - safe to block
void ExecutePoll(napi_env env, void* data) {
  // Call Computer.Accept(visitor) here
  // Blocks this worker thread, not event loop
}

// Runs on main thread - resolve promise
void CompletePoll(napi_env env, napi_status status, void* data) {
  // Convert results to JavaScript objects
  // Resolve promise with sensor data
}
```

**Thread Safety Rules**:
- ✅ Call `Computer.Accept()` from worker thread
- ✅ Marshal results back to main thread
- ❌ Never access JavaScript objects from worker thread
- ❌ Don't hold CLR objects across async boundaries

## Polling Configuration

### Polling Interval

**Default**: 1000ms (1 second)

**Configuration**:
```javascript
await nativeMonitor.init({
  // Hardware types...
  cpu: true,
  gpu: true,
  
  // Polling configuration
  pollingInterval: 1000  // milliseconds (optional, default: 1000)
});

// Or set dynamically
nativeMonitor.setPollingInterval(2000);
```

**Safe Ranges**:
- **Minimum**: 500ms (faster may stress hardware or miss sensor updates)
- **Maximum**: No limit (use 5000ms+ for low-priority monitoring)
- **Recommended**: 1000ms for real-time monitoring, 2000-5000ms for background monitoring

**Hardware Considerations**:
- SMBus sensors (motherboard) update at ~1Hz
- CPU/GPU sensors can update faster (10-100Hz)
- LibreHardwareMonitor internally batches updates
- Polling faster than sensor update rate wastes CPU

**Implementation Note**:
```cpp
// Don't implement polling loop in native code
// Let JavaScript control timing with setInterval()

// Native addon only provides sync poll method:
const data = nativeMonitor.poll();  // Blocks until complete

// Application controls interval:
setInterval(() => {
  const data = nativeMonitor.poll();
  // Process data...
}, pollingInterval);
```

## Error Handling

### Error Types

The addon will throw specific error types for different failure modes:

```typescript
// TypeScript definitions for error types
class HardwareMonitorError extends Error {
  code: string;
  details?: any;
}

// Error codes:
enum ErrorCode {
  // Initialization errors
  CLR_INIT_FAILED = 'CLR_INIT_FAILED',           // .NET runtime failed to load
  DLL_NOT_FOUND = 'DLL_NOT_FOUND',               // LibreHardwareMonitor.dll missing
  DLL_LOAD_FAILED = 'DLL_LOAD_FAILED',           // DLL found but failed to load
  
  // Privilege errors
  ACCESS_DENIED = 'ACCESS_DENIED',               // Not running as Administrator
  DRIVER_LOAD_FAILED = 'DRIVER_LOAD_FAILED',     // PawnIO driver failed to load
  
  // Runtime errors
  POLL_FAILED = 'POLL_FAILED',                   // Sensor polling failed
  SENSOR_READ_ERROR = 'SENSOR_READ_ERROR',       // Individual sensor read failed
  MARSHALING_ERROR = 'MARSHALING_ERROR',         // Data conversion failed
  
  // State errors
  NOT_INITIALIZED = 'NOT_INITIALIZED',           // init() not called
  ALREADY_INITIALIZED = 'ALREADY_INITIALIZED',   // init() called twice
  SHUTDOWN = 'SHUTDOWN'                          // Already shut down
}
```

### Error Handling Examples

```javascript
// Initialization
try {
  await nativeMonitor.init({ cpu: true, gpu: true });
} catch (err) {
  switch (err.code) {
    case 'ACCESS_DENIED':
      console.error('Run application as Administrator');
      process.exit(1);
      break;
    
    case 'CLR_INIT_FAILED':
      console.error('Install .NET Runtime 6.0+');
      // Fall back to web polling
      break;
    
    case 'DLL_NOT_FOUND':
      console.error('LibreHardwareMonitor.dll missing from installation');
      break;
      
    default:
      console.error('Initialization failed:', err.message);
  }
}

// Polling
try {
  const data = nativeMonitor.poll();
} catch (err) {
  if (err.code === 'POLL_FAILED') {
    pollErrorCount++;
    if (pollErrorCount > 3) {
      console.warn('Multiple poll failures, reinitializing...');
      await nativeMonitor.shutdown();
      await nativeMonitor.init(config);
    }
  }
}
```

### Graceful Degradation Strategy

```javascript
class HardwareMonitor {
  constructor() {
    this.backend = null;
    this.fallbackToWeb = true;
  }
  
  async init() {
    try {
      const native = require('librehardwaremonitor-native');
      await native.init({ cpu: true, gpu: true, memory: true });
      this.backend = native;
      console.log('Using native hardware monitoring');
    } catch (err) {
      if (this.fallbackToWeb && err.code !== 'ACCESS_DENIED') {
        console.warn('Native monitoring unavailable, using web polling');
        this.backend = new WebPollingBackend();
        await this.backend.init();
      } else {
        throw err;
      }
    }
  }
  
  async poll() {
    return this.backend.poll();
  }
}
```

## Dependencies

### Required LibreHardwareMonitor Files

**Core DLLs** (must be in same directory as .node addon):
```
deps/LibreHardwareMonitor/
├── LibreHardwareMonitorLib.dll    # Main library
├── HidSharp.dll                   # USB HID device access
└── PawnIO.sys                     # Kernel driver (loaded at runtime)
```

**Optional Dependencies** (for extended sensor support):
```
├── Aga.Controls.dll               # (If using TreeView for debugging)
└── OxyPlot*.dll                   # (If using charting features)
```

### .NET Runtime Requirements

**Minimum**: .NET Runtime 6.0 (LTS)  
**Recommended**: .NET Runtime 8.0 (current LTS)

**Installation Detection**:
```cpp
// Check for .NET runtime before loading
#include <nethost.h>

bool CheckDotNetRuntime() {
  char_t buffer[MAX_PATH];
  size_t buffer_size = sizeof(buffer) / sizeof(char_t);
  
  int rc = get_hostfxr_path(buffer, &buffer_size, nullptr);
  if (rc != 0) {
    // .NET runtime not found
    return false;
  }
  return true;
}
```

**User-Friendly Error**:
```javascript
// During addon initialization
if (!dotnetAvailable) {
  throw new Error(
    'LibreHardwareMonitor Native requires .NET Runtime 6.0 or later.\n' +
    'Download from: https://dotnet.microsoft.com/download/dotnet/6.0'
  );
}
```

### Obtaining LibreHardwareMonitor Source

**Approach**: Use git submodule to include LibreHardwareMonitor source, build during npm install.

**Why Submodule Instead of Downloading Binaries**:
- ✅ Pin to specific commit with PawnIO (more secure than WinRing0)
- ✅ Build tools already required for native addon
- ✅ No reliance on GitHub Actions artifacts (require auth, expire)
- ✅ Full control over build configuration
- ✅ Easy to update by changing submodule commit

**Setup**:
```bash
# Add LibreHardwareMonitor as submodule
git submodule add https://github.com/LibreHardwareMonitor/LibreHardwareMonitor.git deps/LibreHardwareMonitor-src

# Pin to specific commit (example - replace with tested commit)
cd deps/LibreHardwareMonitor-src
git checkout ceaf0747589023675c0263e8115a2623fcebfb56  # Example: Recent master with PawnIO
cd ../..
git add deps/LibreHardwareMonitor-src
git commit -m "Pin LibreHardwareMonitor to commit with PawnIO support"
```

**Build Script** (`scripts/build-lhm.js`):
```javascript
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const LHM_SRC = path.join(__dirname, '..', 'deps', 'LibreHardwareMonitor-src');
const LHM_DEST = path.join(__dirname, '..', 'deps', 'LibreHardwareMonitor');
const BUILD_CONFIG = 'Release';

console.log('Building LibreHardwareMonitor from source...');

// Build LibreHardwareMonitorLib.dll
try {
  execSync(
    `dotnet build "${path.join(LHM_SRC, 'LibreHardwareMonitorLib', 'LibreHardwareMonitorLib.csproj')}" -c ${BUILD_CONFIG}`,
    { stdio: 'inherit' }
  );
  
  // Copy built DLLs to deps/LibreHardwareMonitor/
  const buildOutput = path.join(LHM_SRC, 'LibreHardwareMonitorLib', 'bin', BUILD_CONFIG, 'net472');
  
  if (!fs.existsSync(LHM_DEST)) {
    fs.mkdirSync(LHM_DEST, { recursive: true });
  }
  
  // Copy required DLLs
  const requiredFiles = [
    'LibreHardwareMonitorLib.dll',
    'HidSharp.dll',
    'PawnIO.sys'  // Kernel driver
  ];
  
  requiredFiles.forEach(file => {
    const src = path.join(buildOutput, file);
    const dest = path.join(LHM_DEST, file);
    
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${file}`);
    } else {
      console.warn(`Warning: ${file} not found in build output`);
    }
  });
  
  console.log('LibreHardwareMonitor build complete');
} catch (err) {
  console.error('Failed to build LibreHardwareMonitor:', err.message);
  process.exit(1);
}
```

**Package.json Configuration**:
```json
{
  "scripts": {
    "install": "npm run build:lhm && npm run build:native",
    "build:lhm": "node scripts/build-lhm.js",
    "build:native": "node-gyp rebuild"
  },
  "devDependencies": {
    "node-gyp": "^10.0.0",
    "node-addon-api": "^7.0.0"
  }
}
```

**Submodule Initialization** (for users cloning your repo):
```bash
# Clone with submodules
git clone --recurse-submodules <your-repo-url>

# Or initialize after cloning
git clone <your-repo-url>
cd <repo>
git submodule update --init --recursive
```

**.gitmodules** (auto-generated):
```ini
[submodule "deps/LibreHardwareMonitor-src"]
    path = deps/LibreHardwareMonitor-src
    url = https://github.com/LibreHardwareMonitor/LibreHardwareMonitor.git
```

**Updating to Newer Commit**:
```bash
# Update to latest master
cd deps/LibreHardwareMonitor-src
git fetch origin
git checkout origin/master  # or specific commit hash

# Test thoroughly, then commit the update
cd ../..
git add deps/LibreHardwareMonitor-src
git commit -m "Update LibreHardwareMonitor to latest master"
```

**Build Requirements**:
- **.NET SDK** 6.0 or later (to build LibreHardwareMonitor)
- **MSBuild** / Visual Studio (already required for native addon)
- **dotnet CLI** (`dotnet build` command)

**Advantages of This Approach**:
- No binaries in your repository (keeps it clean)
- Exact version control via git commit hash
- Reproducible builds across development environments
- Can easily test different LibreHardwareMonitor versions
- Build happens automatically on `npm install`

### Licensing Considerations

**LibreHardwareMonitor**: MPL 2.0 (Mozilla Public License)
- ✅ Can be used in proprietary applications
- ✅ No need to open-source your application
- ⚠️ Modifications to LHM source must be shared
- ✅ Wrapping (not modifying) LHM is fine

**HidSharp**: Apache 2.0
- ✅ Permissive license, commercial use allowed

**Your Native Addon**: Choose your own license
- Recommended: MIT or Apache 2.0 for maximum reusability

**Attribution Required**:
```javascript
// Include in your package.json or README
{
  "dependencies": {
    "librehardwaremonitor-native": "^1.0.0"
  },
  "credits": [
    "LibreHardwareMonitor (MPL 2.0) - https://github.com/LibreHardwareMonitor/LibreHardwareMonitor",
    "HidSharp (Apache 2.0) - https://github.com/IntergatedCircuits/HidSharp"
  ]
}
```

## Build System Requirements

### Prerequisites

**Required Tools**:
- **Node.js**: v16.x or later (for Node-API compatibility)
- **Python**: 3.x (required by node-gyp)
- **Visual Studio 2019 or later**: With C++ build tools
  - Desktop development with C++ workload
  - Windows 10/11 SDK
  - MSVC v142+ compiler toolset
- **node-gyp**: `npm install -g node-gyp`

**Optional but Recommended**:
- **CMake**: For advanced build configuration
- **Windows Terminal**: Better build output readability

### Build Configuration (binding.gyp)

```python
{
  "targets": [
    {
      "target_name": "librehardwaremonitor_native",
      "sources": [
        "src/addon.cc",
        "src/clr_host.cc",
        "src/hardware_monitor.cc",
        "src/json_builder.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "UNICODE",
        "_UNICODE"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/std:c++17"]
        }
      },
      "libraries": [
        "nethost.lib"  # .NET hosting library
      ],
      "copies": [
        {
          "destination": "<(module_root_dir)/build/Release",
          "files": [
            "<(module_root_dir)/deps/LibreHardwareMonitor/LibreHardwareMonitorLib.dll",
            "<(module_root_dir)/deps/LibreHardwareMonitor/HidSharp.dll"
          ]
        }
      ]
    }
  ]
}
```

### .NET Hosting Dependencies

The addon requires the .NET hosting libraries (`nethost.lib` and `hostfxr.h`):

**Installation**:
1. Install .NET SDK 6.0 or later
2. Locate nethost library: `C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Host.win-x64\<version>\runtimes\win-x64\native\`
3. Configure include/library paths in binding.gyp

**Runtime Requirements**:
- .NET Runtime 6.0+ must be installed on target systems
- LibreHardwareMonitor DLLs must be in same directory as .node addon

### Build Commands

```bash
# Install dependencies
npm install

# Build the addon
npm run build  # or: node-gyp rebuild

# Build for production (optimized)
npm run build:release

# Clean build artifacts
npm run clean  # or: node-gyp clean
```

## Security Considerations

### Administrator Privileges

LibreHardwareMonitor **requires elevated privileges** to access hardware sensors - the library cannot function without administrator rights.

**Why Elevation is Required**:
- Ring-0 kernel driver access (WinRing0 or PawnIO)
- Direct hardware I/O port access
- MSR (Model-Specific Register) reads
- PCI configuration space access
- SMBus communication for motherboard sensors

**Important**: Your application **must already be running as Administrator** for LibreHardwareMonitor to work. The native addon will fail to initialize if launched without elevation.

**Implementation Note**:
Since the host application already requires admin privileges, the native addon doesn't need additional elevation logic. Simply ensure your application enforces elevation at launch:

```javascript
// Early in application startup
const isElevated = require('is-elevated');

if (!await isElevated()) {
  console.error('Application must run as Administrator');
  console.error('LibreHardwareMonitor requires elevated privileges for hardware access');
  process.exit(1);
}
```

**Error Handling**:
```javascript
try {
  await nativeMonitor.init();
} catch (err) {
  if (err.message.includes('access denied') || err.code === 'EACCES') {
    console.error('Failed to initialize hardware monitoring - check admin privileges');
    // Cannot fall back - hardware access requires elevation
  }
}
```

### Application Elevation Requirements

**Application Manifest** (for Electron apps - required):
```xml
<!-- app.manifest -->
<requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
```

This ensures Windows prompts for elevation at application launch, which is **mandatory** for LibreHardwareMonitor functionality.

**Security Best Practices for Elevated Applications**:
- Validate all input to native addon (even though app is already elevated)
- Never expose raw hardware control APIs to untrusted code or plugins
- Log all hardware access operations for audit trails
- Code signing is critical for elevated applications to prevent UAC warnings
- Minimize elevated code surface - keep hardware monitoring isolated

### .NET Runtime Loading Security

**Trust Boundary Considerations**:
- CLR hosting loads managed code from LibreHardwareMonitor.dll
- Ensure DLL integrity using file hashes or signatures
- Load DLLs only from trusted locations (app directory)

**Recommended Security Measures**:

1. **DLL Verification**:
   ```cpp
   // Verify DLL signature before loading
   bool VerifyDllSignature(const wchar_t* dllPath) {
     // Implement Authenticode signature verification
     // Or verify SHA-256 hash against known good value
   }
   ```

2. **Restricted Load Paths**:
   ```cpp
   // Only load from application directory
   std::wstring appDir = GetApplicationDirectory();
   std::wstring dllPath = appDir + L"\\LibreHardwareMonitorLib.dll";
   
   if (!PathIsInDirectory(dllPath, appDir)) {
     throw SecurityException("DLL path outside app directory");
   }
   ```

3. **AppDomain Security** (if using .NET Framework):
   - Create restricted AppDomain for LibreHardwareMonitor
   - Limit permissions to minimum required
   - Prevent code execution from untrusted sources

**Kernel Driver Considerations**:
- LibreHardwareMonitor uses a kernel driver for hardware access (WinRing0.sys or PawnIO.sys)
- **Note**: Due to security vulnerabilities in WinRing0, newer LibreHardwareMonitor versions use PawnIO instead
- Driver is loaded/unloaded automatically by LibreHardwareMonitor
- Requires Administrator privileges (inherent requirement, not optional)
- Driver signature is verified by Windows (must be signed)

**Best Practices**:
- Use LibreHardwareMonitor commits that implement PawnIO (more secure than WinRing0)
- Implement cleanup to ensure driver unloading on application exit
- Monitor for driver loading failures and report to user

### Production Deployment Checklist

- [ ] Code signing certificate for native addon
- [ ] DLL integrity verification implemented
- [ ] Elevation requirement documented in README
- [ ] Error handling for privilege failures
- [ ] Audit logging for hardware access
- [ ] Process isolation considered for security-critical deployments
- [ ] User consent flow for elevation (if interactive)
- [ ] Fallback mechanisms tested

## JSON Output Contract

Native addon **must** produce byte-identical output to:
```
http://localhost:8085/data.json
```

**Blueprint**: See `example/librehardwaremonitor_webservice_output.json` for the exact output format that must be replicated. This file contains a real-world example from the LibreHardwareMonitor web endpoint and serves as the definitive specification for the native addon's output structure.

### Validation Requirements
- Schema tests enforce exact structure match against the example blueprint
- Compatibility tests compare web vs native output
- CI pipeline blocks merges on format drift

## Error Handling Strategy

### Fault Isolation
- Native crashes **cannot** kill host Node.js/Electron process
- Wrap all addon calls in try/catch
- Consider process isolation for critical operations

### Graceful Degradation
```javascript
try {
  const sensors = await nativeMonitor.poll();
} catch(err) {
  console.error('Native polling failed, reverting to web');
  const sensors = await webMonitor.poll();
}
```

### Fallback Triggers
- Addon initialization failure
- Consecutive polling errors (> 3)
- Memory usage exceeding threshold
- Missing required sensors

## Performance Targets

### Footprint
- Memory: < 50MB resident (includes LibreHardwareMonitor library overhead)
- CPU: < 1% average during polling
- Startup: < 200ms initialization (CLR load time)
- Disk: ~10-20MB for LHM DLLs (.NET runtime already present on system)

### Reliability (Critical)
- 99.9% uptime over 30-day period
- Zero hard crashes to desktop
- < 0.1% sensor read failures

### Performance (Secondary)
- Polling latency: < 50ms per cycle
- Data freshness: Match or exceed web endpoint

## Development Workflow

1. **Document Current Format**: Extract exact JSON schema from web endpoint
2. **Build Schema Tests**: Enforce format compliance from day one
3. **Implement CLR Hosting**: Initialize .NET runtime and load LibreHardwareMonitor.dll
4. **Implement Sensor Polling**: Call LHM's Computer class to gather sensor data
5. **Build Data Marshaling**: Convert .NET objects to JSON matching web endpoint
6. **Stress Test**: Run 7-day reliability tests before integration
7. **Package and Publish**: Release as standalone npm package

## Integration Interface

### Required API Surface
```javascript
const nativeMonitor = require('librehardwaremonitor-native');

// Initialize with configuration options
await nativeMonitor.init({
  motherboard: true,
  cpu: true,
  gpu: true,
  memory: true,
  storage: false,      // Disable HDD monitoring
  network: false,
  psu: false,
  controller: false,
  battery: false
});

// Poll sensors (matches web endpoint format)
const data = await nativeMonitor.poll();
// Returns: { id: 0, Text: "Sensor", Children: [...] }

// Poll with optional flattening (matches existing application format)
const flatData = await nativeMonitor.poll({ flatten: true });
// Returns: { mainboard: [...], cpu: [...], gpu: [...], ... }

// Cleanup
nativeMonitor.shutdown();
```

### Compatibility Layer
Native addon ships with `web-compat.js` wrapper ensuring:
- Async/await interface matches existing code
- Error objects match web fetch failures
- Timeout behavior identical to HTTP requests

## Troubleshooting

### Build Issues

**Problem**: `nethost.lib not found`
```
Solution: Install .NET SDK and configure library path in binding.gyp
Location: C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Host.win-x64\<version>\runtimes\win-x64\native\
```

**Problem**: `node-gyp rebuild` fails with Python errors
```
Solution: Install Python 3.x and add to PATH
Verify: python --version
```

**Problem**: Missing Visual Studio build tools
```
Solution: Install Visual Studio 2019+ with "Desktop development with C++" workload
Or: Install Build Tools for Visual Studio (standalone)
```

**Problem**: `Cannot find module 'node-addon-api'`
```
Solution: npm install node-addon-api
```

### Runtime Issues

**Problem**: `CLR_INIT_FAILED` - .NET runtime not found
```
Solution: 
1. Install .NET Runtime 6.0 or later
2. Verify installation: dotnet --version
3. Check if runtime is in PATH
Download: https://dotnet.microsoft.com/download/dotnet/6.0
```

**Problem**: `DLL_NOT_FOUND` - LibreHardwareMonitor.dll missing
```
Solution:
1. Verify DLLs exist in deps/LibreHardwareMonitor/
2. Check binding.gyp copies DLLs to build/Release/
3. Ensure DLLs are deployed with .node addon
Required: LibreHardwareMonitorLib.dll, HidSharp.dll
```

**Problem**: `ACCESS_DENIED` - Privilege errors
```
Solution:
1. Run VS Code as Administrator (for development/testing)
2. Ensure application has requireAdministrator manifest
3. Check UAC settings are not blocking driver loading
```

**Problem**: `DRIVER_LOAD_FAILED` - PawnIO driver won't load
```
Solution:
1. Verify running as Administrator
2. Check Windows Driver Signature Enforcement settings
3. Test Driver Verifier is not blocking unsigned drivers
4. Check antivirus/security software blocking kernel driver
```

**Problem**: Sensors missing or incomplete data
```
Solution:
1. Not an error - hardware may not support all sensors
2. Compare with standalone LibreHardwareMonitor.exe output
3. Ensure correct hardware types enabled in init() config
4. Some sensors require specific hardware/BIOS settings
```

### Memory Issues

**Problem**: Memory usage grows over time
```
Solution:
1. Verify Computer.Close() is called on shutdown
2. Check CLR is properly unloaded on exit
3. Monitor with: process.memoryUsage()
4. Consider recreating Computer object periodically (e.g., daily)
```

**Problem**: High CPU usage during polling
```
Solution:
1. Increase polling interval (default 1000ms, try 2000ms+)
2. Disable unused hardware types in init()
3. Profile to identify bottleneck (marshaling vs sensor reads)
```

### Development Tips

**Running VS Code as Administrator**:
```powershell
# PowerShell (run from elevated prompt)
Start-Process code -Verb RunAs

# Or create elevated shortcut
# Right-click VS Code shortcut → Properties → Advanced → Run as administrator
```

**Testing with Real Hardware**:
- No mock framework needed - test with actual LibreHardwareMonitor.dll
- Requires admin rights for development environment
- Use try/catch extensively during development
- Log all sensor reads to identify hardware-specific issues

**Debugging Native Code**:
```json
// .vscode/launch.json for native debugging
{
  "type": "cppvsdbg",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/.bin/node.exe",
  "args": ["test.js"],
  "console": "integratedTerminal",
  "requireExactSource": false
}
```

## Success Metrics

Before declaring production-ready:
- [ ] 30-day continuous operation without crashes
- [ ] Schema validation passes 100% of time
- [ ] Memory footprint < web polling approach
- [ ] Zero regressions in sensor coverage
- [ ] Successful testing across 5+ hardware configurations

## Non-Goals

- Cross-platform support (Windows-only initially)
- Real-time sensor streaming (keep polling model)
- Historical data storage (stays in application layer)
- UI for native addon (headless library only)

## Repository Structure (Future)

Once proven:
```
npm install librehardwaremonitor-native
```

Separate npm package allowing:
- Independent versioning
- Reuse in other monitoring tools
- Community contributions

---

**Status**: Planning phase  
**Next Step**: Document exact JSON schema from current web endpoint