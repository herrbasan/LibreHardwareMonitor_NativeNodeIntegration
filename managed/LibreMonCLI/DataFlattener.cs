using LibreMonCLI.Models;

namespace LibreMonCLI;

/// <summary>
/// Transform raw hierarchical data to flat structure
/// Reference: archive/napi-approach/reference/libre_hardware_flatten.js
/// </summary>
public static class DataFlattener
{
    /// <summary>
    /// Flatten raw data structure
    /// </summary>
    public static FlatData Flatten(RawData rawData)
    {
        var hardware = new Dictionary<string, List<FlatHardware>>();
        
        if (rawData?.Children == null || rawData.Children.Length == 0)
            return new FlatData { hardware = hardware };
        
        var computerNode = rawData.Children[0];
        if (computerNode.Children == null || computerNode.Children.Count == 0)
            return new FlatData { hardware = hardware };
        
        // Process each hardware device
        foreach (var hardwareNode in computerNode.Children)
        {
            if (hardwareNode.Children == null)
                continue;
            
            // Determine hardware type from ImageURL
            var hardwareType = GetHardwareType(hardwareNode.ImageURL);
            
            // Handle motherboard special case (may have nested children)
            var children = hardwareType == "mainboard" && hardwareNode.Children.Count > 0 && 
                          hardwareNode.Children[0].Children != null
                ? hardwareNode.Children[0].Children
                : hardwareNode.Children;
            
            if (!hardware.ContainsKey(hardwareType))
                hardware[hardwareType] = new List<FlatHardware>();
            
            var flatHardware = new FlatHardware
            {
                name = hardwareNode.Text,
                id = hardwareNode.id,
                SensorGroups = new Dictionary<string, FlatSensorGroup>()
            };
            
            // Process sensor groups
            foreach (var groupNode in children)
            {
                if (groupNode == null || groupNode.Children == null || string.IsNullOrEmpty(groupNode.Text))
                    continue;
                
                // null-forgiving operator: we've checked above
                var groupSlug = Slugify(groupNode.Text!);
                var flatGroup = new FlatSensorGroup
                {
                    name = groupNode.Text!,
                    id = groupNode.id ?? "",
                    Sensors = new Dictionary<string, FlatSensor>()
                };
                
                // Process individual sensors
                foreach (var sensorNode in groupNode.Children)
                {
                    var sensorSlug = Slugify(sensorNode.Text);
                    var parsedValue = ParseValue(sensorNode.Value ?? "");
                    
                    var flatSensor = new FlatSensor
                    {
                        name = sensorNode.Text,
                        SensorId = sensorNode.SensorId ?? "",
                        data = new SensorValue
                        {
                            value = parsedValue.value,
                            type = parsedValue.unit,
                            min = !string.IsNullOrEmpty(sensorNode.Min) 
                                ? ParseValue(sensorNode.Min).value 
                                : null,
                            max = !string.IsNullOrEmpty(sensorNode.Max) 
                                ? ParseValue(sensorNode.Max).value 
                                : null
                        }
                    };
                    
                    flatGroup.Sensors[sensorSlug] = flatSensor;
                }
                
                flatHardware.SensorGroups[groupSlug] = flatGroup;
            }
            
            hardware[hardwareType].Add(flatHardware);
        }
        
        return new FlatData { hardware = hardware };
    }
    
    /// <summary>
    /// Slugify text (matches JS implementation)
    /// </summary>
    private static string Slugify(string text)
    {
        if (string.IsNullOrEmpty(text))
            return "";
        
        return text.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("#", "")
            .Replace("(", "")
            .Replace(")", "")
            .Replace("/", "-")
            .Replace("\\", "-")
            .Replace("_", "-")
            .Replace("--", "-")
            .Trim('-');
    }
    
    /// <summary>
    /// Parse value string (e.g., "62.0 °C" → (62.0, "°C"))
    /// </summary>
    private static (double value, string unit) ParseValue(string valueString)
    {
        if (string.IsNullOrWhiteSpace(valueString))
            return (0, "");
        
        var parts = valueString.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
            return (0, "");
        
        var numberStr = parts[0].Replace(',', '.');
        if (!double.TryParse(numberStr, System.Globalization.NumberStyles.Float, 
            System.Globalization.CultureInfo.InvariantCulture, out var number))
        {
            return (0, "");
        }
        
        var unit = parts.Length > 1 ? parts[1] : "";
        return (number, unit);
    }
    
    /// <summary>
    /// Determine hardware type from ImageURL
    /// Examples: "images_icon/nvidia.png" → "gpu"
    ///           "images_icon/cpu.png" → "cpu"
    /// </summary>
    private static string GetHardwareType(string? imageUrl)
    {
        if (string.IsNullOrEmpty(imageUrl))
            return "unknown";
        
        // Extract filename without extension
        var parts = imageUrl.Split('/');
        if (parts.Length == 0)
            return "unknown";
        
        var filename = parts[^1];  // Last part
        var type = filename.Split('.')[0];  // Remove extension
        
        // Map GPU types
        return type switch
        {
            "nvidia" or "ati" or "intel" => "gpu",
            _ => Slugify(type)
        };
    }
}
