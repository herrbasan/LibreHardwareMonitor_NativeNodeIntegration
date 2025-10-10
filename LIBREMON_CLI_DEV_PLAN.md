# LibreMon CLI - Implementation Plan

## Overview

Convert the LibreHardwareMonitor .NET module from Edge.js bindings to a standalone CLI application that outputs JSON to stdout. This enables lightweight integration with the Electron app via process spawning instead of renderer process overhead.

## Project Goals

- **Zero Electron dependencies** - Pure .NET console application
- **Simple interface** - Three commands: `init`, `poll`, `shutdown`
- **JSON output** - Structured data to stdout, errors to stderr
- **Fast startup** - < 500ms initialization time
- **Small binary** - Self-contained .NET 9.0 with trimming/AOT
- **Stateful operation** - Maintain hardware state between init and shutdown

## Architecture

### Command Structure

```bash
libremon-cli.exe init [flags]        # Initialize hardware monitoring
libremon-cli.exe poll                # Get current sensor data
libremon-cli.exe shutdown            # Clean up and exit
```

### Execution Flow

```
1. libremon-cli.exe init --cpu --gpu --memory
   ├─ Parse command arguments
   ├─ Initialize LibreHardwareMonitor.Computer with flags
   ├─ Open hardware monitoring
   ├─ Save state to singleton
   └─ Output: {"success": true}

2. libremon-cli.exe poll
   ├─ Check if initialized
   ├─ Collect sensor data from Computer
   ├─ Format as JSON structure
   └─ Output: {"success": true, "data": {...}}

3. libremon-cli.exe shutdown
   ├─ Close hardware monitoring
   ├─ Cleanup resources
   └─ Output: {"success": true}
```

## Command Specifications

### Output Modes

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
libremon-native/
├── libremon-cli.csproj          # Console app project file
├── Program.cs                    # Entry point, command routing
├── CommandHandler.cs             # Init/Poll/Shutdown logic
├── HardwareMonitor.cs            # LibreHardwareMonitor wrapper
├── JsonOutputFormatter.cs        # JSON serialization
├── DataFlattener.cs              # Flatten transformation (raw → flat mode)
└── Models/
    ├── CliResponse.cs            # Base response model
    ├── PollResponse.cs           # Poll data response
    ├── RawDataStructure.cs       # Raw mode data structures
    └── FlatDataStructure.cs      # Flat mode data structures
```

### Class Responsibilities

**`Program.cs`**
- Parse command-line arguments
- Route to appropriate command handler
- Catch unhandled exceptions
- Set exit codes

**`CommandHandler.cs`**
- `HandleInit(string[] flags)` - Initialize hardware with flags
- `HandlePoll()` - Collect and return sensor data
- `HandleShutdown()` - Clean up resources

**`HardwareMonitor.cs`**
- Singleton pattern for `Computer` instance
- Initialize hardware components based on flags
- Collect sensor data from hardware tree
- Maintain state between commands

**`JsonOutputFormatter.cs`**
- Serialize response objects to JSON
- Format raw sensor data structure (web service format)
- Handle error responses
- Write to stdout

**`DataFlattener.cs`**
- Transform raw hierarchical data to flat structure
- Slugify sensor names (e.g., "CPU Core #1" → "cpu-core-1")
- Parse Value strings (e.g., "62.0 °C" → `{value: 62.0, type: "°C"}`)
- Determine hardware type from ImageURL
- Reference implementation: `reference/libre_hardware_flatten.js` (local)

### Key Implementation Points

#### 1. Singleton Pattern for Computer

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

### Project File (.csproj)

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>true</PublishSingleFile>
    <PublishTrimmed>true</PublishTrimmed>
    <TrimMode>link</TrimMode>
    <EnableCompressionInSingleFile>true</EnableCompressionInSingleFile>
    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="LibreHardwareMonitorLib" Version="0.9.3" />
    <PackageReference Include="System.Text.Json" Version="9.0.0" />
  </ItemGroup>
</Project>
```

### Build Commands

```bash
# Development build
dotnet build

# Release build (single executable)
dotnet publish -c Release -r win-x64 --self-contained

# Output location
bin/Release/net9.0/win-x64/publish/libremon-cli.exe
```

---

## Testing Strategy

### Unit Tests

1. **Command Parsing**
   - Test all flag combinations
   - Test invalid flags
   - Test missing commands

2. **Initialization**
   - Test single sensor type
   - Test multiple sensor types
   - Test double initialization error

3. **Polling**
   - Test before initialization (should error)
   - Test after initialization
   - Test data structure format

4. **Shutdown**
   - Test cleanup
   - Test double shutdown (should be safe)

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

1. **Startup Time**
   - Measure init command execution time (target: < 500ms)

2. **Poll Speed**
   - Measure poll command execution time (target: < 50ms)
   - Test with all sensors enabled

3. **Memory Usage**
   - Monitor process memory during operation
   - Check for leaks across multiple poll cycles

---

## Error Handling

### Error Categories

1. **Initialization Errors**
   - Already initialized
   - Access denied (requires admin)
   - Invalid sensor flags

2. **Poll Errors**
   - Not initialized
   - Hardware access failure
   - Sensor read timeout

3. **Shutdown Errors**
   - Not initialized (non-fatal, return success)
   - Cleanup failure (log to stderr)

### Error Output Format

All errors output to stdout as JSON:

```json
{
  "success": false,
  "error": "Not initialized. Run 'init' command first.",
  "errorCode": "NOT_INITIALIZED"
}
```

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

### Output Structure

After building, copy to Electron app:

```
Electron_LibreMon/
└── bin/
    └── libremon-native/
        └── libremon-cli.exe  (self-contained, ~15-20MB)
```

### Version Management

- CLI version embedded in binary
- Version command: `libremon-cli.exe --version`
- Output: `{"version": "1.0.0", "librehardwaremonitor": "0.9.3"}`

---

## Success Criteria

- ✅ All three commands (init, poll, shutdown) work correctly
- ✅ Raw mode JSON output matches LibreHardwareMonitor web service `/data.json` exactly
- ✅ Flat mode JSON output matches reference flatten implementation
- ✅ Startup time < 500ms
- ✅ Poll time < 50ms (both raw and flat modes)
- ✅ Binary size < 25MB (with trimming)
- ✅ No memory leaks over 1000 poll cycles
- ✅ Proper error handling with exit codes
- ✅ Works with all sensor combinations
- ✅ `--flat` flag correctly toggles output mode
- ✅ Compatible with existing Electron app data structure (both modes)

---

## Migration from Edge.js

### What to Remove
- All Edge.js bindings and attributes
- `[EdgeMethod]` attributes
- Async/await patterns for Edge callbacks
- Node.js-specific data marshaling

### What to Keep
- LibreHardwareMonitor integration
- Sensor data collection logic
- Hardware type enumeration
- Data structure formatting

### What to Add
- Command-line argument parsing
- Console output (stdout/stderr)
- JSON serialization
- Exit code handling
- Singleton pattern for Computer instance

---

## Future Enhancements

### Phase 2 (Optional)
- **Persistent mode**: Keep process alive, accept commands via stdin
- **Filtering**: `poll --filter="CPU Total,GPU Core"` to return specific sensors
- **Watch mode**: `poll --watch 1000` to continuously output every 1000ms
- **Config file**: Support for config file instead of command flags

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
