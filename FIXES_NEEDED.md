# LibreMon Native Module - Issues and Fixes Needed

**Created:** October 8, 2025  
**Context:** After debugging session attempting to integrate native hardware monitoring  
**Status:** Native module not working, reverted to web polling in main app

---

## Critical Issues

### 1. Module Initialization Failure

**Problem:**
```javascript
// Error in stage.js when loading native module
Error: Failed to initialize hardware monitor
```

The native module fails to initialize with a generic error message. No visibility into the actual C# exception that's being thrown.

**Root Cause Analysis:**
- C# code in `HardwareMonitorBridge.cs` is throwing an exception during initialization
- The Node.js addon wrapper is catching the exception but only passing generic error message
- No stack trace or detailed error information propagated to JavaScript layer

**Required Fixes:**
1. **Improve error reporting in Node.js addon layer** (`src/hardware_monitor.cc`)
   - Capture full exception details from C# layer
   - Include exception type, message, stack trace
   - Pass detailed error information to JavaScript instead of generic message

2. **Add diagnostic logging to C# initialization** (`managed/LibreHardwareMonitorBridge/HardwareMonitorBridge.cs`)
   - Log each step of initialization process
   - Catch and log specific exception types
   - Verify LibreHardwareMonitorLib.dll loads correctly
   - Check Computer object creation succeeds

3. **Add validation in C# constructor:**
   ```csharp
   public HardwareMonitorBridge()
   {
       try
       {
           Console.WriteLine("[C#] Starting HardwareMonitorBridge initialization...");
           
           computer = new Computer
           {
               IsCpuEnabled = true,
               IsGpuEnabled = true,
               IsMemoryEnabled = true,
               // ... other sensors
           };
           
           Console.WriteLine("[C#] Computer object created successfully");
           computer.Open();
           Console.WriteLine("[C#] Computer.Open() completed");
           
           Console.WriteLine("[C#] HardwareMonitorBridge initialized successfully");
       }
       catch (Exception ex)
       {
           Console.WriteLine($"[C#] FATAL ERROR in initialization: {ex.GetType().Name}");
           Console.WriteLine($"[C#] Message: {ex.Message}");
           Console.WriteLine($"[C#] Stack: {ex.StackTrace}");
           throw; // Re-throw with detailed logging
       }
   }
   ```

### 2. SubHardware Sensor Reading Issues

**Problem:**
When attempting to read sensors, the code doesn't properly traverse SubHardware hierarchy, causing many sensors (especially CPU cores, GPU components) to be missed.

**Current Implementation:**
```csharp
// Only reads top-level hardware sensors
foreach (var hardware in computer.Hardware)
{
    foreach (var sensor in hardware.Sensors)
    {
        // Process sensor
    }
}
```

**Required Fix:**
```csharp
private void ProcessHardware(IHardware hardware, JArray sensorsArray)
{
    hardware.Update();
    
    // Process sensors at this level
    foreach (var sensor in hardware.Sensors)
    {
        var sensorData = new JObject
        {
            ["name"] = sensor.Name,
            ["identifier"] = sensor.Identifier.ToString(),
            ["sensorType"] = sensor.SensorType.ToString(),
            ["value"] = sensor.Value ?? 0.0f,
            ["min"] = sensor.Min ?? 0.0f,
            ["max"] = sensor.Max ?? 0.0f
        };
        sensorsArray.Add(sensorData);
    }
    
    // CRITICAL: Recursively process SubHardware
    foreach (var subHardware in hardware.SubHardware)
    {
        ProcessHardware(subHardware, sensorsArray); // Recursive call
    }
}

public string GetHardwareData()
{
    var result = new JObject();
    var hardwareArray = new JArray();

    foreach (var hardware in computer.Hardware)
    {
        var hwData = new JObject
        {
            ["name"] = hardware.Name,
            ["type"] = hardware.HardwareType.ToString()
        };
        
        var sensorsArray = new JArray();
        ProcessHardware(hardware, sensorsArray); // Use recursive function
        
        hwData["sensors"] = sensorsArray;
        hardwareArray.Add(hwData);
    }

    result["hardware"] = hardwareArray;
    return result.ToString();
}
```

### 3. Data Flattening Logic

**Problem:**
The current flattening logic in the native module doesn't match the proven web polling flatten logic. This causes data structure mismatches when consuming the data in the UI.

**Solution:**
Reference implementation is preserved in `reference/libre_hardware_flatten.js`. The native module should produce data in the same flat structure as the web polling flatten function.

**Required Changes:**
1. Study the flatten logic in `reference/libre_hardware_flatten.js`
2. Update C# GetHardwareData() to produce the same flat structure
3. Ensure group names, slugs, sensor types match exactly
4. Test output structure matches web polling output

**Target Output Format:**
```javascript
{
    "cpu": {
        "group": "cpu",
        "name": "Intel Core i7-9700K",
        "sensors": {
            "load_total": { name: "CPU Total", value: 45.2, type: "load" },
            "load_core_1": { name: "CPU Core #1", value: 50.1, type: "load" },
            "temperature_core_average": { name: "CPU Core Average", value: 65.0, type: "temperature" },
            // ... more sensors
        }
    },
    "gpu_nvidia": {
        "group": "gpu",
        "name": "NVIDIA GeForce RTX 3080",
        "sensors": {
            "load_core": { name: "GPU Core", value: 80.5, type: "load" },
            "temperature_core": { name: "GPU Core", value: 72.0, type: "temperature" },
            // ... more sensors
        }
    },
    // ... more hardware groups
}
```

---

## Build System Issues

### 4. DLL Version Mismatch

**Problem:**
Incremental builds may cache old versions of managed DLL, causing runtime failures even after C# code changes.

**Symptoms:**
- Changes to C# code don't appear to take effect
- Runtime behavior doesn't match source code
- Generic initialization errors

**Required Fixes:**
1. **Clean build script** - Add to `scripts/build-managed.js`:
   ```javascript
   const fs = require('fs');
   const path = require('path');
   
   // Clean dist folder before build
   const distPath = path.join(__dirname, '..', 'dist');
   if (fs.existsSync(distPath)) {
       fs.rmSync(distPath, { recursive: true, force: true });
       console.log('Cleaned dist/ folder');
   }
   ```

2. **Add clean npm script** to `package.json`:
   ```json
   {
     "scripts": {
       "clean": "node scripts/clean.js",
       "rebuild": "npm run clean && npm run build"
     }
   }
   ```

3. **Create `scripts/clean.js`:**
   ```javascript
   const fs = require('fs');
   const path = require('path');
   
   const foldersToClean = [
       path.join(__dirname, '..', 'dist'),
       path.join(__dirname, '..', 'build'),
       path.join(__dirname, '..', 'managed', 'LibreHardwareMonitorBridge', 'bin'),
       path.join(__dirname, '..', 'managed', 'LibreHardwareMonitorBridge', 'obj')
   ];
   
   foldersToClean.forEach(folder => {
       if (fs.existsSync(folder)) {
           fs.rmSync(folder, { recursive: true, force: true });
           console.log(`Cleaned: ${folder}`);
       }
   });
   ```

### 5. Incremental Build Cache Issues

**Problem:**
`node-gyp` and MSBuild may not properly detect changes in C# files, leading to stale builds.

**Solution:**
Always use clean rebuilds during active development:
```bash
npm run clean
npm run build
```

Or create a single command:
```bash
npm run rebuild
```

---

## Testing Strategy

### Phase 1: Verify Initialization
1. Add extensive logging to C# constructor
2. Run module in isolation with test script
3. Confirm Computer object creation succeeds
4. Verify hardware enumeration works
5. Check sensor count matches LibreHardwareMonitor GUI

### Phase 2: SubHardware Traversal
1. Implement recursive ProcessHardware() function
2. Test with CPU (has core SubHardware)
3. Test with GPU (may have SubHardware for different components)
4. Compare sensor count with LibreHardwareMonitor GUI
5. Ensure all sensors are discovered

### Phase 3: Data Structure
1. Run web polling and native polling side-by-side
2. Compare output structures
3. Ensure flatten logic produces identical format
4. Test UI consumption of both data sources
5. Verify no regressions in sensor display

### Phase 4: Error Handling
1. Test behavior when admin privileges missing
2. Test behavior when hardware access fails
3. Verify error messages are actionable
4. Ensure graceful degradation (fallback to web polling)

---

## Testing Approach

### Recommended Development Workflow

1. **Work in isolation** - Debug native module in this repository, not in main Electron app
2. **Use test scripts** - Create simple test.js that loads module and dumps data
3. **Compare with GUI** - Run LibreHardwareMonitor.exe GUI alongside tests to verify sensor discovery
4. **Incremental testing** - Test each fix individually before combining
5. **Clean builds** - Always clean before testing to avoid cache issues

### Test Script Template

Create `test/manual-test.js`:
```javascript
const hardwareMonitor = require('../dist/librehardwaremonitor-native.node');

console.log('=== LibreMon Native Module Test ===\n');

try {
    console.log('1. Initializing hardware monitor...');
    const result = hardwareMonitor.initialize();
    console.log('   ✓ Initialization successful');
    console.log('   Result:', result);
    
    console.log('\n2. Getting hardware data...');
    const data = hardwareMonitor.getHardwareData();
    const parsed = JSON.parse(data);
    
    console.log('   ✓ Data retrieved');
    console.log('\n3. Hardware Summary:');
    
    if (parsed.hardware) {
        parsed.hardware.forEach(hw => {
            console.log(`   - ${hw.name} (${hw.type})`);
            console.log(`     Sensors: ${hw.sensors.length}`);
        });
    }
    
    console.log('\n4. Full Data Structure:');
    console.log(JSON.stringify(parsed, null, 2));
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}

console.log('\n=== Test Complete ===');
```

Run with: `node test/manual-test.js`

---

## Architecture Comparison

### Web Polling (Current Working Solution)

```
LibreHardwareMonitor.exe (standalone process)
    ↓ HTTP Server on localhost:8085
    ↓ GET /data.json
libre_hardware_monitor_web.js (fetch raw JSON)
    ↓
libre_hardware_flatten.js (transform hierarchical → flat)
    ↓
stage.js (merge with Intel Arc data)
    ↓
UI (display sensors)
```

**Pros:**
- ✓ Simple, proven, working
- ✓ Clean separation of concerns
- ✓ Easy to debug (can inspect HTTP responses)
- ✓ No native dependencies
- ✓ Cross-platform potential

**Cons:**
- ✗ Requires LibreHardwareMonitor.exe to run
- ✗ Extra process overhead
- ✗ HTTP polling latency
- ✗ Dependency on external executable

### Native Polling (Target Solution)

```
Node.js Addon (librehardwaremonitor-native.node)
    ↓ Direct CLR/.NET interop
    ↓ C# HardwareMonitorBridge
    ↓ LibreHardwareMonitorLib.dll (same library as .exe)
libre_hardware_monitor_native.js (adapter, already implements flattening)
    ↓
stage.js (merge with Intel Arc data)
    ↓
UI (display sensors)
```

**Pros:**
- ✓ No external process needed
- ✓ Direct hardware access
- ✓ Lower latency
- ✓ More control over data structure
- ✓ Cleaner deployment (one executable)

**Cons:**
- ✗ Complex native/managed interop
- ✗ Debugging is harder
- ✗ Platform-specific (Windows only)
- ✗ Currently not working (initialization failure)

---

## Files Modified During Debug Session

The following files were modified during the debugging session and will be reset:

### C# Managed Code
- `managed/LibreHardwareMonitorBridge/HardwareMonitorBridge.cs`
  - Added extensive debug logging (Console.WriteLine statements)
  - Added try-catch blocks around initialization
  - Did NOT fix SubHardware traversal issue
  - Did NOT fix data structure format

### Build Artifacts
- `dist/` folder - Contains old DLL versions from incremental builds
- `build/` folder - node-gyp build cache

### Configuration
- `build/config.gypi` - Build configuration cache

---

## Next Steps

### Immediate Actions (Before Resuming Development)

1. ✅ **Document issues** - This file captures all known problems
2. ✅ **Preserve working flatten logic** - `reference/libre_hardware_flatten.js` saved as reference
3. ✅ **Reset submodule** - Discard all debug changes, start fresh
4. ⏳ **Commit documentation** - Save this file and reference flatten logic to git

### Future Development Steps

1. **Fix initialization error reporting**
   - Update `src/hardware_monitor.cc` to capture detailed C# exceptions
   - Add diagnostic logging throughout initialization path
   - Create test script to isolate initialization issues

2. **Implement SubHardware traversal**
   - Add recursive ProcessHardware() function
   - Test with multi-level hardware (CPU cores, GPU components)
   - Verify sensor count matches LibreHardwareMonitor GUI

3. **Match data structure to web polling**
   - Study `reference/libre_hardware_flatten.js`
   - Update C# code to produce same flat structure
   - Write comparison test (web vs native output)

4. **Improve build system**
   - Add clean scripts
   - Document clean build workflow
   - Consider build validation checks

5. **Integration testing**
   - Test in main Electron app
   - Verify UI consumption
   - Performance comparison with web polling
   - Graceful fallback mechanism

---

## Status Summary

**Current State:**
- Native module initialization fails with generic error
- SubHardware sensors are not being read
- Data structure doesn't match web polling format
- Build system may cache stale DLLs

**Main App State:**
- Reverted to web polling (working)
- Flatten logic extracted to reusable module
- Clean architecture with separation of concerns
- Production ready

**This Repository:**
- Reset to clean state
- All debugging changes discarded
- Documentation preserved
- Ready for fresh debugging session

**Recommended Approach:**
- Debug native module issues in isolation (this repo)
- Use test scripts instead of full Electron app
- Fix issues incrementally with clean builds
- Integrate back to main app only when stable
- Keep web polling as fallback option

---

## Reference Material

### Working Flatten Logic
See `reference/libre_hardware_flatten.js` for the proven data transformation logic that works with web polling. This should be the target output format for the native module.

### LibreHardwareMonitor Documentation
- GitHub: https://github.com/LibreHardwareMonitor/LibreHardwareMonitor
- API docs show proper SubHardware traversal patterns
- Example C# code for sensor enumeration

### Debugging Resources
- Use LibreHardwareMonitor.exe GUI to verify expected sensor counts
- Compare native module output with web polling JSON
- Check Windows Event Viewer for C# runtime errors
- Use Visual Studio debugger to attach to Node.js process

---

**Last Updated:** October 8, 2025  
**Author:** Development session with GitHub Copilot  
**Purpose:** Preserve context before resetting submodule to clean state
