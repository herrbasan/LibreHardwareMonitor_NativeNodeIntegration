#include "clr_host.h"
#include <nethost.h>
#include <coreclr_delegates.h>
#include <hostfxr.h>
#include <iostream>

// Dummy global variable to get module handle
// Defined here, declared extern in clr_host.h
int g_module_marker = 0;

CLRHost::CLRHost()
    : m_hostfxrHandle(nullptr)
    , m_hostContextHandle(nullptr)
    , m_initFptr(nullptr)
    , m_getDelegateFptr(nullptr)
    , m_closeFptr(nullptr)
{
}

CLRHost::~CLRHost() {
    Shutdown();
}

bool CLRHost::LoadHostFxr() {
    // Get path to hostfxr.dll
    wchar_t hostfxrPath[MAX_PATH];
    if (!GetHostFxrPath(hostfxrPath, MAX_PATH)) {
        std::wcerr << L"Failed to find hostfxr.dll. Is .NET Runtime installed?" << std::endl;
        return false;
    }
    
    // Load hostfxr.dll
    m_hostfxrHandle = LoadLibraryW(hostfxrPath);
    if (!m_hostfxrHandle) {
        std::wcerr << L"Failed to load hostfxr.dll from: " << hostfxrPath << std::endl;
        return false;
    }
    
    // Get function pointers
    m_initFptr = (hostfxr_initialize_for_runtime_config_fn)
        GetProcAddress(m_hostfxrHandle, "hostfxr_initialize_for_runtime_config");
    m_getDelegateFptr = (hostfxr_get_runtime_delegate_fn)
        GetProcAddress(m_hostfxrHandle, "hostfxr_get_runtime_delegate");
    m_closeFptr = (hostfxr_close_fn)
        GetProcAddress(m_hostfxrHandle, "hostfxr_close");
    
    if (!m_initFptr || !m_getDelegateFptr || !m_closeFptr) {
        std::wcerr << L"Failed to get hostfxr function pointers" << std::endl;
        FreeLibrary(m_hostfxrHandle);
        m_hostfxrHandle = nullptr;
        return false;
    }
    
    return true;
}

bool CLRHost::GetHostFxrPath(wchar_t* buffer, size_t bufferSize) {
    size_t requiredSize = bufferSize;
    
    // Try to get hostfxr path using nethost
    int rc = get_hostfxr_path(buffer, &requiredSize, nullptr);
    
    if (rc != 0) {
        return false;
    }
    
    return true;
}

bool CLRHost::Initialize() {
    if (m_hostContextHandle != nullptr) {
        return true; // Already initialized
    }
    
    // Load hostfxr
    if (!LoadHostFxr()) {
        return false;
    }
    
    // Get the path to our .node addon (not node.exe)
    // We need to use the HMODULE of our DLL
    HMODULE hModule = nullptr;
    if (!GetModuleHandleExW(
        GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        (LPCWSTR)&g_module_marker,  // Address of global variable in our module
        &hModule)) {
        std::wcerr << L"Failed to get module handle" << std::endl;
        return false;
    }
    
    wchar_t currentPath[MAX_PATH];
    GetModuleFileNameW(hModule, currentPath, MAX_PATH);
    
    // Remove filename to get directory
    wchar_t* lastSlash = wcsrchr(currentPath, L'\\');
    if (lastSlash) {
        *(lastSlash + 1) = L'\0';
    }
    
    // Build path to LibreHardwareMonitorBridge.runtimeconfig.json
    wchar_t runtimeConfigPath[MAX_PATH];
    wcscpy_s(runtimeConfigPath, MAX_PATH, currentPath);
    wcscat_s(runtimeConfigPath, MAX_PATH, L"LibreHardwareMonitorBridge.runtimeconfig.json");
    
    std::wcout << L"Initializing .NET runtime with config: " << runtimeConfigPath << std::endl;
    
    // Initialize the runtime
    int rc = m_initFptr(runtimeConfigPath, nullptr, &m_hostContextHandle);
    
    if (rc != 0 || m_hostContextHandle == nullptr) {
        std::wcerr << L"Failed to initialize .NET runtime. Error code: " << rc << std::endl;
        std::wcerr << L"Make sure LibreHardwareMonitorBridge.runtimeconfig.json exists in the application directory" << std::endl;
        return false;
    }
    
    std::wcout << L"✓ .NET runtime initialized successfully" << std::endl;
    
    return true;
}

void CLRHost::Shutdown() {
    if (m_hostContextHandle != nullptr && m_closeFptr != nullptr) {
        // Close the runtime context
        m_closeFptr(m_hostContextHandle);
        m_hostContextHandle = nullptr;
    }
    
    if (m_hostfxrHandle != nullptr) {
        FreeLibrary(m_hostfxrHandle);
        m_hostfxrHandle = nullptr;
    }
    
    m_initFptr = nullptr;
    m_getDelegateFptr = nullptr;
    m_closeFptr = nullptr;
    
    std::wcout << L"✓ CLR runtime shutdown complete" << std::endl;
}

bool CLRHost::GetDelegate(int32_t type, void** delegate) {
    if (!IsInitialized() || !m_getDelegateFptr) {
        return false;
    }
    
    int32_t rc = m_getDelegateFptr(m_hostContextHandle, static_cast<hostfxr_delegate_type>(type), delegate);
    return rc == 0;
}

bool CLRHost::LoadAssemblyAndGetFunctionPointer(
    const wchar_t* assemblyPath,
    const wchar_t* typeName,
    const wchar_t* methodName,
    const wchar_t* delegateTypeName,
    void* reserved,
    void** delegate)
{
    // Get the load_assembly_and_get_function_pointer delegate
    load_assembly_and_get_function_pointer_fn loadAssemblyFn = nullptr;
    
    int32_t rc = m_getDelegateFptr(
        m_hostContextHandle,
        hdt_load_assembly_and_get_function_pointer,
        (void**)&loadAssemblyFn);
    
    if (rc != 0 || loadAssemblyFn == nullptr) {
        return false;
    }
    
    // Load the assembly and get function pointer
    rc = loadAssemblyFn(
        assemblyPath,
        typeName,
        methodName,
        delegateTypeName,
        reserved,
        delegate);
    
    if (rc != 0) {
        std::wcerr << L"Failed to load function '" << methodName 
                   << L"' from type '" << typeName 
                   << L"'. Error code: 0x" << std::hex << rc << std::dec << std::endl;
    }
    
    return rc == 0;
}
