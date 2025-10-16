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
	, m_moduleDirectory()
	, m_initFptr(nullptr)
	, m_getDelegateFptr(nullptr)
	, m_closeFptr(nullptr)
{
}

CLRHost::~CLRHost() {
	Shutdown();
}

bool CLRHost::LoadHostFxr() {
	// Attempt to load bundled hostfxr.dll first
	if (!m_moduleDirectory.empty()) {
		std::wstring localHostFxr = m_moduleDirectory + L"hostfxr.dll";
		DWORD attrs = GetFileAttributesW(localHostFxr.c_str());
		if (attrs != INVALID_FILE_ATTRIBUTES) {
			m_hostfxrHandle = LoadLibraryW(localHostFxr.c_str());
			if (!m_hostfxrHandle) {
				std::wcerr << L"Found bundled hostfxr.dll but failed to load from: " << localHostFxr << std::endl;
			}
			else {
				std::wcout << L"Using bundled hostfxr.dll from: " << localHostFxr << std::endl;
			}
		}
	}

	if (!m_hostfxrHandle) {
		wchar_t hostfxrPath[MAX_PATH];
		if (!GetHostFxrPath(hostfxrPath, MAX_PATH)) {
			std::wcerr << L"Failed to locate hostfxr.dll. Ensure the bundled runtime is present or install the .NET runtime." << std::endl;
			return false;
		}

		m_hostfxrHandle = LoadLibraryW(hostfxrPath);
		if (!m_hostfxrHandle) {
			std::wcerr << L"Failed to load hostfxr.dll from: " << hostfxrPath << std::endl;
			return false;
		}
		std::wcout << L"Using system hostfxr.dll from: " << hostfxrPath << std::endl;
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

	if (m_moduleDirectory.empty()) {
		HMODULE hModule = nullptr;
		if (!GetModuleHandleExW(
			GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
			(LPCWSTR)&g_module_marker,
			&hModule)) {
			std::wcerr << L"Failed to get module handle" << std::endl;
			return false;
		}

		wchar_t modulePath[MAX_PATH];
		DWORD len = GetModuleFileNameW(hModule, modulePath, MAX_PATH);
		if (len == 0 || len >= MAX_PATH) {
			std::wcerr << L"Failed to get module path" << std::endl;
			return false;
		}

		wchar_t* lastSlash = wcsrchr(modulePath, L'\\');
		if (lastSlash) {
			*(lastSlash + 1) = L'\0';
		}
		m_moduleDirectory.assign(modulePath);
	}
    
	// Load hostfxr
	if (!LoadHostFxr()) {
		return false;
	}
    
	std::wstring bridgeDllPath = m_moduleDirectory + L"LibreHardwareMonitorBridge.dll";
	std::wcout << L"Initializing .NET self-contained runtime for: " << bridgeDllPath << std::endl;
    
	// For self-contained, we DON'T use runtimeconfig.json approach
	// Instead, load with hostfxr_initialize_for_dotnet_command_line using only the DLL path
	hostfxr_initialize_for_dotnet_command_line_fn initCmdLineFptr = 
		(hostfxr_initialize_for_dotnet_command_line_fn)
		GetProcAddress(m_hostfxrHandle, "hostfxr_initialize_for_dotnet_command_line");
    
	if (!initCmdLineFptr) {
		std::wcerr << L"Failed to get hostfxr_initialize_for_dotnet_command_line function" << std::endl;
		return false;
	}
    
	// For self-contained libraries: argv[0] = dll path, no other args
	// The hostfxr will find the runtime DLLs in the same directory
	const wchar_t* argv[] = { bridgeDllPath.c_str() };
    
	hostfxr_initialize_parameters params = {};
	params.size = sizeof(hostfxr_initialize_parameters);
	params.host_path = bridgeDllPath.c_str();
	params.dotnet_root = m_moduleDirectory.c_str();
    
	// Initialize with command-line approach (supports self-contained)
	int rc = initCmdLineFptr(1, argv, &params, &m_hostContextHandle);
    
	if (rc != 0 || m_hostContextHandle == nullptr) {
		std::wcerr << L"Failed to initialize .NET runtime. Error code: 0x" << std::hex << rc << std::dec << std::endl;
		std::wcerr << L"Make sure all .NET runtime DLLs are present in: " << m_moduleDirectory << std::endl;
		return false;
	}
    
	std::wcout << L"✓ .NET self-contained runtime initialized successfully" << std::endl;
    
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
