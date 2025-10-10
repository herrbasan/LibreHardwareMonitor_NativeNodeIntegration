#pragma once

#include <string>

/**
 * JSON Builder - converts LibreHardwareMonitor data to JSON
 * This will be implemented in the next phase when we integrate
 * with the actual managed LibreHardwareMonitor objects
 */
class JsonBuilder {
public:
    /**
     * Build JSON from LibreHardwareMonitor Computer instance
     * @returns JSON string matching web endpoint format
     */
    static std::string BuildFromComputer(void* computerInstance);
    
private:
    // Helper methods for building JSON structure
    static std::string BuildHardwareNode(void* hardwareInstance);
    static std::string BuildSensorNode(void* sensorInstance);
};
