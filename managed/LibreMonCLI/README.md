# LibreMonCLI - LibreHardwareMonitor Persistent Daemon

Standalone .NET persistent daemon that provides hardware sensor data via stdin/stdout JSON-RPC protocol.

## Features

- **Ultra-low latency**: 2-5ms poll time (no process spawn overhead)
- **Minimal footprint**: 5-8MB binary (NativeAOT), <15MB memory
- **High-frequency polling**: Optimized for 1-second intervals or faster
- **Two output modes**: Raw (web endpoint format) or Flat (transformed)
- **Reliable protocol**: Newline-delimited JSON communication
- **Process isolation**: Daemon crashes don't affect Node.js parent

## Quick Start

### Building

```powershell
# Build everything (LibreHardwareMonitor + CLI)
.\scripts\build-cli.ps1

# Clean build
.\scripts\build-cli.ps1 -Clean

# Skip LibreHardwareMonitor rebuild
.\scripts\build-cli.ps1 -SkipLHM
```

### Usage from Node.js

```javascript
const { LibreMonClient } = require('./lib');

const client = new LibreMonClient();

// Start daemon
await client.start();

// Initialize hardware monitoring
await client.init({
  cpu: true,
  gpu: true,
  memory: true,
  flat: true  // Use flat output mode
});

// Poll sensor data
const data = await client.poll();
console.log(data);

// Shutdown
await client.shutdown();
```

### Direct Usage

```powershell
# Start daemon (reads from stdin, writes to stdout)
.\dist\LibreMonCLI.exe --daemon

# Example commands (send to stdin):
{"cmd":"init","flags":["cpu","gpu"],"flat":false}
{"cmd":"poll"}
{"cmd":"shutdown"}
```

## JSON-RPC Protocol

### Commands

**init** - Initialize hardware monitoring
```json
{"cmd":"init","flags":["cpu","gpu","memory"],"flat":false}
```

Response:
```json
{"success":true,"initialized":["cpu","gpu","memory"],"mode":"raw"}
```

**poll** - Get sensor data
```json
{"cmd":"poll"}
```

Response (raw mode):
```json
{
  "success":true,
  "timestamp":1728567890123,
  "mode":"raw",
  "data":{"Children":[...]}
}
```

Response (flat mode):
```json
{
  "success":true,
  "timestamp":1728567890123,
  "mode":"flat",
  "data":{"cpu":[...],"gpu":[...]}
}
```

**shutdown** - Shutdown daemon
```json
{"cmd":"shutdown"}
```

Response:
```json
{"success":true,"message":"Hardware monitoring closed, daemon exiting"}
```

**version** - Get version info
```json
{"cmd":"version"}
```

Response:
```json
{
  "success":true,
  "version":"1.0.0",
  "librehardwaremonitor":"0.9.3",
  "platform":"win-x64"
}
```

### Error Responses

```json
{
  "success":false,
  "error":"Not initialized. Send 'init' command first.",
  "errorCode":"NOT_INITIALIZED"
}
```

Error codes:
- `INVALID_JSON` - Malformed JSON
- `UNKNOWN_COMMAND` - Command not recognized
- `ALREADY_INITIALIZED` - Init called twice
- `NOT_INITIALIZED` - Poll/shutdown before init
- `ACCESS_DENIED` - Requires administrator privileges
- `HARDWARE_ERROR` - LibreHardwareMonitor error
- `INTERNAL_ERROR` - Unexpected exception

## Output Modes

### Raw Mode (default)
Matches LibreHardwareMonitor web endpoint `/data.json` structure exactly. Hierarchical with `Children` arrays.

### Flat Mode (`flat: true`)
Transformed structure for easier consumption. Hardware grouped by type, sensors organized by slugified names.

Example:
```javascript
{
  "cpu": [{
    "name": "Intel Core i7-13700K",
    "id": "/intelcpu/0",
    "temperatures": {
      "cpu-core-1": {
        "name": "CPU Core #1",
        "SensorId": "/intelcpu/0/temperature/0",
        "data": { "value": 62.0, "type": "°C", "min": 45.0, "max": 75.0 }
      }
    }
  }]
}
```

## Hardware Types

Available flags for `init` command:
- `cpu` - CPU sensors
- `gpu` - GPU sensors
- `memory` - Memory sensors
- `motherboard` - Motherboard sensors
- `storage` - Storage/disk sensors
- `network` - Network adapter sensors
- `psu` - Power supply sensors
- `controller` - Controller sensors
- `battery` - Battery sensors

## Requirements

- Windows 10/11 x64
- .NET Runtime 9.0+ (or use NativeAOT binary)
- Administrator privileges (LibreHardwareMonitor requires driver loading)

## Performance

- Binary size: ~5-8MB (NativeAOT)
- Memory usage: ~10-15MB resident
- CPU usage: <0.5% idle, 1-2% during poll
- Poll latency: 2-5ms
- Startup time: ~100-200ms

## Examples

See `examples/daemon-polling.js` for a complete usage example with 1-second polling intervals.

## Architecture

```
Node.js App
    ↓ (spawn once)
LibreMonCLI.exe --daemon
    ↓ (stdin/stdout JSON-RPC)
    {"cmd":"init",...}\n → {"success":true}\n
    {"cmd":"poll"}\n → {"success":true,"data":{...}}\n
    ↓
LibreHardwareMonitor.dll
    ↓
Hardware (ring-0 drivers)
```

## License

See LICENSE file in repository root.
