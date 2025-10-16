using LibreHardwareMonitor.Hardware;
using LibreMonCLI.Models;

namespace LibreMonCLI;

/// <summary>
/// Singleton wrapper for LibreHardwareMonitor.Computer
/// Maintains hardware state for daemon lifetime
/// </summary>
public class HardwareMonitor
{
    private static Computer? _computer;
    private static bool _isInitialized = false;
    private static bool _useFlatMode = false;
    private static readonly object _lock = new();

    public static bool IsInitialized
    {
        get
        {
            lock (_lock)
            {
                return _isInitialized;
            }
        }
    }

    public static bool UseFlatMode
    {
        get
        {
            lock (_lock)
            {
                return _useFlatMode;
            }
        }
    }

    /// <summary>
    /// Initialize hardware monitoring with specified flags
    /// </summary>
    public static void Initialize(HashSet<string> enabledSensors, bool flatMode = false)
    {
        lock (_lock)
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

            Console.Error.WriteLine($"DEBUG: Opening computer with storage enabled: {_computer.IsStorageEnabled}");
            _computer.Open();

            // Debug: Check what hardware was actually added
            Console.Error.WriteLine($"DEBUG: Hardware count after Open: {_computer.Hardware.Count}");
            foreach (var hw in _computer.Hardware)
            {
                var sensorCount = hw.Sensors?.Count() ?? 0;
                Console.Error.WriteLine($"DEBUG: Hardware: {hw.Name} ({hw.HardwareType}) - Sensors: {sensorCount}");
                if (hw.HardwareType == LibreHardwareMonitor.Hardware.HardwareType.Storage)
                {
                    Console.Error.WriteLine($"DEBUG: STORAGE HARDWARE FOUND: {hw.Name}");
                }
            }

            _isInitialized = true;
        }
    }

    /// <summary>
    /// Collect sensor data (raw or flat based on initialization)
    /// </summary>
    public static object CollectData()
    {
        lock (_lock)
        {
            if (!_isInitialized || _computer == null)
                throw new InvalidOperationException("Not initialized");

            // Update all hardware sensors
            foreach (var hardware in _computer.Hardware)
            {
                UpdateHardwareRecursive(hardware);
            }

            // Collect raw hierarchical data (web service format)
            var rawData = CollectRawData();

            // Transform to flat mode if enabled
            return _useFlatMode 
                ? DataFlattener.Flatten(rawData) 
                : rawData;
        }
    }

    /// <summary>
    /// Shutdown and cleanup
    /// </summary>
    public static void Shutdown()
    {
        lock (_lock)
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

    /// <summary>
    /// Recursively update hardware and sub-hardware
    /// </summary>
    private static void UpdateHardwareRecursive(IHardware hardware)
    {
        // Log which hardware is being updated (helps verify disabled groups are not polled)
        try
        {
            Console.Error.WriteLine($"DEBUG: Updating hardware: {hardware.Name} ({hardware.HardwareType})");
        }
        catch
        {
            // Best-effort logging - swallow any logging errors to avoid affecting sensor polling
        }
        hardware.Update();
        foreach (var subHardware in hardware.SubHardware)
        {
            UpdateHardwareRecursive(subHardware);
        }
    }

    /// <summary>
    /// Collect raw data matching web endpoint structure
    /// </summary>
    private static RawData CollectRawData()
    {
        if (_computer == null)
            throw new InvalidOperationException("Computer not initialized");

        // Root structure matching web endpoint
        var root = new RawNode
        {
            id = "0",
            Text = "Sensor",
            ImageURL = "",
            Children = new List<RawNode>
            {
                new RawNode
                {
                    id = "1",
                    Text = Environment.MachineName,
                    ImageURL = "images_icon/computer.png",
                    Children = BuildHardwareNodes(_computer.Hardware)
                }
            }
        };

        return new RawData { Children = new[] { root } };
    }

    /// <summary>
    /// Build hardware nodes recursively
    /// </summary>
    private static List<RawNode> BuildHardwareNodes(IEnumerable<IHardware> hardwareList)
    {
        var nodes = new List<RawNode>();

        foreach (var hardware in hardwareList)
        {
            var hwNode = new RawNode
            {
                id = hardware.Identifier.ToString(),
                Text = hardware.Name,
                ImageURL = GetHardwareImageUrl(hardware.HardwareType),
                Children = new List<RawNode>()
            };

            // Add sensor groups
            var sensorGroups = BuildSensorGroups(hardware);
            hwNode.Children.AddRange(sensorGroups);

            // Add sub-hardware
            var subHardwareNodes = BuildHardwareNodes(hardware.SubHardware);
            hwNode.Children.AddRange(subHardwareNodes);

            nodes.Add(hwNode);
        }

        return nodes;
    }

    /// <summary>
    /// Build sensor group nodes
    /// </summary>
    private static List<RawNode> BuildSensorGroups(IHardware hardware)
    {
        var groups = new List<RawNode>();

        // Group sensors by type and order by enum value (CRITICAL: matches web endpoint)
        var grouped = hardware.Sensors
            .Where(s => s.Value.HasValue)
            .GroupBy(s => s.SensorType)
            .OrderBy(g => (int)g.Key);  // Sort by enum value to match web endpoint

        foreach (var group in grouped)
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
                    Value = FormatSensorValue(sensor.Value, sensor.SensorType),
                    Min = FormatSensorValue(sensor.Min, sensor.SensorType),
                    Max = FormatSensorValue(sensor.Max, sensor.SensorType),
                    SensorId = sensor.Identifier.ToString(),
                    Type = sensor.SensorType.ToString()
                };

                groupNode.Children.Add(sensorNode);
            }

            groups.Add(groupNode);
        }

        return groups;
    }

    /// <summary>
    /// Get hardware image URL (matches web endpoint)
    /// </summary>
    private static string GetHardwareImageUrl(HardwareType type)
    {
        return type switch
        {
            HardwareType.Motherboard => "images_icon/mainboard.png",
            HardwareType.SuperIO => "images_icon/chip.png",
            HardwareType.Cpu => "images_icon/cpu.png",
            HardwareType.GpuNvidia => "images_icon/nvidia.png",
            HardwareType.GpuAmd => "images_icon/ati.png",
            HardwareType.GpuIntel => "images_icon/intel.png",
            HardwareType.Storage => "images_icon/hdd.png",
            HardwareType.Memory => "images_icon/ram.png",
            HardwareType.Network => "images_icon/nic.png",
            HardwareType.Cooler => "images_icon/fan.png",
            HardwareType.EmbeddedController => "images_icon/chip.png",
            HardwareType.Psu => "images_icon/power.png",
            HardwareType.Battery => "images_icon/battery.png",
            _ => "images_icon/computer.png"
        };
    }

    /// <summary>
    /// Get sensor type name (matches web endpoint)
    /// CRITICAL: SensorType.SmallData maps to "Data" (not "SmallData")
    /// </summary>
    private static string GetSensorTypeName(SensorType type)
    {
        return type switch
        {
            SensorType.Voltage => "Voltages",
            SensorType.Clock => "Clocks",
            SensorType.Temperature => "Temperatures",
            SensorType.Load => "Load",
            SensorType.Fan => "Fans",
            SensorType.Flow => "Flow",
            SensorType.Control => "Controls",
            SensorType.Level => "Levels",
            SensorType.Power => "Powers",
            SensorType.Data => "Data",
            SensorType.SmallData => "Data",  // CRITICAL: Match web endpoint
            SensorType.Factor => "Factors",
            SensorType.Frequency => "Frequencies",
            SensorType.Throughput => "Throughput",
            _ => type.ToString()
        };
    }

    /// <summary>
    /// Format sensor value (matches web endpoint)
    /// </summary>
    private static string FormatSensorValue(float? value, SensorType type)
    {
        if (value == null)
            return "";

        return type switch
        {
            SensorType.Voltage => $"{value:F3} V",
            SensorType.Current => $"{value:F3} A",
            SensorType.Clock => $"{value:F1} MHz",
            SensorType.Temperature => $"{value:F1} \u00b0C",
            SensorType.Load => $"{value:F1} %",
            SensorType.Fan => $"{value:F0} RPM",
            SensorType.Flow => $"{value:F1} L/h",
            SensorType.Control => $"{value:F1} %",
            SensorType.Level => $"{value:F1} %",
            SensorType.Power => $"{value:F1} W",
            SensorType.Data => $"{value:F1} GB",
            SensorType.SmallData => $"{value:F1} MB",
            SensorType.Factor => $"{value:F3}",
            SensorType.Frequency => $"{value:F1} Hz",
            SensorType.Throughput => FormatThroughput(value.Value),
            SensorType.TimeSpan => FormatTimeSpan(value.Value),
            SensorType.Timing => $"{value:F3} ns",
            SensorType.Energy => $"{value:F0} mWh",
            SensorType.Noise => $"{value:F0} dBA",
            SensorType.Conductivity => $"{value:F1} \u00b5S/cm",
            SensorType.Humidity => $"{value:F0} %",
            _ => value.ToString() ?? ""
        };
    }

    private static string FormatThroughput(float bytesPerSecond)
    {
        const int _1MB = 1048576; // 1 MB in bytes

        if (bytesPerSecond < _1MB)
            return $"{bytesPerSecond / 1024:F1} KB/s";
        else
            return $"{bytesPerSecond / _1MB:F1} MB/s";
    }

    private static string FormatTimeSpan(float seconds)
    {
        var timeSpan = TimeSpan.FromSeconds(seconds);
        return timeSpan.ToString("g");
    }
}
