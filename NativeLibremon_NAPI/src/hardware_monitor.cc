#include "hardware_monitor.h"
#include <iostream>

HardwareMonitor::HardwareMonitor(CLRHost* clrHost)
	: m_clrHost(clrHost)
	, m_isInitialized(false)
	, m_initializeFn(nullptr)
	, m_pollFn(nullptr)
	, m_freeStringFn(nullptr)
	, m_shutdownFn(nullptr)
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
    
	// Get the path to our .node addon
	HMODULE hModule = nullptr;
	if (!GetModuleHandleExW(
		GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
		(LPCWSTR)&g_module_marker,
		&hModule)) {
		std::cerr << "Failed to get module handle" << std::endl;
		return false;
	}
    
	wchar_t currentPath[MAX_PATH];
	GetModuleFileNameW(hModule, currentPath, MAX_PATH);
    
	// Remove filename to get directory
	wchar_t* lastSlash = wcsrchr(currentPath, L'\\');
	if (lastSlash) {
		*(lastSlash + 1) = L'\0';
	}
    
	// Build path to LibreHardwareMonitorBridge.dll
	wchar_t bridgeDllPath[MAX_PATH];
	wcscpy_s(bridgeDllPath, MAX_PATH, currentPath);
	wcscat_s(bridgeDllPath, MAX_PATH, L"LibreHardwareMonitorBridge.dll");
    
	std::wcout << L"Loading managed bridge: " << bridgeDllPath << std::endl;
    
	// Load function pointers from managed assembly
	const wchar_t* typeName = L"LibreHardwareMonitorNative.HardwareMonitorBridge, LibreHardwareMonitorBridge";
    
	if (!m_clrHost->LoadAssemblyAndGetFunctionPointer(
			bridgeDllPath,
			typeName,
			L"Initialize",
			L"LibreHardwareMonitorNative.HardwareMonitorBridge+InitializeDelegate, LibreHardwareMonitorBridge",
			nullptr,
			(void**)&m_initializeFn)) {
		std::cerr << "Failed to load LHM_Initialize function" << std::endl;
		return false;
	}
    
	if (!m_clrHost->LoadAssemblyAndGetFunctionPointer(
			bridgeDllPath,
			typeName,
			L"Poll",
			L"LibreHardwareMonitorNative.HardwareMonitorBridge+PollDelegate, LibreHardwareMonitorBridge",
			nullptr,
			(void**)&m_pollFn)) {
		std::cerr << "Failed to load LHM_Poll function" << std::endl;
		return false;
	}
    
	if (!m_clrHost->LoadAssemblyAndGetFunctionPointer(
			bridgeDllPath,
			typeName,
			L"FreeString",
			L"LibreHardwareMonitorNative.HardwareMonitorBridge+FreeStringDelegate, LibreHardwareMonitorBridge",
			nullptr,
			(void**)&m_freeStringFn)) {
		std::cerr << "Failed to load LHM_FreeString function" << std::endl;
		return false;
	}
    
	if (!m_clrHost->LoadAssemblyAndGetFunctionPointer(
			bridgeDllPath,
			typeName,
			L"Shutdown",
			L"LibreHardwareMonitorNative.HardwareMonitorBridge+ShutdownDelegate, LibreHardwareMonitorBridge",
			nullptr,
			(void**)&m_shutdownFn)) {
		std::cerr << "Failed to load LHM_Shutdown function" << std::endl;
		return false;
	}
    
	std::cout << "✓ Loaded all managed function pointers" << std::endl;
    
	// Debug: Log hardware config being passed to C#
	std::cout << "=== Initializing LibreHardwareMonitor ===" << std::endl;
	std::cout << "CPU: " << (config.cpu ? "true" : "false") 
			  << ", GPU: " << (config.gpu ? "true" : "false")
			  << ", Motherboard: " << (config.motherboard ? "true" : "false") << std::endl;
	std::cout << "Memory: " << (config.memory ? "true" : "false")
			  << ", Storage: " << (config.storage ? "true" : "false")
			  << ", Network: " << (config.network ? "true" : "false") << std::endl;
	std::cout << "PSU: " << (config.psu ? "true" : "false")
			  << ", Controller: " << (config.controller ? "true" : "false")
			  << ", Battery: " << (config.battery ? "true" : "false") << std::endl;
	std::cout << "DIMM Detection: " << (config.dimmDetection ? "true" : "false") 
	          << ", Physical Network Only: " << (config.physicalNetworkOnly ? "true" : "false") << std::endl;
    
	int result = m_initializeFn(
		config.cpu,
		config.gpu,
		config.motherboard,
		config.memory,
		config.storage,
		config.network,
		config.psu,
		config.controller,
		config.battery,
		config.dimmDetection,
		config.physicalNetworkOnly
	);
    
	if (result != 0) {
		std::cerr << "Managed initialization failed with code: " << result << std::endl;
		return false;
	}
    
	std::cout << "✓ Hardware monitoring initialized successfully" << std::endl;
	m_isInitialized = true;
	return true;
}

std::string HardwareMonitor::Poll() {
	if (!m_isInitialized) {
		throw std::runtime_error("Hardware monitor not initialized");
	}
    
	// Call managed poll function
	void* jsonPtr = m_pollFn();
    
	if (jsonPtr == nullptr) {
		throw std::runtime_error("Managed poll function returned null");
	}
    
	// Convert to std::string
	std::string result(static_cast<char*>(jsonPtr));
    
	// Free the managed memory
	m_freeStringFn(jsonPtr);
    
	return result;
}

void HardwareMonitor::Shutdown() {
	if (!m_isInitialized) {
		return;
	}
    
	// Call managed shutdown
	if (m_shutdownFn != nullptr) {
		m_shutdownFn();
	}
    
	std::cout << "Hardware Monitor shutdown" << std::endl;
    
	m_isInitialized = false;
	m_initializeFn = nullptr;
	m_pollFn = nullptr;
	m_freeStringFn = nullptr;
	m_shutdownFn = nullptr;
}
