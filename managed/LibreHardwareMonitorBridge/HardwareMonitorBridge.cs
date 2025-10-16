using System;
using System.Text.Json;
using System.Runtime.InteropServices;
using LibreHardwareMonitor.Hardware;

namespace LibreHardwareMonitorNative
{
    /// <summary>
    /// Native interop wrapper for LibreHardwareMonitor
    /// Provides C-style exports for calling from native code
    /// </summary>
    public class HardwareMonitorBridge
    {
        private Computer? _computer;
        
        // Delegate types for native interop - MUST use Cdecl calling convention to match C++
        // Use I1 (1-byte bool) to match C++ bool size
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        public delegate int InitializeDelegate(
            [MarshalAs(UnmanagedType.I1)] bool cpu,
            [MarshalAs(UnmanagedType.I1)] bool gpu,
            [MarshalAs(UnmanagedType.I1)] bool motherboard,
            [MarshalAs(UnmanagedType.I1)] bool memory,
            [MarshalAs(UnmanagedType.I1)] bool storage,
            [MarshalAs(UnmanagedType.I1)] bool network,
            [MarshalAs(UnmanagedType.I1)] bool psu,
            [MarshalAs(UnmanagedType.I1)] bool controller,
            [MarshalAs(UnmanagedType.I1)] bool battery);
        
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        public delegate IntPtr PollDelegate();
        
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        public delegate void FreeStringDelegate(IntPtr ptr);
        
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        public delegate void ShutdownDelegate();
        
        /// <summary>
        /// Initialize the hardware monitor with specified configuration
        /// </summary>
        public static int Initialize(
            bool cpu,
            bool gpu,
            bool motherboard,
            bool memory,
            bool storage,
            bool network,
            bool psu,
            bool controller,
            bool battery)
        {
            try
            {
                var instance = Instance;
                
                // Debug: Log the config being passed
                Console.WriteLine("=== LibreHardwareMonitor Initialization ===");
                Console.WriteLine($"CPU: {cpu}, GPU: {gpu}, Motherboard: {motherboard}");
                Console.WriteLine($"Memory: {memory}, Storage: {storage}, Network: {network}");
                Console.WriteLine($"PSU: {psu}, Controller: {controller}, Battery: {battery}");
                
                instance._computer = new Computer
                {
                    IsCpuEnabled = cpu,
                    IsGpuEnabled = gpu,
                    IsMotherboardEnabled = motherboard,
                    IsMemoryEnabled = memory,
                    IsStorageEnabled = storage,
                    IsNetworkEnabled = network,
                    IsPsuEnabled = psu,
                    IsControllerEnabled = controller,
                    IsBatteryEnabled = battery
                };
                
                Console.WriteLine($"DEBUG: Opening computer with storage enabled: {instance._computer.IsStorageEnabled}");
                instance._computer.Open();
                
                // Debug: Log detected hardware
                Console.WriteLine($"Hardware detection complete. Found {instance._computer.Hardware.Count()} hardware items:");
                foreach (var hw in instance._computer.Hardware)
                {
                    Console.WriteLine($"  - {hw.HardwareType}: {hw.Name} ({hw.SubHardware.Count()} sub-hardware)");
                    if (hw.HardwareType == LibreHardwareMonitor.Hardware.HardwareType.Storage)
                    {
                        Console.WriteLine($"DEBUG: STORAGE HARDWARE FOUND: {hw.Name}");
                    }
                }
                
                return 0; // Success
            }
            catch (Exception ex)
            {
                Console.WriteLine($"LHM_Initialize failed: {ex.Message}");
                return -1; // Error
            }
        }
        
        /// <summary>
        /// <summary>
        /// Poll sensors and return JSON data
        /// </summary>
        public static IntPtr Poll()
        {
            try
            {
                var instance = Instance;
                
                if (instance._computer == null)
                {
                    return IntPtr.Zero;
                }
                
                // Update all hardware sensors (recursively)
                foreach (var hardware in instance._computer.Hardware)
                {
                    UpdateHardwareRecursive(hardware);
                }
                
                // Build JSON structure matching web endpoint format
                var root = BuildHardwareTree(instance._computer.Hardware);
                var json = JsonSerializer.Serialize(root, new JsonSerializerOptions
                {
                    WriteIndented = false
                });
                
                // Allocate unmanaged memory for the JSON string
                return Marshal.StringToCoTaskMemUTF8(json);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"LHM_Poll failed: {ex.Message}");
                return IntPtr.Zero;
            }
        }
        
        /// <summary>
        /// Free memory allocated for JSON string
        /// </summary>
        public static void FreeString(IntPtr ptr)
        {
            if (ptr != IntPtr.Zero)
            {
                Marshal.FreeCoTaskMem(ptr);
            }
        }
        
        /// <summary>
        /// Shutdown and cleanup
        /// </summary>
        public static void Shutdown()
        {
            try
            {
                var instance = Instance;
                
                if (instance._computer != null)
                {
                    instance._computer.Close();
                    instance._computer = null;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"LHM_Shutdown failed: {ex.Message}");
            }
        }
        
        // Singleton instance
        private static HardwareMonitorBridge? _instance;
        private static HardwareMonitorBridge Instance => _instance ??= new HardwareMonitorBridge();
        
        // Helper method to recursively update hardware and sub-hardware
        private static void UpdateHardwareRecursive(IHardware hardware)
        {
            hardware.Update();
            foreach (var subHardware in hardware.SubHardware)
            {
                UpdateHardwareRecursive(subHardware);
            }
        }
        
        // Helper method to build hardware tree
        private static object BuildHardwareTree(IEnumerable<IHardware> hardware)
        {
            // Get computer name from environment
            string computerName = Environment.MachineName;
            
            return new
            {
                id = 0,
                Text = "Sensor",
                Min = "Min",      // Header labels for web endpoint compatibility
                Value = "Value",
                Max = "Max",
                ImageURL = "",
                Children = new[]
                {
                    new
                    {
                        id = 1,
                        Text = computerName,
                        Min = "",
                        Value = "",
                        Max = "",
                        ImageURL = "images_icon/computer.png",
                        Children = BuildHardwareNodes(hardware, startId: 2)
                    }
                }
            };
        }
        
        private static List<object> BuildHardwareNodes(IEnumerable<IHardware> hardwareList, int startId = 1)
        {
            var nodes = new List<object>();
            int id = startId;
            
            foreach (var hardware in hardwareList)
            {
                var hwNode = new
                {
                    id = id++,
                    Text = hardware.Name,
                    Children = BuildSensorNodes(hardware.Sensors, ref id)
                        .Concat(BuildHardwareNodes(hardware.SubHardware))
                        .ToList(),
                    Min = "",
                    Value = "",
                    Max = "",
                    HardwareId = hardware.Identifier.ToString(),  // Add HardwareId
                    ImageURL = GetHardwareImageUrl(hardware.HardwareType)
                };
                
                nodes.Add(hwNode);
            }
            
            return nodes;
        }
        
        private static List<object> BuildSensorNodes(IEnumerable<ISensor> sensors, ref int id)
        {
            var nodes = new List<object>();
            
            // Group sensors by type and sort by the enum order (matches web endpoint ordering)
            var grouped = sensors
                .GroupBy(s => s.SensorType)
                .OrderBy(g => (int)g.Key);  // Sort by enum value to match web endpoint
            
            foreach (var group in grouped)
            {
                var groupId = id++;
                var sensorChildren = new List<object>();
                
                foreach (var sensor in group)
                {
                    sensorChildren.Add(new
                    {
                        id = id++,
                        Text = sensor.Name,
                        Children = new List<object>(),
                        Min = FormatSensorValue(sensor.Min, sensor.SensorType),
                        Value = FormatSensorValue(sensor.Value, sensor.SensorType),
                        Max = FormatSensorValue(sensor.Max, sensor.SensorType),
                        SensorId = sensor.Identifier.ToString(),  // Add SensorId
                        Type = sensor.SensorType.ToString(),       // Add Type
                        ImageURL = ""
                    });
                }
                
                var groupNode = new
                {
                    id = groupId,
                    Text = GetSensorTypeName(group.Key),
                    Children = sensorChildren,
                    Min = "",
                    Value = "",
                    Max = "",
                    ImageURL = ""
                };
                
                nodes.Add(groupNode);
            }
            
            return nodes;
        }
        
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
                SensorType.SmallData => "Data",  // Match web endpoint - SmallData is displayed as "Data"
                SensorType.Factor => "Factors",
                SensorType.Frequency => "Frequencies",
                SensorType.Throughput => "Throughput",
                _ => type.ToString()
            };
        }
        
        private static string FormatSensorValue(float? value, SensorType type)
        {
            if (value == null)
                return "";
                
            return type switch
            {
                SensorType.Voltage => $"{value:F3} V",
                SensorType.Current => $"{value:F3} A",
                SensorType.Clock => $"{value:F1} MHz",
                SensorType.Temperature => $"{value:F1} °C",
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
                SensorType.Conductivity => $"{value:F1} µS/cm",
                SensorType.Humidity => $"{value:F0} %",
                _ => value.ToString() ?? ""
            };
        }
        
        private static string FormatThroughput(float bytesPerSecond)
        {
            // Format throughput exactly as LibreHardwareMonitor's SensorNode.ValueToString() does
            // Value is in bytes/second, format as KB/s or MB/s based on magnitude
            const int _1MB = 1048576; // 1 MB in bytes
            
            if (bytesPerSecond < _1MB)
                return $"{bytesPerSecond / 1024:F1} KB/s";
            else
                return $"{bytesPerSecond / _1MB:F1} MB/s";
        }
        
        private static string FormatTimeSpan(float seconds)
        {
            // Format as TimeSpan with general short format (matches {0:g})
            var timeSpan = TimeSpan.FromSeconds(seconds);
            return timeSpan.ToString("g");
        }
    }
}
