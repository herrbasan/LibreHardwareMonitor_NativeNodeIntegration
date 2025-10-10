namespace LibreMonCLI.Models;

/// <summary>
/// Base command received via stdin
/// </summary>
public class Command
{
    public string cmd { get; set; } = string.Empty;
}

/// <summary>
/// Init command with hardware flags
/// </summary>
public class InitCommand : Command
{
    public string[] flags { get; set; } = Array.Empty<string>();
    public bool flat { get; set; } = false;
}

/// <summary>
/// Poll command (no additional fields)
/// </summary>
public class PollCommand : Command
{
}

/// <summary>
/// Shutdown command (no additional fields)
/// </summary>
public class ShutdownCommand : Command
{
}

/// <summary>
/// Version command (no additional fields)
/// </summary>
public class VersionCommand : Command
{
}
