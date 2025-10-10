using System.Text.Json;
using LibreMonCLI.Models;

namespace LibreMonCLI;

/// <summary>
/// Handle commands from stdin
/// </summary>
public static class CommandHandler
{
    /// <summary>
    /// Handle init command
    /// </summary>
    public static Response HandleInit(InitCommand cmd)
    {
        try
        {
            if (HardwareMonitor.IsInitialized)
            {
                return new ErrorResponse("Already initialized", "ALREADY_INITIALIZED");
            }
            
            // Parse flags
            var enabledSensors = new HashSet<string>(cmd.flags, StringComparer.OrdinalIgnoreCase);
            
            // Initialize hardware monitor
            HardwareMonitor.Initialize(enabledSensors, cmd.flat);
            
            return new InitResponse
            {
                success = true,
                initialized = cmd.flags,
                mode = cmd.flat ? "flat" : "raw"
            };
        }
        catch (UnauthorizedAccessException)
        {
            return new ErrorResponse(
                "Access denied. Administrator privileges required.", 
                "ACCESS_DENIED"
            );
        }
        catch (Exception ex)
        {
            return new ErrorResponse($"Initialization failed: {ex.Message}", "HARDWARE_ERROR");
        }
    }
    
    /// <summary>
    /// Handle poll command
    /// </summary>
    public static Response HandlePoll()
    {
        try
        {
            if (!HardwareMonitor.IsInitialized)
            {
                return new ErrorResponse(
                    "Not initialized. Send 'init' command first.", 
                    "NOT_INITIALIZED"
                );
            }
            
            // Collect sensor data
            var data = HardwareMonitor.CollectData();
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            
            return new PollResponse
            {
                success = true,
                timestamp = timestamp,
                mode = HardwareMonitor.UseFlatMode ? "flat" : "raw",
                data = data
            };
        }
        catch (Exception ex)
        {
            return new ErrorResponse($"Poll failed: {ex.Message}", "HARDWARE_ERROR");
        }
    }
    
    /// <summary>
    /// Handle shutdown command
    /// </summary>
    public static Response HandleShutdown()
    {
        try
        {
            HardwareMonitor.Shutdown();
            
            return new ShutdownResponse
            {
                success = true,
                message = HardwareMonitor.IsInitialized 
                    ? "Hardware monitoring closed, daemon exiting" 
                    : "Not initialized, daemon exiting"
            };
        }
        catch (Exception ex)
        {
            // Still return success - we're shutting down anyway
            return new ShutdownResponse
            {
                success = true,
                message = $"Shutdown with errors: {ex.Message}"
            };
        }
    }
    
    /// <summary>
    /// Handle version command
    /// </summary>
    public static Response HandleVersion()
    {
        return new VersionResponse
        {
            success = true,
            version = "1.0.0",
            librehardwaremonitor = "0.9.3",
            platform = "win-x64"
        };
    }
}
