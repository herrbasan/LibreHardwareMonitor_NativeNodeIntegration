#pragma once

#include "clr_host.h"
#include <string>

/**
 * Hardware configuration flags
 * Matches LibreHardwareMonitor's Computer class properties
 */
struct HardwareConfig {
    bool cpu = false;
    bool gpu = false;
    bool motherboard = false;
    bool memory = false;
    bool storage = false;
    bool network = false;
    bool psu = false;
    bool controller = false;
    bool battery = false;
};

/**
 * Hardware Monitor - wraps LibreHardwareMonitor functionality
 * Manages the Computer instance and sensor polling
 */
class HardwareMonitor {
public:
    HardwareMonitor(CLRHost* clrHost);
    ~HardwareMonitor();
    
    /**
     * Initialize the hardware monitor with specified configuration
     * @param config - hardware types to enable
     * @returns true on success
     */
    bool Initialize(const HardwareConfig& config);
    
    /**
     * Poll all enabled sensors and return JSON data
     * @returns JSON string matching LibreHardwareMonitor web endpoint format
     */
    std::string Poll();
    
    /**
     * Shutdown hardware monitoring and release resources
     */
    void Shutdown();
    
    /**
     * Check if initialized
     */
    bool IsInitialized() const { return m_isInitialized; }

private:
    CLRHost* m_clrHost;
    bool m_isInitialized;
    HardwareConfig m_config;
    
    // Function pointers to managed code (will be populated in next phase)
    void* m_createComputerFn;
    void* m_openComputerFn;
    void* m_closeComputerFn;
    void* m_pollSensorsFn;
    void* m_getJsonDataFn;
};
