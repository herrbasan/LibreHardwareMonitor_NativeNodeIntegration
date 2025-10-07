#include "hardware_monitor.h"
#include <iostream>

HardwareMonitor::HardwareMonitor(CLRHost* clrHost)
    : m_clrHost(clrHost)
    , m_isInitialized(false)
    , m_createComputerFn(nullptr)
    , m_openComputerFn(nullptr)
    , m_closeComputerFn(nullptr)
    , m_pollSensorsFn(nullptr)
    , m_getJsonDataFn(nullptr)
{
}

HardwareMonitor::~HardwareMonitor() {
    Shutdown();
}

bool HardwareMonitor::Initialize(const HardwareConfig& config) {
    if (m_isInitialized) {
        return true; // Already initialized
    }
    
    if (!m_clrHost || !m_clrHost->IsInitialized()) {
        std::cerr << "CLR host not initialized" << std::endl;
        return false;
    }
    
    // Store configuration
    m_config = config;
    
    // TODO: Next phase - Load LibreHardwareMonitorLib.dll and get function pointers
    // For now, just mark as initialized for build testing
    
    std::cout << "Hardware Monitor initialized with config:" << std::endl;
    std::cout << "  CPU: " << (config.cpu ? "enabled" : "disabled") << std::endl;
    std::cout << "  GPU: " << (config.gpu ? "enabled" : "disabled") << std::endl;
    std::cout << "  Motherboard: " << (config.motherboard ? "enabled" : "disabled") << std::endl;
    std::cout << "  Memory: " << (config.memory ? "enabled" : "disabled") << std::endl;
    
    m_isInitialized = true;
    return true;
}

std::string HardwareMonitor::Poll() {
    if (!m_isInitialized) {
        throw std::runtime_error("Hardware monitor not initialized");
    }
    
    // TODO: Next phase - Call managed code to poll sensors
    // For now, return mock data matching the expected format
    
    return R"({
        "id": 0,
        "Text": "Sensor",
        "Children": [
            {
                "id": 1,
                "Text": "Mock CPU",
                "Children": [],
                "Min": "0.0 °C",
                "Value": "45.0 °C",
                "Max": "75.0 °C",
                "ImageURL": ""
            }
        ],
        "Min": "",
        "Value": "",
        "Max": "",
        "ImageURL": ""
    })";
}

void HardwareMonitor::Shutdown() {
    if (!m_isInitialized) {
        return;
    }
    
    // TODO: Next phase - Close Computer instance and release managed resources
    
    std::cout << "Hardware Monitor shutdown" << std::endl;
    
    m_isInitialized = false;
    m_createComputerFn = nullptr;
    m_openComputerFn = nullptr;
    m_closeComputerFn = nullptr;
    m_pollSensorsFn = nullptr;
    m_getJsonDataFn = nullptr;
}
