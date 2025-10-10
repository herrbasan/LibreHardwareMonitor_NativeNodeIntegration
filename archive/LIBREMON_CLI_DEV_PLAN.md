# LibreMon CLI - Implementation Plan

## Overview

Convert the LibreHardwareMonitor .NET module from Edge.js bindings to a standalone persistent daemon that communicates via stdin/stdout using newline-delimited JSON. This enables ultra-low-latency integration with the Electron app for high-frequency polling (1 second or faster) without the overhead of repeated process spawning.

## Project Goals

- **Zero Electron dependencies** - Pure .NET console application
- **Persistent daemon mode** - Long-running process with stdin/stdout JSON-RPC protocol
- **Ultra-low latency** - 2-5ms poll time (no process spawn overhead)
- **Minimal footprint** - NativeAOT compilation for 5-8MB binary and <15MB memory
- **High-frequency polling** - Optimized for 1-second intervals or faster
- **Reliable communication** - Newline-delimited JSON protocol (battle-tested)
- **Stateful operation** - Maintain Computer singleton for entire daemon lifetime

## Architecture

### Daemon Mode (Primary)

```bash
# Node.js spawns daemon once, keeps alive for entire session
libremon-cli.exe --daemon

# Communicates via stdin/stdout using newline-delimited JSON
stdin:  {"cmd":"init","flags":["cpu","gpu","memory"]}\n
stdout: {"success":true,"initialized":["cpu","gpu","memory"]}\n

stdin:  {"cmd":"poll"}\n
stdout: {"success":true,"timestamp":1728567890123,"data":{...}}\n

stdin:  {"cmd":"poll"}\n
stdout: {"success":true,"timestamp":1728567890124,"data":{...}}\n

stdin:  {"cmd":"shutdown"}\n
stdout: {"success":true,"message":"Daemon shutting down"}\n
# Process exits cleanly
```

### Execution Flow

```
1. Node.js: spawn("libremon-cli.exe", ["--daemon"])
   ├─ Enter daemon mode (infinite read loop on stdin)
   ├─ Wait for commands on stdin
   └─ Ready for init

2. stdin: {"cmd":"init","flags":["cpu","gpu"],"flat":true}\n
   ├─ Parse JSON command
   ├─ Initialize LibreHardwareMonitor.Computer with flags
   ├─ Open hardware monitoring
   ├─ Save state to singleton (flat mode: true)
   └─ stdout: {"success":true,"initialized":["cpu","gpu"],"mode":"flat"}\n

3. stdin: {"cmd":"poll"}\n (repeats every 1 second)
   ├─ Check if initialized
   ├─ Update hardware sensors
   ├─ Collect sensor data from Computer
   ├─ Format as JSON (raw or flat based on init)
   └─ stdout: {"success":true,"data":{...}}\n

4. stdin: {"cmd":"shutdown"}\n
   ├─ Close hardware monitoring
   ├─ Cleanup resources
   ├─ stdout: {"success":true}\n
   └─ Exit daemon loop (process terminates)
```

### Performance Characteristics

- **Poll latency**: 2-5ms per command (no spawn overhead)
- **Memory footprint**: 10-15MB resident (NativeAOT)
- **CPU usage**: <0.5% idle, 1-2% during poll
- **Binary size**: 5-8MB (NativeAOT vs ~20MB self-contained)
- **Startup time**: ~100-200ms (one-time cost)
- **Polling frequency**: Supports <500ms intervals (LibreHardwareMonitor limit)

## JSON-RPC Protocol Specification

### Message Format

**All messages are newline-delimited JSON** (one JSON object per line):
- Commands sent to stdin end with `\n`
- Responses written to stdout end with `\n`
- Errors written to stderr (optional debug info)
- Each line is a complete, valid JSON object

**Example communication**:
```
→ stdin:  {"cmd":"init","flags":["cpu","gpu"]}\n
← stdout: {"success":true}\n
→ stdin:  {"cmd":"poll"}\n
← stdout: {"success":true,"data":{...}}\n
```

---

### Command: `init`

**Input (stdin)**:
```json
{
  "cmd": "init",
  "flags": ["cpu", "gpu", "memory", "motherboard", "storage", "network", "psu", "controller", "battery"],
  "flat": false
}
```

**Fields**:
- `cmd` (string, required): Must be `"init"`
- `flags` (string[], required): Array of hardware types to enable
- `flat` (boolean, optional): Enable flat output mode for all polls (default: `false`)

**Available flags**:
- `"cpu"` - Enable CPU sensors
- `"gpu"` - Enable GPU sensors  
- `"memory"` - Enable memory sensors
- `"motherboard"` - Enable motherboard sensors
- `"storage"` - Enable storage/disk sensors
- `"network"` - Enable network adapter sensors
- `"psu"` - Enable power supply sensors
- `"controller"` - Enable controller sensors
- `"battery"` - Enable battery sensors

**Output (stdout) - Success**:
```json
{
  "success": true,
  "initialized": ["cpu", "gpu", "memory"],
  "mode": "raw"
}
```

**Output (stdout) - Error**:
```json
{
  "success": false,
  "error": "Already initialized",
  "errorCode": "ALREADY_INITIALIZED"
}
```

---

### Command: `poll`

**Input (stdin)**:
```json
{
  "cmd": "poll"
}
```

**Fields**:
- `cmd` (string, required): Must be `"poll"`

**Note**: Output format (raw vs flat) is determined by the `flat` flag passed to `init` command.

**Output (stdout) - Success (Raw Mode)**:
```json
{
  "success": true,
  "timestamp": 1728567890123,
  "mode": "raw",
  "data": {
    "Children": [...]
  }
}
```

**Output (stdout) - Success (Flat Mode)**:
```json
{
  "success": true,
  "timestamp": 1728567890124,
  "mode": "flat",
  "data": {
    "cpu": [...],
    "gpu": [...]
  }
}
```

**Output (stdout) - Error**:
```json
{
  "success": false,
  "error": "Not initialized. Send 'init' command first.",
  "errorCode": "NOT_INITIALIZED"
}
```

---

### Command: `shutdown`

**Input (stdin)**:
```json
{
  "cmd": "shutdown"
}
```

**Fields**:
- `cmd` (string, required): Must be `"shutdown"`

**Output (stdout) - Success**:
```json
{
  "success": true,
  "message": "Hardware monitoring closed, daemon exiting"
}
```

After sending response, daemon terminates gracefully.

**Output (stdout) - Not Initialized** (still succeeds):
```json
{
  "success": true,
  "message": "Not initialized, daemon exiting"
}
```

---

## Output Modes

The CLI supports two output formats:

1. **Raw Mode** (default) - Mirrors LibreHardwareMonitor web service `/data.json` output
   - Hierarchical structure with `Children` arrays
   - Compatible with existing web service consumers
   - Larger payload size

2. **Flat Mode** (`--flat` flag) - Flattened structure for easier consumption
   - Transforms hierarchical data into typed objects
   - Groups sensors by hardware type (cpu, gpu, memory, etc.)
   - Smaller payload size (~23% reduction)
   - Reference implementation: `reference/libre_hardware_flatten.js` (local)

**Example comparison**:

Raw output (web service format):
```json
{
  "Children": [{
    "Children": [{
      "Text": "AMD Ryzen 9 5950X",
      "ImageURL": "images_icon/cpu.png",
      "Children": [{
        "Text": "Temperatures",
        "Children": [{
          "Text": "Core (Tctl/Tdie)",
          "Value": "62.0 °C",
          "Min": "45.0 °C",
          "Max": "75.0 °C"
        }]
      }]
    }]
  }]
}
```

Flat output (transformed):
```json
{
  "cpu": [{
    "name": "AMD Ryzen 9 5950X",
    "temperatures": {
      "core-tctl-tdie": {
        "name": "Core (Tctl/Tdie)",
        "data": {
          "value": 62.0,
          "type": "°C",
          "min": 45.0,
          "max": 75.0
        }
      }
    }
  }]
}
```

---

### `init` Command

**Usage:**
```bash
libremon-cli.exe init [flags]
```

**Flags:**
- `--cpu` - Enable CPU sensors
- `--gpu` - Enable GPU sensors
- `--memory` - Enable memory sensors
- `--motherboard` - Enable motherboard sensors
- `--storage` - Enable storage/disk sensors
- `--network` - Enable network adapter sensors
- `--psu` - Enable power supply sensors
- `--controller` - Enable controller sensors
- `--battery` - Enable battery sensors
- `--intel-arc` - Enable Intel Arc GPU workaround (if applicable)
- `--flat` - Enable flattened output mode for all subsequent `poll` commands

**Output (Success):**
```json
{
  "success": true,
  "initialized": ["cpu", "gpu", "memory"],
  "outputMode": "flat"
}
```

**Output (Error):**
```json
{
  "success": false,
  "error": "Already initialized"
}
```

**Exit Codes:**
- `0` - Success
- `1` - Error (already initialized, access denied, etc.)

---

### `poll` Command

**Usage:**
```bash
libremon-cli.exe poll
```

**Note**: Output format (raw vs flat) is determined by the `--flat` flag passed to `init` command.

**Output (Success - Raw Mode)**:
```json
{
  "success": true,
  "timestamp": 1728567890123,
  "mode": "raw",
  "data": {
    "Children": [{
      "id": "0",
      "Text": "COOLKID",
      "Children": [{
        "id": "/intelcpu/0",
        "Text": "Intel Core i7-13700K",
        "ImageURL": "images_icon/cpu.png",
        "Children": [{
          "id": "/intelcpu/0/temperature",
          "Text": "Temperatures",
          "Children": [{
            "id": "/intelcpu/0/temperature/0",
            "Text": "CPU Core #1",
            "Value": "62.0 °C",
            "Min": "45.0 °C",
            "Max": "75.0 °C",
            "SensorId": "/intelcpu/0/temperature/0",
            "Type": "Temperature"
          }]
        }]
      }]
    }]
  }
}
```

**Output (Success - Flat Mode)**:
```json
{
  "success": true,
  "timestamp": 1728567890123,
  "mode": "flat",
  "data": {
    "cpu": [{
      "name": "Intel Core i7-13700K",
      "id": "/intelcpu/0",
      "temperatures": {
        "name": "Temperatures",
        "id": "/intelcpu/0/temperature",
        "cpu-core-1": {
          "name": "CPU Core #1",
          "SensorId": "/intelcpu/0/temperature/0",
          "data": {
            "value": 62.0,
            "type": "°C",
            "min": 45.0,
            "max": 75.0
          }
        }
      }
    }],
    "gpu": [{
      "name": "NVIDIA GeForce RTX 4090",
      "id": "/gpu-nvidia/0",
      "temperatures": {
        "name": "Temperatures",
        "id": "/gpu-nvidia/0/temperature",
        "gpu-core": {
          "name": "GPU Core",
          "SensorId": "/gpu-nvidia/0/temperature/0",
          "data": {
            "value": 72.0,
            "type": "°C",
            "min": 45.0,
            "max": 85.0
          }
        }
      },
      "load": {
        "name": "Load",
        "id": "/gpu-nvidia/0/load",
        "gpu-core": {
          "name": "GPU Core",
          "SensorId": "/gpu-nvidia/0/load/0",
          "data": {
            "value": 67.8,
            "type": "%"
          }
        }
      }
    }]
  }
}
```

**Output (Not Initialized):**
```json
{
  "success": false,
  "error": "Not initialized. Run 'init' command first."
}
```

**Exit Codes:**
- `0` - Success
- `1` - Not initialized
- `2` - Poll error (hardware access failed)

---

### `shutdown` Command

**Usage:**
```bash
libremon-cli.exe shutdown
```

**Output (Success):**
```json
{
  "success": true,
  "message": "Hardware monitoring closed"
}
```

**Output (Not Initialized):**
```json
{
  "success": false,
  "error": "Not initialized"
}
```

**Exit Codes:**
- `0` - Success
- `1` - Error

---

## Data Structure

### Output Format Selection

The CLI supports two output formats, selected via the `--flat` flag during `init`:

1. **Raw Mode** (default): Mirrors LibreHardwareMonitor web service structure
   - Hierarchical `Children` arrays
   - Direct 1:1 mapping to web service `/data.json` endpoint
   - Larger payload but no transformation required

2. **Flat Mode** (`--flat`): Transformed structure for easier consumption
   - Hardware grouped by type (cpu, gpu, memory, etc.)
   - Sensors organized by slugified sensor type names
   - ~23% smaller payload size
   - Implementation matches: https://github.com/herrbasan/Electron_LibreMon/blob/feature/native-polling-settings-ui/js/libre_hardware_flatten.js

---

### Raw Mode JSON Structure

Matches LibreHardwareMonitor web service `/data.json` output:

```typescript
interface RawPollResponse {
  success: boolean;
  timestamp?: number;
  mode: "raw";
  data?: {
    Children: HardwareNode[];
  };
  error?: string;
}

interface HardwareNode {
  id: string;
  Text: string;
  ImageURL?: string;
  Children: SensorGroupNode[];
}

interface SensorGroupNode {
  id: string;
  Text: string;
  Children: SensorNode[];
}

interface SensorNode {
  id: string;
  Text: string;
  Value: string;       // e.g., "62.0 °C"
  Min?: string;
  Max?: string;
  SensorId: string;
  Type: string;        // "Temperature", "Load", "Clock", etc.
}
```

### Flat Mode JSON Structure

Flattened and grouped by hardware type:

```typescript
interface FlatPollResponse {
  success: boolean;
  timestamp?: number;
  mode: "flat";
  data?: {
    [hardwareType: string]: HardwareDevice[];
  };
  error?: string;
}

interface HardwareDevice {
  name: string;
  id: string;
  [sensorGroupSlug: string]: SensorGroup;
}

interface SensorGroup {
  name: string;
  id: string;
  [sensorSlug: string]: SensorData;
}

interface SensorData {
  name: string;
  SensorId: string;
  data: {
    value: number;
    type: string;      // Unit: "°C", "%", "W", "MHz", "GB", etc.
    min?: number;
    max?: number;
  };
}
```

---

### Example Raw Mode Output (Web Service Format)

### Example Raw Mode Output (Web Service Format)

```json
{
  "success": true,
  "timestamp": 1728567890123,
  "mode": "raw",
  "data": {
    "Children": [{
      "id": "0",
      "Text": "COOLKID",
      "Children": [
        {
          "id": "/intelcpu/0",
          "Text": "Intel Core i7-13700K",
          "ImageURL": "images_icon/cpu.png",
          "Children": [
            {
              "id": "/intelcpu/0/load",
              "Text": "Load",
              "Children": [
                {
                  "id": "/intelcpu/0/load/0",
                  "Text": "CPU Total",
                  "Value": "23.5 %",
                  "Min": "5.0 %",
                  "Max": "98.2 %",
                  "SensorId": "/intelcpu/0/load/0",
                  "Type": "Load"
                }
              ]
            },
            {
              "id": "/intelcpu/0/temperature",
              "Text": "Temperatures",
              "Children": [
                {
                  "id": "/intelcpu/0/temperature/0",
                  "Text": "Core (Tctl/Tdie)",
                  "Value": "62.0 °C",
                  "Min": "45.0 °C",
                  "Max": "75.0 °C",
                  "SensorId": "/intelcpu/0/temperature/0",
                  "Type": "Temperature"
                }
              ]
            }
          ]
        },
        {
          "id": "/gpu-nvidia/0",
          "Text": "NVIDIA GeForce RTX 4090",
          "ImageURL": "images_icon/nvidia.png",
          "Children": [
            {
              "id": "/gpu-nvidia/0/temperature",
              "Text": "Temperatures",
              "Children": [
                {
                  "id": "/gpu-nvidia/0/temperature/0",
                  "Text": "GPU Core",
                  "Value": "72.0 °C",
                  "Min": "45.0 °C",
                  "Max": "85.0 °C",
                  "SensorId": "/gpu-nvidia/0/temperature/0",
                  "Type": "Temperature"
                }
              ]
            }
          ]
        }
      ]
    }]
  }
}
```

---

### Example Flat Mode Output

```json
{
  "success": true,
  "timestamp": 1728567890123,
  "mode": "flat",
  "data": {
    "cpu": [
      {
        "name": "Intel Core i7-13700K",
        "id": "/intelcpu/0",
        "load": {
          "name": "Load",
          "id": "/intelcpu/0/load",
          "cpu-total": {
            "name": "CPU Total",
            "SensorId": "/intelcpu/0/load/0",
            "data": {
              "value": 23.5,
              "type": "%",
              "min": 5.0,
              "max": 98.2
            }
          }
        },
        "temperatures": {
          "name": "Temperatures",
          "id": "/intelcpu/0/temperature",
          "core-tctl-tdie": {
            "name": "Core (Tctl/Tdie)",
            "SensorId": "/intelcpu/0/temperature/0",
            "data": {
              "value": 62.0,
              "type": "°C",
              "min": 45.0,
              "max": 75.0
            }
          }
        }
      }
    ],
    "gpu": [
      {
        "name": "NVIDIA GeForce RTX 4090",
        "id": "/gpu-nvidia/0",
        "temperatures": {
          "name": "Temperatures",
          "id": "/gpu-nvidia/0/temperature",
          "gpu-core": {
            "name": "GPU Core",
            "SensorId": "/gpu-nvidia/0/temperature/0",
            "data": {
              "value": 72.0,
              "type": "°C",
              "min": 45.0,
              "max": 85.0
            }
          }
        }
      }
    ]
  }
}
```

**Key differences**:
- Raw mode preserves exact web service structure
- Flat mode groups by hardware type and slugifies sensor names
- Flat mode parses `Value` strings into structured `data` objects
- Flat mode removes `ImageURL` and transforms `Text` to `name`
- Hardware type determined from `ImageURL` path (e.g., `images_icon/nvidia.png` → `gpu`)

---

## Implementation Details

### Project Structure

```
managed/LibreMonCLI/
├── LibreMonCLI.csproj           # Console app project file (NativeAOT config)
├── Program.cs                    # Entry point, daemon loop, stdin/stdout handler
├── CommandHandler.cs             # Init/Poll/Shutdown logic
├── HardwareMonitor.cs            # LibreHardwareMonitor wrapper (singleton)
├── JsonOutputFormatter.cs        # JSON serialization (System.Text.Json)
├── DataFlattener.cs              # Flatten transformation (raw → flat mode)
└── Models/
    ├── Command.cs                # JSON command models (init/poll/shutdown)
    ├── Response.cs               # JSON response models
    ├── RawDataStructure.cs       # Raw mode data structures
    └── FlatDataStructure.cs      # Flat mode data structures
```

### Class Responsibilities

**`Program.cs`**
- Enter daemon mode (`--daemon` flag)
- Read newline-delimited JSON from stdin in infinite loop
- Parse JSON commands and route to CommandHandler
- Write newline-delimited JSON responses to stdout
- Handle graceful shutdown on `shutdown` command
- Catch unhandled exceptions and write errors to stderr

**`CommandHandler.cs`**
- `HandleInit(InitCommand cmd)` - Initialize hardware with flags and mode
- `HandlePoll()` - Collect and return sensor data (raw or flat)
- `HandleShutdown()` - Clean up resources and signal daemon exit

**`HardwareMonitor.cs`**
- Singleton pattern for `Computer` instance
- Initialize hardware components based on flags
- Collect sensor data from hardware tree
- Maintain state for entire daemon lifetime
- Optimize: Only call `hardware.Update()` on poll, not init

**`JsonOutputFormatter.cs`**
- Serialize response objects to JSON
- Format raw sensor data structure (web service format)
- Handle error responses
- Write to stdout with newline delimiter
- Use System.Text.Json with source generators (not reflection)

**`DataFlattener.cs`**
- Transform raw hierarchical data to flat structure
- Slugify sensor names (e.g., "CPU Core #1" → "cpu-core-1")
- Parse Value strings (e.g., "62.0 °C" → `{value: 62.0, type: "°C"}`)
- Determine hardware type from ImageURL
- Reference implementation: `archive/napi-approach/reference/libre_hardware_flatten.js`

### Key Implementation Points

#### 1. Daemon Mode Entry Point

```csharp
public static class Program
{
    static async Task<int> Main(string[] args)
    {
        try
        {
            // Check for daemon mode flag
            if (args.Length > 0 && args[0] == "--daemon")
            {
                return await RunDaemonMode();
            }
            
            // Non-daemon mode (backward compatibility or testing)
            Console.Error.WriteLine("Usage: libremon-cli.exe --daemon");
            return 1;
        }
        catch (Exception ex)
        {
            await Console.Error.WriteLineAsync($"Fatal error: {ex.Message}");
            await Console.Error.WriteLineAsync(ex.StackTrace);
            return 1;
        }
    }
    
    static async Task<int> RunDaemonMode()
    {
        bool shouldExit = false;
        
        // Daemon loop: read commands from stdin until shutdown
        while (!shouldExit && !Console.IsInputRedirected || Console.In.Peek() != -1)
        {
            try
            {
                // Read one line from stdin (blocking)
                var line = await Console.In.ReadLineAsync();
                
                if (string.IsNullOrWhiteSpace(line))
                    continue;
                
                // Parse JSON command
                var command = JsonSerializer.Deserialize<Command>(line);
                
                // Route to handler
                var response = command.cmd switch
                {
                    "init" => await CommandHandler.HandleInit(command),
                    "poll" => await CommandHandler.HandlePoll(),
                    "shutdown" => await CommandHandler.HandleShutdown(),
                    _ => new ErrorResponse("Unknown command", "UNKNOWN_COMMAND")
                };
                
                // Write JSON response to stdout with newline
                var json = JsonSerializer.Serialize(response);
                await Console.Out.WriteLineAsync(json);
                await Console.Out.FlushAsync();
                
                // Exit daemon loop if shutdown command
                if (command.cmd == "shutdown")
                    shouldExit = true;
            }
            catch (JsonException ex)
            {
                // Invalid JSON input
                var error = new ErrorResponse($"Invalid JSON: {ex.Message}", "INVALID_JSON");
                await Console.Out.WriteLineAsync(JsonSerializer.Serialize(error));
                await Console.Out.FlushAsync();
            }
            catch (Exception ex)
            {
                // Unexpected error
                await Console.Error.WriteLineAsync($"Error: {ex.Message}");
                var error = new ErrorResponse($"Internal error: {ex.Message}", "INTERNAL_ERROR");
                await Console.Out.WriteLineAsync(JsonSerializer.Serialize(error));
                await Console.Out.FlushAsync();
            }
        }
        
        return 0; // Clean exit
    }
}
```

#### 2. Singleton Pattern for Computer

```csharp
public class HardwareMonitor
{
    private static Computer? _computer;
    private static bool _isInitialized = false;
    private static bool _useFlatMode = false;
    
    public static bool IsInitialized => _isInitialized;
    public static bool UseFlatMode => _useFlatMode;
    
    public static void Initialize(HashSet<string> enabledSensors, bool flatMode = false)
    {
        if (_isInitialized)
            throw new InvalidOperationException("Already initialized");
            
        _useFlatMode = flatMode;
        _computer = new Computer
        {
            IsCpuEnabled = enabledSensors.Contains("cpu"),
            IsGpuEnabled = enabledSensors.Contains("gpu"),
            IsMemoryEnabled = enabledSensors.Contains("memory"),
            IsMotherboardEnabled = enabledSensors.Contains("motherboard"),
            IsStorageEnabled = enabledSensors.Contains("storage"),
            IsNetworkEnabled = enabledSensors.Contains("network"),
            IsPsuEnabled = enabledSensors.Contains("psu"),
            IsControllerEnabled = enabledSensors.Contains("controller"),
            IsBatteryEnabled = enabledSensors.Contains("battery")
        };
        
        _computer.Open();
        _isInitialized = true;
    }
    
    public static object CollectData()
    {
        if (!_isInitialized || _computer == null)
            throw new InvalidOperationException("Not initialized");
        
        // Collect raw hierarchical data (web service format)
        var rawData = CollectRawData();
        
        // Transform to flat mode if enabled
        return _useFlatMode 
            ? DataFlattener.Flatten(rawData) 
            : rawData;
    }
    
    private static RawData CollectRawData()
    {
        // Build hierarchical Children structure matching web service
        // ...
    }
    
    public static void Shutdown()
    {
        if (_computer != null)
        {
            _computer.Close();
            _computer = null;
        }
        _isInitialized = false;
        _useFlatMode = false;
    }
}
```

#### 2. Command Argument Parsing

```csharp
public static class Program
{
    static int Main(string[] args)
    {
        try
        {
            if (args.Length == 0)
            {
                OutputError("No command specified");
                return 1;
            }
            
            var command = args[0].ToLowerInvariant();
            var flags = args.Skip(1).ToArray();
            
            return command switch
            {
                "init" => CommandHandler.HandleInit(flags),
                "poll" => CommandHandler.HandlePoll(),
                "shutdown" => CommandHandler.HandleShutdown(),
                _ => HandleUnknownCommand(command)
            };
        }
        catch (Exception ex)
        {
            OutputError(ex.Message);
            Console.Error.WriteLine(ex.StackTrace);
            return 1;
        }
    }
}
```

#### 3. JSON Output

```csharp
public static class JsonOutputFormatter
{
    private static readonly JsonSerializerOptions _options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };
    
    public static void OutputSuccess(object data)
    {
        var response = new { success = true, data };
        Console.WriteLine(JsonSerializer.Serialize(response, _options));
    }
    
    public static void OutputError(string message)
    {
        var response = new { success = false, error = message };
        Console.WriteLine(JsonSerializer.Serialize(response, _options));
    }
}
```

#### 4. Sensor Data Collection

```csharp
public static RawData CollectRawData()
{
    // Build hierarchical structure matching web service /data.json
    var root = new RawNode
    {
        Children = new List<RawNode>
        {
            new RawNode
            {
                id = "0",
                Text = Environment.MachineName,
                Children = new List<RawNode>()
            }
        }
    };
    
    var computerNode = root.Children[0];
    
    foreach (var hardware in _computer.Hardware)
    {
        hardware.Update();
        
        var hardwareNode = new RawNode
        {
            id = hardware.Identifier.ToString(),
            Text = hardware.Name,
            ImageURL = GetImageUrl(hardware.HardwareType),
            Children = new List<RawNode>()
        };
        
        // Group sensors by type
        var sensorGroups = hardware.Sensors
            .Where(s => s.Value.HasValue)
            .GroupBy(s => s.SensorType);
        
        foreach (var group in sensorGroups)
        {
            var groupNode = new RawNode
            {
                id = $"{hardware.Identifier}/{group.Key.ToString().ToLowerInvariant()}",
                Text = GetSensorTypeName(group.Key),
                Children = new List<RawNode>()
            };
            
            foreach (var sensor in group)
            {
                var sensorNode = new RawNode
                {
                    id = sensor.Identifier.ToString(),
                    Text = sensor.Name,
                    Value = $"{sensor.Value.Value:F1} {GetSensorUnit(sensor.SensorType)}",
                    Min = sensor.Min.HasValue ? $"{sensor.Min.Value:F1} {GetSensorUnit(sensor.SensorType)}" : null,
                    Max = sensor.Max.HasValue ? $"{sensor.Max.Value:F1} {GetSensorUnit(sensor.SensorType)}" : null,
                    SensorId = sensor.Identifier.ToString(),
                    Type = sensor.SensorType.ToString()
                };
                
                groupNode.Children.Add(sensorNode);
            }
            
            hardwareNode.Children.Add(groupNode);
        }
        
        computerNode.Children.Add(hardwareNode);
    }
    
    return new RawData { Children = new[] { root } };
}
```

#### 5. Data Flattening Logic

The `DataFlattener` class transforms raw hierarchical data to flat structure:

```csharp
public static class DataFlattener
{
    public static FlatData Flatten(RawData rawData)
    {
        var result = new Dictionary<string, List<FlatHardware>>();
        
        if (rawData?.Children == null || rawData.Children.Length == 0)
            return new FlatData { Data = result };
        
        var computerNode = rawData.Children[0];
        if (computerNode.Children == null || computerNode.Children.Count == 0)
            return new FlatData { Data = result };
        
        foreach (var hardwareNode in computerNode.Children[0].Children)
        {
            // Determine hardware type from ImageURL (e.g., "images_icon/nvidia.png" → "gpu")
            var hardwareType = GetHardwareType(hardwareNode.ImageURL);
            
            // Handle motherboard special case (may have nested children)
            var children = hardwareType == "mainboard" && hardwareNode.Children?.Count > 0
                ? hardwareNode.Children[0].Children
                : hardwareNode.Children;
            
            if (!result.ContainsKey(hardwareType))
                result[hardwareType] = new List<FlatHardware>();
            
            var flatHardware = new FlatHardware
            {
                name = hardwareNode.Text,
                id = hardwareNode.id,
                SensorGroups = new Dictionary<string, FlatSensorGroup>()
            };
            
            // Process sensor groups
            if (children != null)
            {
                foreach (var groupNode in children)
                {
                    var groupSlug = Slugify(groupNode.Text);
                    var flatGroup = new FlatSensorGroup
                    {
                        name = groupNode.Text,
                        id = groupNode.id,
                        Sensors = new Dictionary<string, FlatSensor>()
                    };
                    
                    // Process individual sensors
                    if (groupNode.Children != null)
                    {
                        foreach (var sensorNode in groupNode.Children)
                        {
                            var sensorSlug = Slugify(sensorNode.Text);
                            var parsedValue = ParseValue(sensorNode.Value);
                            
                            var flatSensor = new FlatSensor
                            {
                                name = sensorNode.Text,
                                SensorId = sensorNode.SensorId,
                                data = new SensorValue
                                {
                                    value = parsedValue.value,
                                    type = parsedValue.unit,
                                    min = sensorNode.Min != null ? ParseValue(sensorNode.Min).value : null,
                                    max = sensorNode.Max != null ? ParseValue(sensorNode.Max).value : null
                                }
                            };
                            
                            flatGroup.Sensors[sensorSlug] = flatSensor;
                        }
                    }
                    
                    flatHardware.SensorGroups[groupSlug] = flatGroup;
                }
            }
            
            result[hardwareType].Add(flatHardware);
        }
        
        return new FlatData { Data = result };
    }
    
    private static string Slugify(string text)
    {
        return text.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("#", "")
            .Replace("(", "")
            .Replace(")", "")
            .Replace("/", "-")
            .Trim('-');
    }
    
    private static (double value, string unit) ParseValue(string valueString)
    {
        // Parse "62.0 °C" → (62.0, "°C")
        var parts = valueString.Split(' ', 2);
        var number = double.Parse(parts[0].Replace(',', '.'));
        var unit = parts.Length > 1 ? parts[1] : "";
        return (number, unit);
    }
    
    private static string GetHardwareType(string imageUrl)
    {
        // Extract type from "images_icon/nvidia.png" → "nvidia" → "gpu"
        var type = imageUrl?.Split('/').Last().Split('.').First() ?? "unknown";
        
        return type switch
        {
            "nvidia" or "ati" or "intel" => "gpu",
            _ => type.ToLowerInvariant()
        };
    }
}
```

---

## Build Configuration

### Project File (LibreMonCLI.csproj)

**Optimized for NativeAOT - smallest binary, fastest startup, minimal memory**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    
    <!-- NativeAOT Configuration -->
    <PublishAot>true</PublishAot>
    <InvariantGlobalization>true</InvariantGlobalization>
    <IlcOptimizationPreference>Speed</IlcOptimizationPreference>
    <IlcGenerateStackTraceData>false</IlcGenerateStackTraceData>
    
    <!-- Size Optimization -->
    <PublishTrimmed>true</PublishTrimmed>
    <TrimMode>full</TrimMode>
    <EnableCompressionInSingleFile>true</EnableCompressionInSingleFile>
    
    <!-- JSON Source Generation (no reflection) -->
    <JsonSerializerIsReflectionEnabledByDefault>false</JsonSerializerIsReflectionEnabledByDefault>
    
    <!-- Additional Optimizations -->
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <DebugType>none</DebugType>
    <DebugSymbols>false</DebugSymbols>
  </PropertyGroup>

  <ItemGroup>
    <!-- LibreHardwareMonitor - reference built DLL -->
    <Reference Include="LibreHardwareMonitorLib">
      <HintPath>..\..\deps\LibreHardwareMonitor\LibreHardwareMonitorLib.dll</HintPath>
    </Reference>
    
    <!-- JSON Serialization with source generators -->
    <PackageReference Include="System.Text.Json" Version="9.0.0" />
  </ItemGroup>
  
  <!-- Suppress NativeAOT trim warnings for LibreHardwareMonitor (external DLL) -->
  <ItemGroup>
    <TrimmerRootAssembly Include="LibreHardwareMonitorLib" />
  </ItemGroup>
</Project>
```

### JSON Source Generator (for fast, reflection-free serialization)

Create `JsonContext.cs`:

```csharp
using System.Text.Json.Serialization;

namespace LibreMonCLI;

[JsonSerializable(typeof(Command))]
[JsonSerializable(typeof(InitCommand))]
[JsonSerializable(typeof(PollCommand))]
[JsonSerializable(typeof(ShutdownCommand))]
[JsonSerializable(typeof(Response))]
[JsonSerializable(typeof(InitResponse))]
[JsonSerializable(typeof(PollResponse))]
[JsonSerializable(typeof(ErrorResponse))]
[JsonSerializable(typeof(RawData))]
[JsonSerializable(typeof(FlatData))]
[JsonSourceGenerationOptions(
    WriteIndented = false,
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
)]
internal partial class JsonContext : JsonSerializerContext
{
}
```

Usage in code:
```csharp
// Instead of: JsonSerializer.Serialize(response)
// Use: JsonSerializer.Serialize(response, JsonContext.Default.Response)
```

### Build Commands

```powershell
# Development build (quick iteration)
dotnet build

# Release build with NativeAOT (optimized for production)
dotnet publish -c Release -r win-x64

# Output location
bin\Release\net9.0\win-x64\publish\LibreMonCLI.exe

# Expected binary size: 5-8MB (NativeAOT)
# Expected memory: 10-15MB resident
# Expected startup: 100-200ms
```

### Build Automation Script

Create `scripts/build-cli.ps1`:

```powershell
# Build LibreHardwareMonitor from submodule
Write-Host "Building LibreHardwareMonitor..." -ForegroundColor Cyan
dotnet build deps/LibreHardwareMonitor-src/LibreHardwareMonitorLib/LibreHardwareMonitorLib.csproj -c Release

# Copy DLLs to deps folder
Write-Host "Copying LibreHardwareMonitor DLLs..." -ForegroundColor Cyan
Copy-Item `
    "deps/LibreHardwareMonitor-src/bin/Release/net*/*" `
    "deps/LibreHardwareMonitor/" `
    -Force

# Build CLI with NativeAOT
Write-Host "Building LibreMonCLI with NativeAOT..." -ForegroundColor Cyan
dotnet publish managed/LibreMonCLI/LibreMonCLI.csproj `
    -c Release `
    -r win-x64 `
    -o dist/

Write-Host "Build complete! Binary: dist/LibreMonCLI.exe" -ForegroundColor Green
Write-Host "Size: $((Get-Item dist/LibreMonCLI.exe).Length / 1MB) MB" -ForegroundColor Green
```

---

## Node.js Integration

### Wrapper Module (lib/index.js)

```javascript
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const readline = require('readline');

class LibreMonClient extends EventEmitter {
  constructor(exePath = '../dist/LibreMonCLI.exe') {
    super();
    this.exePath = exePath;
    this.process = null;
    this.rl = null;
    this.isInitialized = false;
  }

  /**
   * Start daemon process
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.exePath, ['--daemon'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Set up readline for newline-delimited JSON
      this.rl = readline.createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      });

      // Handle stdout responses
      this.rl.on('line', (line) => {
        try {
          const response = JSON.parse(line);
          this.emit('response', response);
        } catch (err) {
          this.emit('error', new Error(`Invalid JSON: ${line}`));
        }
      });

      // Handle stderr (debug/errors)
      this.process.stderr.on('data', (data) => {
        console.error(`[LibreMon stderr]: ${data}`);
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        this.emit('exit', code);
        this.isInitialized = false;
      });

      // Handle spawn errors
      this.process.on('error', (err) => {
        reject(err);
      });

      // Daemon started successfully
      resolve();
    });
  }

  /**
   * Send command and wait for response
   */
  async sendCommand(cmd) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 5000);

      const handler = (response) => {
        clearTimeout(timeout);
        this.removeListener('response', handler);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      };

      this.on('response', handler);
      
      // Write newline-delimited JSON to stdin
      this.process.stdin.write(JSON.stringify(cmd) + '\n');
    });
  }

  /**
   * Initialize hardware monitoring
   */
  async init(options = {}) {
    const {
      cpu = false,
      gpu = false,
      memory = false,
      motherboard = false,
      storage = false,
      network = false,
      psu = false,
      controller = false,
      battery = false,
      flat = false
    } = options;

    const flags = [];
    if (cpu) flags.push('cpu');
    if (gpu) flags.push('gpu');
    if (memory) flags.push('memory');
    if (motherboard) flags.push('motherboard');
    if (storage) flags.push('storage');
    if (network) flags.push('network');
    if (psu) flags.push('psu');
    if (controller) flags.push('controller');
    if (battery) flags.push('battery');

    const response = await this.sendCommand({ cmd: 'init', flags, flat });
    this.isInitialized = true;
    return response;
  }

  /**
   * Poll sensor data
   */
  async poll() {
    if (!this.isInitialized) {
      throw new Error('Not initialized. Call init() first.');
    }
    return await this.sendCommand({ cmd: 'poll' });
  }

  /**
   * Shutdown daemon
   */
  async shutdown() {
    const response = await this.sendCommand({ cmd: 'shutdown' });
    this.process.stdin.end();
    return response;
  }
}

module.exports = { LibreMonClient };
```

### Usage Example

```javascript
const { LibreMonClient } = require('./lib');

async function main() {
  const client = new LibreMonClient();

  try {
    // Start daemon
    await client.start();
    console.log('Daemon started');

    // Initialize hardware monitoring
    await client.init({
      cpu: true,
      gpu: true,
      memory: true,
      flat: true  // Use flat output mode
    });
    console.log('Hardware initialized');

    // Poll every 1 second
    const interval = setInterval(async () => {
      try {
        const data = await client.poll();
        console.log('CPU Temp:', data.data.cpu[0]?.temperatures?.['core-tctl-tdie']?.data?.value);
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 1000);

    // Cleanup on exit
    process.on('SIGINT', async () => {
      clearInterval(interval);
      await client.shutdown();
      console.log('Shutdown complete');
      process.exit(0);
    });
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
```

---

## Testing Strategy

### Unit Tests (C#)

1. **Command Parsing**
   - Test all flag combinations
   - Test invalid JSON commands
   - Test missing required fields

2. **Initialization**
   - Test single sensor type
   - Test multiple sensor types
   - Test double initialization error

3. **Polling**
   - Test before initialization (should error)
   - Test after initialization (both raw and flat modes)
   - Test data structure format

4. **Shutdown**
   - Test cleanup
   - Test shutdown before init (should succeed gracefully)

### Integration Tests (Node.js)

1. **Daemon Lifecycle**
   ```javascript
   // Test full init → poll → shutdown flow
   const client = new LibreMonClient();
   await client.start();
   await client.init({ cpu: true, gpu: true });
   const data = await client.poll();
   await client.shutdown();
   ```

2. **Error Scenarios**
   ```javascript
   // Poll before init
   await client.start();
   await client.poll();  // Should reject with error
   
   // Double init
   await client.init({ cpu: true });
   await client.init({ gpu: true });  // Should reject with error
   ```

3. **JSON Protocol Validation**
   - Verify all responses are valid newline-delimited JSON
   - Verify structure matches specification
   - Verify stdout/stderr separation

4. **High-Frequency Polling**
   ```javascript
   // Stress test: poll every 500ms for 5 minutes
   // Monitor memory usage, CPU usage, response times
   ```

### Integration Tests

1. **Full Command Flow**
   ```bash
   libremon-cli.exe init --cpu --gpu
   libremon-cli.exe poll
   libremon-cli.exe shutdown
   ```

2. **Error Scenarios**
   ```bash
   # Poll before init
   libremon-cli.exe poll  # Should error
   
   # Double init
   libremon-cli.exe init --cpu
   libremon-cli.exe init --gpu  # Should error
   ```

3. **JSON Validation**
   - Verify all outputs are valid JSON
   - Verify structure matches specification
   - Verify stdout/stderr separation

### Performance Tests

1. **Daemon Startup Time**
   - Measure daemon spawn time (target: < 200ms)

2. **Poll Speed**
   - Measure poll command latency (target: < 5ms)
   - Test with all sensors enabled
   - Compare raw vs flat mode performance

3. **Memory Usage**
   - Monitor process memory during operation (target: < 15MB)
   - Check for leaks across 10,000+ poll cycles
   - Test with high-frequency polling (500ms intervals)

4. **CPU Usage**
   - Idle CPU usage (target: < 0.5%)
   - Active polling CPU usage (target: < 2%)

---

## Error Handling

### Error Categories

1. **Protocol Errors**
   - Invalid JSON input
   - Missing required fields
   - Unknown command

2. **Initialization Errors**
   - Already initialized
   - Access denied (requires admin privileges)
   - Invalid sensor flags
   - LibreHardwareMonitor initialization failure

3. **Poll Errors**
   - Not initialized
   - Hardware access failure
   - Sensor read timeout

4. **Shutdown Errors**
   - Cleanup failure (log to stderr, still exit gracefully)

### Error Response Format

All errors output to stdout as JSON (newline-delimited):

```json
{
  "success": false,
  "error": "Not initialized. Send 'init' command first.",
  "errorCode": "NOT_INITIALIZED"
}
```

**Error codes**:
- `INVALID_JSON` - Malformed JSON in stdin
- `UNKNOWN_COMMAND` - Command not recognized
- `ALREADY_INITIALIZED` - Init called twice
- `NOT_INITIALIZED` - Poll/shutdown before init
- `ACCESS_DENIED` - Requires administrator privileges
- `HARDWARE_ERROR` - LibreHardwareMonitor error
- `INTERNAL_ERROR` - Unexpected exception

Detailed stack traces and debug info go to stderr:

```
[ERROR] Not initialized
Stack trace:
  at HardwareMonitor.CollectData()
  at CommandHandler.HandlePoll()
  ...
```

---

## Deployment

### Distribution Structure

```
dist/
└── LibreMonCLI.exe  (NativeAOT, 5-8MB)

# Copy to Electron app
Electron_LibreMon/
└── bin/
    └── libremon-native/
        └── LibreMonCLI.exe
```

### Version Management

Add `--version` command support:

**Input (stdin)**:
```json
{"cmd":"version"}
```

**Output (stdout)**:
```json
{
  "success": true,
  "version": "1.0.0",
  "librehardwaremonitor": "0.9.3",
  "platform": "win-x64"
}
```

---

## Success Criteria

**Architecture & Protocol**:
- ✅ Persistent daemon mode with stdin/stdout JSON-RPC protocol
- ✅ Newline-delimited JSON communication (robust parsing)
- ✅ Graceful shutdown on `shutdown` command
- ✅ Error handling for invalid JSON and unknown commands

**Data Output**:
- ✅ Raw mode JSON output matches LibreHardwareMonitor web service `/data.json` exactly
- ✅ Flat mode JSON output matches reference flatten implementation
- ✅ Sensor type ordering matches web endpoint (`.OrderBy((int)g.Key)`)
- ✅ `SensorType.SmallData` → "Data" group name (not "SmallData")

**Performance**:
- ✅ Daemon startup time < 200ms
- ✅ Poll latency < 5ms (no process spawn overhead)
- ✅ Binary size < 8MB (NativeAOT compilation)
- ✅ Memory footprint < 15MB resident
- ✅ CPU usage < 0.5% idle, < 2% during poll
- ✅ No memory leaks over 10,000+ poll cycles
- ✅ Supports high-frequency polling (500ms-1s intervals)

**Functionality**:
- ✅ All hardware types supported (CPU, GPU, memory, etc.)
- ✅ Both raw and flat output modes work correctly
- ✅ Hardware filtering works (init with specific flags)
- ✅ Node.js wrapper provides clean async/await API

**Reliability**:
- ✅ Proper error responses with error codes
- ✅ Admin privilege check (LibreHardwareMonitor requirement)
- ✅ Crash isolation (daemon restart doesn't affect Node.js)
- ✅ Compatible with existing Electron app architecture

---

## Migration from Edge.js (Archive Reference)

### What to Remove
- All Edge.js bindings and attributes
- `[EdgeMethod]` attributes  
- Async/await patterns for Edge callbacks
- Node.js-specific data marshaling
- N-API native addon code

### What to Keep
- LibreHardwareMonitor integration patterns
- Sensor data collection logic (adapt from HardwareMonitorBridge.cs)
- Hardware type enumeration
- Data structure formatting (raw mode)
- Flatten logic (reference from `archive/napi-approach/reference/libre_hardware_flatten.js`)

### What to Add
- Daemon mode with stdin/stdout loop
- JSON-RPC command protocol
- Newline-delimited JSON parsing
- Response formatting with timestamps
- JSON source generators (NativeAOT compatibility)
- Node.js client wrapper (EventEmitter-based)

---

## Future Enhancements

### Phase 2 (Post-MVP)
- **Sensor filtering**: `{"cmd":"poll","filter":["CPU Total","GPU Core"]}` to return specific sensors
- **Batch commands**: Array of commands in single stdin line
- **Heartbeat**: Periodic keepalive to detect daemon crashes
- **Streaming mode**: Continuous polling at specified interval (replaces Node.js setInterval)

### Phase 3 (Advanced)
- **Configuration profiles**: Save/load hardware configurations
- **Performance metrics**: Report poll timing, sensor count, memory usage
- **Verbose logging**: `--verbose` flag for debug output to stderr
- **Sensor aliases**: User-friendly names for sensors in config file

### Phase 3 (Optional)
- **Performance metrics**: Report poll timing and hardware count
- **Verbose logging**: `--verbose` flag for debug output
- **Sensor aliases**: User-friendly names for sensors

---

## References

- LibreHardwareMonitor: https://github.com/LibreHardwareMonitor/LibreHardwareMonitor
- .NET 9.0 Documentation: https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-9/overview
- System.Text.Json: https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/overview
- Electron Integration Plan: `NATIVE_POLLING_PLAN.md` in Electron_LibreMon repo
