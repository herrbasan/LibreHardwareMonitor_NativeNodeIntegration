using System;
using System.Net.NetworkInformation;
using System.Linq;

var interfaces = NetworkInterface.GetAllNetworkInterfaces();
Console.WriteLine($"Total interfaces: {interfaces.Length}\n");

// Only show adapters with IPv4 index (real adapters, not NDIS filters)
Console.WriteLine("=== Adapters with IPv4 Index (candidates for monitoring) ===\n");

foreach (var nic in interfaces)
{
    int? ipv4Index = null;
    try 
    {
        var props = nic.GetIPProperties();
        var ipv4 = props.GetIPv4Properties();
        ipv4Index = ipv4?.Index;
    }
    catch { }

    if (!ipv4Index.HasValue) continue;
    if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
    
    string status = nic.OperationalStatus.ToString();
    string type = nic.NetworkInterfaceType.ToString();
    
    Console.WriteLine($"Name: {nic.Name}");
    Console.WriteLine($"  Description: {nic.Description}");
    Console.WriteLine($"  Type: {type}");
    Console.WriteLine($"  Status: {status}");
    Console.WriteLine($"  IPv4 Index: {ipv4Index}");
    Console.WriteLine($"  Speed: {nic.Speed}");
    Console.WriteLine($"  Id: {nic.Id}");
    Console.WriteLine();
}
