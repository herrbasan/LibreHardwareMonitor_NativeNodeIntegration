namespace LibreMonCLI.Models;

/// <summary>
/// Flat data structure (transformed from raw)
/// </summary>
public class FlatData
{
    public Dictionary<string, List<FlatHardware>> hardware { get; set; } = new();
}

/// <summary>
/// Hardware device in flat structure
/// </summary>
public class FlatHardware
{
    public string name { get; set; } = string.Empty;
    public string id { get; set; } = string.Empty;
    public Dictionary<string, FlatSensorGroup> SensorGroups { get; set; } = new();
}

/// <summary>
/// Sensor group (temperatures, load, etc.)
/// </summary>
public class FlatSensorGroup
{
    public string name { get; set; } = string.Empty;
    public string id { get; set; } = string.Empty;
    public Dictionary<string, FlatSensor> Sensors { get; set; } = new();
}

/// <summary>
/// Individual sensor
/// </summary>
public class FlatSensor
{
    public string name { get; set; } = string.Empty;
    public string SensorId { get; set; } = string.Empty;
    public SensorValue data { get; set; } = new();
}

/// <summary>
/// Sensor value data
/// </summary>
public class SensorValue
{
    public double value { get; set; }
    public string type { get; set; } = string.Empty;
    public double? min { get; set; }
    public double? max { get; set; }
}

