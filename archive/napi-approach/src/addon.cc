#include <napi.h>
#include "clr_host.h"
#include "hardware_monitor.h"

// Global instances
static CLRHost* g_clrHost = nullptr;
static HardwareMonitor* g_hardwareMonitor = nullptr;

/**
 * Initialize the hardware monitoring system
 * @param info - expects a configuration object with hardware type flags
 * @returns Promise that resolves when initialization completes
 */
Napi::Value Init(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    // Create deferred for promise
    auto deferred = Napi::Promise::Deferred::New(env);
    
    try {
        // Check if already initialized
        if (g_hardwareMonitor != nullptr) {
            Napi::Error::New(env, "Hardware monitor already initialized")
                .ThrowAsJavaScriptException();
            deferred.Reject(env.Undefined());
            return deferred.Promise();
        }
        
        // Parse configuration object
        if (info.Length() < 1 || !info[0].IsObject()) {
            Napi::TypeError::New(env, "Expected configuration object")
                .ThrowAsJavaScriptException();
            deferred.Reject(env.Undefined());
            return deferred.Promise();
        }
        
        Napi::Object config = info[0].As<Napi::Object>();
        
        // Extract hardware type flags
        HardwareConfig hwConfig;
        hwConfig.cpu = config.Get("cpu").ToBoolean().Value();
        hwConfig.gpu = config.Get("gpu").ToBoolean().Value();
        hwConfig.motherboard = config.Get("motherboard").ToBoolean().Value();
        hwConfig.memory = config.Get("memory").ToBoolean().Value();
        hwConfig.storage = config.Get("storage").ToBoolean().Value();
        hwConfig.network = config.Get("network").ToBoolean().Value();
        hwConfig.psu = config.Get("psu").ToBoolean().Value();
        hwConfig.controller = config.Get("controller").ToBoolean().Value();
        hwConfig.battery = config.Get("battery").ToBoolean().Value();
        
        // Initialize CLR host if not already done
        if (g_clrHost == nullptr) {
            g_clrHost = new CLRHost();
            if (!g_clrHost->Initialize()) {
                delete g_clrHost;
                g_clrHost = nullptr;
                Napi::Error::New(env, "Failed to initialize .NET runtime")
                    .ThrowAsJavaScriptException();
                deferred.Reject(env.Undefined());
                return deferred.Promise();
            }
        }
        
        // Initialize hardware monitor
        g_hardwareMonitor = new HardwareMonitor(g_clrHost);
        if (!g_hardwareMonitor->Initialize(hwConfig)) {
            delete g_hardwareMonitor;
            g_hardwareMonitor = nullptr;
            Napi::Error::New(env, "Failed to initialize hardware monitor")
                .ThrowAsJavaScriptException();
            deferred.Reject(env.Undefined());
            return deferred.Promise();
        }
        
        deferred.Resolve(env.Undefined());
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        deferred.Reject(env.Undefined());
    }
    
    return deferred.Promise();
}

/**
 * Poll hardware sensors
 * @returns Object containing sensor data in LibreHardwareMonitor web endpoint format
 */
Napi::Value Poll(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        if (g_hardwareMonitor == nullptr) {
            Napi::Error::New(env, "Hardware monitor not initialized. Call init() first.")
                .ThrowAsJavaScriptException();
            return env.Undefined();
        }
        
        // Poll sensors and return JSON data
        std::string jsonData = g_hardwareMonitor->Poll();
        
        // Parse JSON string into JavaScript object
        return env.Global()
            .Get("JSON").As<Napi::Object>()
            .Get("parse").As<Napi::Function>()
            .Call({Napi::String::New(env, jsonData)});
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

/**
 * Shutdown the hardware monitoring system
 * Releases resources and unloads CLR
 */
Napi::Value Shutdown(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    try {
        if (g_hardwareMonitor != nullptr) {
            g_hardwareMonitor->Shutdown();
            delete g_hardwareMonitor;
            g_hardwareMonitor = nullptr;
        }
        
        if (g_clrHost != nullptr) {
            g_clrHost->Shutdown();
            delete g_clrHost;
            g_clrHost = nullptr;
        }
        
        return env.Undefined();
        
    } catch (const std::exception& e) {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

/**
 * Cleanup function called on process exit
 */
static void AtExit(void* arg) {
    if (g_hardwareMonitor != nullptr) {
        g_hardwareMonitor->Shutdown();
        delete g_hardwareMonitor;
        g_hardwareMonitor = nullptr;
    }
    
    if (g_clrHost != nullptr) {
        g_clrHost->Shutdown();
        delete g_clrHost;
        g_clrHost = nullptr;
    }
}

/**
 * Module initialization
 */
Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
    // Register exit handler for cleanup
    napi_add_env_cleanup_hook(env, AtExit, nullptr);
    
    // Export functions
    exports.Set("init", Napi::Function::New(env, Init));
    exports.Set("poll", Napi::Function::New(env, Poll));
    exports.Set("shutdown", Napi::Function::New(env, Shutdown));
    
    return exports;
}

NODE_API_MODULE(librehardwaremonitor_native, InitModule)
