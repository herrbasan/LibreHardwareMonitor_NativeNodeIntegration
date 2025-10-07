#include "clr_host.h"
#include <nethost.h>
#include <coreclr_delegates.h>
#include <hostfxr.h>
#include <iostream>

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
    
    // For now, we'll initialize without a runtime config
    // In production, you might want to use a .runtimeconfig.json
    // TODO: Consider creating a runtime config for version control
    
    // Get the directory containing LibreHardwareMonitorLib.dll
    wchar_t currentPath[MAX_PATH];
    GetModuleFileNameW(nullptr, currentPath, MAX_PATH);
    
    // Remove filename to get directory
    wchar_t* lastSlash = wcsrchr(currentPath, L'\\');
    if (lastSlash) {
        *(lastSlash + 1) = L'\0';
    }
    
    // Append the DLL path
    wcscat_s(currentPath, MAX_PATH, L"LibreHardwareMonitorLib.dll");
    
    // For initial implementation, we'll use the simpler runtime initialization
    // This requires .NET Runtime to be installed on the system
    
    std::wcout << L"CLR Host initialized (runtime config approach pending)" << std::endl;
    std::wcout << L"Looking for LibreHardwareMonitorLib.dll at: " << currentPath << std::endl;
    
    // Mark as initialized (placeholder until full implementation)
    // In the next phase, we'll properly initialize the runtime context
    m_hostContextHandle = (void*)1; // Placeholder non-null value
    
    return true;
}

void CLRHost::Shutdown() {
    if (m_hostContextHandle != nullptr && m_closeFptr != nullptr) {
        // Close the runtime context
        if ((size_t)m_hostContextHandle != 1) { // Not placeholder
            m_closeFptr(m_hostContextHandle);
        }
        m_hostContextHandle = nullptr;
    }
    
    if (m_hostfxrHandle != nullptr) {
        FreeLibrary(m_hostfxrHandle);
        m_hostfxrHandle = nullptr;
    }
    
    m_initFptr = nullptr;
    m_getDelegateFptr = nullptr;
    m_closeFptr = nullptr;
}

bool CLRHost::GetDelegate(int32_t type, void** delegate) {
    if (!IsInitialized() || !m_getDelegateFptr) {
        return false;
    }
    
    int32_t rc = m_getDelegateFptr(m_hostContextHandle, type, delegate);
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
    
    return rc == 0;
}
