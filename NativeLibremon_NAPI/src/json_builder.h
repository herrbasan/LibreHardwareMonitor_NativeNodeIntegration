#pragma once

#include <string>

// JSON Builder - converts LibreHardwareMonitor data to JSON
// Minimal placeholder used for building the native addon.
class JsonBuilder {
public:
    // Build JSON from LibreHardwareMonitor Computer instance
    static std::string BuildFromComputer(void* computerInstance);

private:
    // Helper methods for building JSON structure
    static std::string BuildHardwareNode(void* hardwareInstance);
    static std::string BuildSensorNode(void* sensorInstance);
};
