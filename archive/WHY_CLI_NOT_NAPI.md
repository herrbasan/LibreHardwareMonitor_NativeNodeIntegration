# Why CLI Instead of N-API Addon?

## Decision Date
October 10, 2025

## Summary
After fully implementing and validating a working N-API addon for LibreHardwareMonitor integration, we decided to **archive the N-API approach** and pursue a **standalone CLI executable** instead.

## The N-API Implementation (Archived)
The archived N-API addon was **fully functional and production-ready**:
- ✅ C++ addon with CLR hosting
- ✅ JSON output structurally identical to web endpoint
- ✅ Hardware filtering and configuration options
- ✅ Async polling with libuv thread pool
- ✅ Pre-built distribution with all dependencies
- ✅ Comprehensive test suite validating structure match

**Location**: `archive/napi-approach/`

## Why We Changed Direction

### 1. **Architectural Simplicity**
**N-API**: JavaScript → Node-API → C++ → CLR → .NET → LibreHardwareMonitor  
**CLI**: JavaScript → child_process → .NET executable → LibreHardwareMonitor

The CLI removes two layers of complexity (Node-API and C++/CLR hosting).

### 2. **Process Isolation**
**N-API Problem**: If LibreHardwareMonitor crashes (driver issue, hardware error), it brings down the entire Electron process.

**CLI Solution**: Hardware monitoring runs in separate process. Crashes are isolated and recoverable.

### 3. **Deployment Simplicity**
**N-API Challenges**:
- Native modules must match Node.js version (Electron rebuilds)
- Binary compatibility issues across Node/Electron versions
- Complex build toolchain (Visual Studio, Python, node-gyp)

**CLI Advantages**:
- Single .NET executable (no Node.js version coupling)
- Users don't need C++ build tools
- Framework-dependent or self-contained deployment options

### 4. **Development Velocity**
**N-API Development**:
- C++ code for CLR hosting and marshaling
- Complex debugging (mixed native/managed)
- Memory management across boundaries
- Node-API version compatibility

**CLI Development**:
- Pure C# (simpler, safer)
- Standard .NET debugging
- Familiar development workflow
- Easier to maintain and extend

### 5. **Flexibility**
CLI can be used by:
- Electron apps (via child_process)
- Web services (via exec)
- Standalone automation
- Other programming languages

N-API is locked to Node.js/Electron ecosystem.

### 6. **Performance Is Not a Concern**
**Process Spawn Overhead**: ~50-100ms initial spawn  
**Polling Frequency**: Typically every 1-5 seconds

The one-time spawn cost is negligible compared to polling intervals.

## What We Kept

### Preserved Knowledge
- **LIBREMON_CLI_DEV_PLAN.md**: Complete CLI specification (1156 lines)
- **reference/libre_hardware_flatten.js**: Data transformation logic
- **docs/**: Architecture documentation
- **test/compare-web-vs-native.js**: Structure validation approach
- **managed/**: C# bridge code (repurposed for CLI)

### Preserved Code
- **archive/napi-approach/**: Complete working N-API implementation
  - Serves as reference for integration patterns
  - Demonstrates LibreHardwareMonitor usage
  - Proves structural compatibility

## Migration Notes

### For Existing Users
If you were using the N-API addon:
1. The archived code remains at `archive/napi-approach/`
2. You can continue using it (frozen, no updates)
3. Or migrate to CLI approach when ready

### Integration Change
```javascript
// OLD (N-API)
const monitor = require('librehardwaremonitor-native');
await monitor.init({ cpu: true, gpu: true });
const data = await monitor.poll();

// NEW (CLI)
const { spawn } = require('child_process');
const cli = spawn('libremon-cli.exe', ['--raw']);
cli.stdout.on('data', (chunk) => {
  const data = JSON.parse(chunk);
  // ...
});
```

## Conclusion
The N-API implementation was a valuable learning exercise that:
1. Proved structural compatibility with web endpoint
2. Validated async polling patterns
3. Identified filtering requirements
4. Documented LibreHardwareMonitor integration

The CLI approach builds on this knowledge while offering better architecture, simpler deployment, and easier maintenance.

## References
- N-API Implementation: `archive/napi-approach/`
- CLI Specification: `LIBREMON_CLI_DEV_PLAN.md`
- Original Discussion: Conversation summary, October 10, 2025
