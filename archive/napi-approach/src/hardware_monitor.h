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
    
    // Function pointers to managed bridge functions
    typedef int (*LHM_InitializeFn)(bool cpu, bool gpu, bool motherboard, bool memory,
                                     bool storage, bool network, bool psu, bool controller, bool battery);
    typedef void* (*LHM_PollFn)();
    typedef void (*LHM_FreeStringFn)(void* ptr);
    typedef void (*LHM_ShutdownFn)();
    
    LHM_InitializeFn m_initializeFn;
    LHM_PollFn m_pollFn;
    LHM_FreeStringFn m_freeStringFn;
    LHM_ShutdownFn m_shutdownFn;
};
