
# NativeLibremon_CLI

This folder contains the CLI persistent daemon variant of LibreMon (migrated from `managed/LibreMonCLI`).

Quick contents
- `Program.cs` — entry point, demo and daemon mode, JSON-RPC stdin/stdout handling
- `HardwareMonitor.cs` — wrapper around LibreHardwareMonitor.Computer, initialization and polling
- `CommandHandler.cs` — routes `init`, `poll`, `shutdown`, `version` commands
- `DataFlattener.cs` — optional transformation from raw -> flat output
- `JsonContext.cs` — System.Text.Json source-generator context
- `LibreMonCLI.csproj` — project file
- `Models/` — command/response and data model classes

Usage
- Demo mode (single poll, prints JSON):

```powershell
.\\dist\\NativeLibremon_CLI\\LibreMonCLI.exe
```

- Daemon mode (stdin/stdout JSON-RPC):

```powershell
.\\dist\\NativeLibremon_CLI\\LibreMonCLI.exe --daemon
# Send newline-delimited JSON commands to stdin, receive JSON responses on stdout
```

- Version:

```powershell
.\\dist\\NativeLibremon_CLI\\LibreMonCLI.exe --version
```

Protocol
- Commands are newline-delimited JSON objects sent to stdin. Example commands:
	- Init: {"cmd":"init","flags":["cpu","gpu"],"flat":false}
	- Poll: {"cmd":"poll"}
	- Shutdown: {"cmd":"shutdown"}

- Responses are newline-delimited JSON objects on stdout. `poll` returns a `data` field containing either the raw web-endpoint format or the flattened array depending on `flat`.

Supported init flags
- cpu, gpu, memory, motherboard, storage, network, psu, controller, battery

Performance note
- Disabling groups via the `flags` array prevents the daemon from enabling those hardware categories in the underlying `Computer` instance. Disabled groups are not updated/polled (reduces CPU and I/O). See `test/verify-groups.ps1` for an automated verification script.

Testing
- A helper PowerShell script `test/verify-groups.ps1` is included to programmatically verify that disabled groups are not polled. It runs the daemon, sends `init`/`poll`/`shutdown`, parses the `poll` JSON and asserts disabled groups are absent.

Rebuild
- To rebuild/publish a self-contained Windows exe:

```powershell
dotnet publish NativeLibremon_CLI\\LibreMonCLI.csproj -c Release -r win-x64 -o dist --self-contained true
```

Related notes
- The code maps SensorType.SmallData to the group name "Data" to match the LibreHardwareMonitor web endpoint.
- If you rely on a prebuilt LibreHardwareMonitor package in `deps/LibreHardwareMonitor`, ensure `NuGet.Config` points to it so the project restores the bundled nupkg.

Problems or diagnostics
- You may see System.Text.Json source-generator diagnostics in `JsonContext.cs` in some environments. These are warnings about metadata generation and do not block runtime; I can tidy them up on request.

Contact
- See top-level README for overall repo details and build scripts.

