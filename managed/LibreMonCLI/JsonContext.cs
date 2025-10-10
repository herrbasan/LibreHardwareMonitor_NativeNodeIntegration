using System.Text.Json;
using System.Text.Json.Serialization;
using LibreMonCLI.Models;

namespace LibreMonCLI;

/// <summary>
/// JSON source generator context for NativeAOT compatibility
/// Provides reflection-free JSON serialization
/// </summary>
[JsonSerializable(typeof(Command))]
[JsonSerializable(typeof(InitCommand))]
[JsonSerializable(typeof(PollCommand))]
[JsonSerializable(typeof(ShutdownCommand))]
[JsonSerializable(typeof(VersionCommand))]
[JsonSerializable(typeof(Response))]
[JsonSerializable(typeof(InitResponse))]
[JsonSerializable(typeof(PollResponse))]
[JsonSerializable(typeof(ShutdownResponse))]
[JsonSerializable(typeof(VersionResponse))]
[JsonSerializable(typeof(ErrorResponse))]
[JsonSerializable(typeof(RawData))]
[JsonSerializable(typeof(RawNode))]
[JsonSerializable(typeof(FlatData))]
[JsonSerializable(typeof(FlatHardware))]
[JsonSerializable(typeof(FlatSensorGroup))]
[JsonSerializable(typeof(FlatSensor))]
[JsonSerializable(typeof(SensorValue))]
[JsonSerializable(typeof(Dictionary<string, List<FlatHardware>>))]
[JsonSerializable(typeof(Dictionary<string, FlatSensorGroup>))]
[JsonSerializable(typeof(Dictionary<string, FlatSensor>))]
[JsonSourceGenerationOptions(
    WriteIndented = false,
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
)]
internal partial class JsonContext : JsonSerializerContext
{
}
