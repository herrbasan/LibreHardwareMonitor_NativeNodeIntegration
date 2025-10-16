namespace LibreMonCLI.Models;

/// <summary>
/// Base response written to stdout
/// </summary>
public class Response
{
    public bool success { get; set; }
    public string? error { get; set; }
    public string? errorCode { get; set; }
}

/// <summary>
/// Init response
/// </summary>
public class InitResponse : Response
{
    public string[]? initialized { get; set; }
    public string? mode { get; set; }
}

/// <summary>
/// Poll response
/// </summary>
public class PollResponse : Response
{
    public long? timestamp { get; set; }
    public string? mode { get; set; }
    public object? data { get; set; }
}

/// <summary>
/// Shutdown response
/// </summary>
public class ShutdownResponse : Response
{
    public string? message { get; set; }
}

/// <summary>
/// Version response
/// </summary>
public class VersionResponse : Response
{
    public string? version { get; set; }
    public string? librehardwaremonitor { get; set; }
    public string? platform { get; set; }
}

/// <summary>
/// Error response
/// </summary>
public class ErrorResponse : Response
{
    public ErrorResponse(string errorMessage, string code)
    {
        success = false;
        error = errorMessage;
        errorCode = code;
    }
}

