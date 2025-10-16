namespace LibreMonCLI.Models;

/// <summary>
/// Raw data structure matching LibreHardwareMonitor web endpoint /data.json
/// </summary>
public class RawData
{
    public RawNode[] Children { get; set; } = Array.Empty<RawNode>();
}

/// <summary>
/// Node in hierarchical raw structure
/// </summary>
public class RawNode
{
    public string id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string? ImageURL { get; set; }
    public string? Value { get; set; }
    public string? Min { get; set; }
    public string? Max { get; set; }
    public string? SensorId { get; set; }
    public string? Type { get; set; }
    public List<RawNode>? Children { get; set; }
}

