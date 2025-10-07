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
│   └── index.js             # JS interface matching web endpoint format
├── deps/
│   └── LibreHardwareMonitor/  # LHM DLLs and dependencies
├── test/
│   ├── compatibility.js     # Validates output === web JSON
│   └── schema.test.js       # JSON structure validation
├── example/
│   └── librehardwaremonitor_webservice_output.json  # Reference output format
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
   - Invokes sensor polling methods
   - Converts .NET objects to C++ structures

3. **Data Marshaling** (`src/json_builder.cc`)
   - Converts LibreHardwareMonitor data structures to JSON
   - Ensures byte-identical output to web endpoint format
   - Handles sensor hierarchies and metadata

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

// Initialize (one-time)
await nativeMonitor.init();

// Poll sensors (matches web endpoint format)
const data = await nativeMonitor.poll(filterConfig);
// Returns: { Children: [...], Text: "Computer", ... }

// Cleanup
nativeMonitor.shutdown();
```

### Compatibility Layer
Native addon ships with `web-compat.js` wrapper ensuring:
- Async/await interface matches existing code
- Error objects match web fetch failures
- Timeout behavior identical to HTTP requests

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