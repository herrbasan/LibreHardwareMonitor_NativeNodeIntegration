#pragma once

#include <string>
#include <windows.h>
#include <nethost.h>
#include <hostfxr.h>
#include <coreclr_delegates.h>

// Global marker variable used to get module handle of .node addon
// Defined in clr_host.cc, used by GetModuleHandleExW
extern int g_module_marker;

/**
 * CLR Host - manages the .NET runtime lifecycle
 * Responsible for loading hostfxr, initializing the runtime,
 * and providing function pointers for calling managed code
 */
class CLRHost {
public:
	CLRHost();
	~CLRHost();
    
	/**
	 * Initialize the .NET runtime
	 * @returns true on success, false on failure
	 */
	bool Initialize();
    
	/**
	 * Shutdown the .NET runtime
	 */
	void Shutdown();
    
	/**
	 * Check if runtime is initialized
	 */
	bool IsInitialized() const { return m_hostContextHandle != nullptr; }
    
	/**
	 * Get a delegate to call managed code
	 * @param type - delegate type (e.g., load_assembly_and_get_function_pointer)
	 * @param delegate - output pointer to receive the delegate
	 * @returns true on success
	 */
	bool GetDelegate(int32_t type, void** delegate);
    
	/**
	 * Load a managed assembly and get a function pointer
	 * @param assemblyPath - full path to the assembly DLL
	 * @param typeName - fully qualified type name
	 * @param methodName - method name to invoke
	 * @param delegateTypeName - signature of the method (can be nullptr for default)
	 * @param reserved - reserved for future use
	 * @param delegate - output function pointer
	 * @returns true on success
	 */
	bool LoadAssemblyAndGetFunctionPointer(
		const wchar_t* assemblyPath,
		const wchar_t* typeName,
		const wchar_t* methodName,
		const wchar_t* delegateTypeName,
		void* reserved,
		void** delegate);

private:
	HMODULE m_hostfxrHandle;
	void* m_hostContextHandle;
    
	hostfxr_initialize_for_runtime_config_fn m_initFptr;
	hostfxr_get_runtime_delegate_fn m_getDelegateFptr;
	hostfxr_close_fn m_closeFptr;
    
	/**
	 * Load hostfxr.dll
	 * @returns true on success
	 */
	bool LoadHostFxr();
    
	/**
	 * Get the path to hostfxr.dll
	 * @param buffer - output buffer for path
	 * @param bufferSize - size of buffer in characters
	 * @returns true on success
	 */
	bool GetHostFxrPath(wchar_t* buffer, size_t bufferSize);
};
