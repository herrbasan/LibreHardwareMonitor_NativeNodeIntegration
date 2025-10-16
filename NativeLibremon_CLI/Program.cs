using System.Text.Json;
using LibreMonCLI;
using LibreMonCLI.Models;

class Program
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

            // Check for version flag
            if (args.Length > 0 && (args[0] == "--version" || args[0] == "-v"))
            {
                var versionResponse = CommandHandler.HandleVersion();
                var json = JsonSerializer.Serialize(versionResponse, JsonContext.Default.VersionResponse);
                await Console.Out.WriteLineAsync(json);
                return 0;
            }

            // No arguments - run demo mode (single poll with all hardware)
            if (args.Length == 0)
            {
                return await RunDemoMode();
            }

            // Invalid arguments
            await Console.Error.WriteLineAsync("LibreMonCLI - LibreHardwareMonitor Persistent Daemon");
            await Console.Error.WriteLineAsync("Usage: LibreMonCLI.exe                    # Demo mode - single poll all hardware");
            await Console.Error.WriteLineAsync("       LibreMonCLI.exe --daemon          # Start persistent daemon");
            await Console.Error.WriteLineAsync("       LibreMonCLI.exe --version         # Show version info");
            return 1;
        }
        catch (Exception ex)
        {
            await Console.Error.WriteLineAsync($"Fatal error: {ex.Message}");
            await Console.Error.WriteLineAsync(ex.StackTrace);
            return 1;
        }
    }

    /// <summary>
    /// Run daemon mode: read newline-delimited JSON from stdin, write responses to stdout
    /// </summary>
    static async Task<int> RunDaemonMode()
    {
        bool shouldExit = false;

        // Daemon loop: read commands from stdin until shutdown
        while (!shouldExit)
        {
            try
            {
                // Read one line from stdin (blocking)
                var line = await Console.In.ReadLineAsync();

                // EOF or null means stdin closed
                if (line == null)
                    break;

                // Skip empty lines
                if (string.IsNullOrWhiteSpace(line))
                    continue;

                // Parse JSON command
                Command? command;
                try
                {
                    command = JsonSerializer.Deserialize(line, JsonContext.Default.Command);
                }
                catch (JsonException ex)
                {
                    // Invalid JSON input
                    var error = new ErrorResponse($"Invalid JSON: {ex.Message}", "INVALID_JSON");
                    await WriteResponse(error);
                    continue;
                }

                if (command == null || string.IsNullOrEmpty(command.cmd))
                {
                    var error = new ErrorResponse("Missing 'cmd' field", "INVALID_COMMAND");
                    await WriteResponse(error);
                    continue;
                }

                // Route to appropriate handler
                Response response = command.cmd.ToLowerInvariant() switch
                {
                    "init" => HandleInitCommand(line),
                    "poll" => CommandHandler.HandlePoll(),
                    "shutdown" => CommandHandler.HandleShutdown(),
                    "version" => CommandHandler.HandleVersion(),
                    _ => new ErrorResponse($"Unknown command: {command.cmd}", "UNKNOWN_COMMAND")
                };

                // Write JSON response to stdout with newline
                await WriteResponse(response);

                // Exit daemon loop if shutdown command
                if (command.cmd.ToLowerInvariant() == "shutdown")
                    shouldExit = true;
            }
            catch (Exception ex)
            {
                // Unexpected error - log to stderr and send error response
                await Console.Error.WriteLineAsync($"Error: {ex.Message}");
                await Console.Error.WriteLineAsync(ex.StackTrace);

                var error = new ErrorResponse($"Internal error: {ex.Message}", "INTERNAL_ERROR");
                await WriteResponse(error);
            }
        }

        return 0; // Clean exit
    }

    /// <summary>
    /// Run demo mode: initialize all hardware, perform one poll, show results, wait for user input
    /// </summary>
    static async Task<int> RunDemoMode()
    {
        try
        {
            await Console.Out.WriteLineAsync("LibreMonCLI Demo Mode");
            await Console.Out.WriteLineAsync("====================");
            await Console.Out.WriteLineAsync("");

            // Initialize with all hardware categories
            await Console.Out.WriteAsync("Initializing hardware monitoring... ");
            var initCmd = new InitCommand
            {
                cmd = "init",
                flags = new[] { "cpu", "gpu", "motherboard", "memory", "storage", "network" },
                flat = false
            };

            var initResponse = CommandHandler.HandleInit(initCmd);
            if (!initResponse.success)
            {
                await Console.Out.WriteLineAsync("FAILED");
                await Console.Error.WriteLineAsync($"Error: {((ErrorResponse)initResponse).error}");
                return 1;
            }
            await Console.Out.WriteLineAsync("OK");

            // Perform one poll
            await Console.Out.WriteAsync("Collecting sensor data... ");
            var pollResponse = CommandHandler.HandlePoll();
            if (!pollResponse.success)
            {
                await Console.Out.WriteLineAsync("FAILED");
                await Console.Error.WriteLineAsync($"Error: {((ErrorResponse)pollResponse).error}");
                return 1;
            }
            await Console.Out.WriteLineAsync("OK");
            await Console.Out.WriteLineAsync("");

            // Output the results
            await Console.Out.WriteLineAsync("Sensor Data:");
            await Console.Out.WriteLineAsync("============");
            await WriteResponse(pollResponse);
            await Console.Out.WriteLineAsync("");

            // Shutdown
            CommandHandler.HandleShutdown();

            // Wait for user input before exiting
            await Console.Out.WriteLineAsync("");
            await Console.Out.WriteLineAsync("Press Enter to exit...");
            await Console.In.ReadLineAsync();

            return 0;
        }
        catch (Exception ex)
        {
            await Console.Error.WriteLineAsync($"Demo mode failed: {ex.Message}");
            await Console.Error.WriteLineAsync(ex.StackTrace);
            return 1;
        }
    }

    /// <summary>
    /// Handle init command (needs to deserialize with full InitCommand type)
    /// </summary>
    static Response HandleInitCommand(string json)
    {
        try
        {
            var initCmd = JsonSerializer.Deserialize(json, JsonContext.Default.InitCommand);
            if (initCmd == null)
            {
                return new ErrorResponse("Invalid init command", "INVALID_COMMAND");
            }
            return CommandHandler.HandleInit(initCmd);
        }
        catch (JsonException ex)
        {
            return new ErrorResponse($"Invalid init command: {ex.Message}", "INVALID_JSON");
        }
    }

    /// <summary>
    /// Write response to stdout as newline-delimited JSON
    /// </summary>
    static async Task WriteResponse(Response response)
    {
        string json;

        // Special handling for PollResponse - manually serialize data field
        if (response is PollResponse pollResp)
        {
            // Serialize the data object separately based on its actual type
            string dataJson = "null";
            if (pollResp.data != null)
            {
                if (pollResp.data is RawData rawData)
                    dataJson = JsonSerializer.Serialize(rawData, JsonContext.Default.RawData);
                else if (pollResp.data is FlatData flatData)
                    dataJson = JsonSerializer.Serialize(flatData, JsonContext.Default.FlatData);
                else
                    throw new InvalidOperationException($"Unexpected data type: {pollResp.data.GetType().Name}");
            }

            // Manually construct JSON with properly serialized data
            json = $"{{\"success\":{(pollResp.success ? "true" : "false")},\"timestamp\":{pollResp.timestamp},\"mode\":\"{pollResp.mode}\",\"data\":{dataJson}}}";
        }
        // Serialize with appropriate type info for source generator
        else if (response is InitResponse initResp)
            json = JsonSerializer.Serialize(initResp, JsonContext.Default.InitResponse);
        else if (response is ShutdownResponse shutdownResp)
            json = JsonSerializer.Serialize(shutdownResp, JsonContext.Default.ShutdownResponse);
        else if (response is VersionResponse versionResp)
            json = JsonSerializer.Serialize(versionResp, JsonContext.Default.VersionResponse);
        else if (response is ErrorResponse errorResp)
            json = JsonSerializer.Serialize(errorResp, JsonContext.Default.ErrorResponse);
        else
            json = JsonSerializer.Serialize(response, JsonContext.Default.Response);

        await Console.Out.WriteLineAsync(json);
        await Console.Out.FlushAsync();
    }
}
