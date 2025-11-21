#include <napi.h>
#include "clr_host.h"
#include "hardware_monitor.h"
#include <string>
#include <algorithm>

// Global instances
static CLRHost* g_clrHost = nullptr;
static HardwareMonitor* g_hardwareMonitor = nullptr;

static bool getBoolOrDefault(Napi::Env env, const Napi::Object& obj, const char* key, bool defVal) {
  if (!obj.Has(key)) return defVal;
  Napi::Value v = obj.Get(key);
  if (v.IsBoolean()) return v.As<Napi::Boolean>().Value();
  if (v.IsNumber()) return v.As<Napi::Number>().Int64Value() != 0;
  if (v.IsNull() || v.IsUndefined()) return defVal;
  if (v.IsString()) {
    std::string s = v.As<Napi::String>().Utf8Value();
    // trim
    s.erase(s.begin(), std::find_if(s.begin(), s.end(), [](unsigned char ch){ return !std::isspace(ch); }));
    s.erase(std::find_if(s.rbegin(), s.rend(), [](unsigned char ch){ return !std::isspace(ch); }).base(), s.end());
    std::string sl = s;
    std::transform(sl.begin(), sl.end(), sl.begin(), [](unsigned char c){ return (char)std::tolower(c); });
    if (sl == "false" || sl == "0" || sl == "off" || sl == "no" || sl == "") return false;
    if (sl == "true" || sl == "1" || sl == "on" || sl == "yes") return true;
    // Fallback to JS ToBoolean semantics
    return v.ToBoolean().Value();
  }
  // Fallback
  return v.ToBoolean().Value();
}

Napi::Value Init(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto deferred = Napi::Promise::Deferred::New(env);

  try {
    if (g_hardwareMonitor != nullptr) {
      Napi::Error::New(env, "Hardware monitor already initialized").ThrowAsJavaScriptException();
      deferred.Reject(env.Undefined());
      return deferred.Promise();
    }

    if (info.Length() < 1 || !info[0].IsObject()) {
      Napi::TypeError::New(env, "Expected configuration object").ThrowAsJavaScriptException();
      deferred.Reject(env.Undefined());
      return deferred.Promise();
    }

    Napi::Object config = info[0].As<Napi::Object>();

    HardwareConfig hwConfig;
    hwConfig.cpu = getBoolOrDefault(env, config, "cpu", false);
    hwConfig.gpu = getBoolOrDefault(env, config, "gpu", false);
    hwConfig.motherboard = getBoolOrDefault(env, config, "motherboard", false);
    hwConfig.memory = getBoolOrDefault(env, config, "memory", false);
    hwConfig.storage = getBoolOrDefault(env, config, "storage", false);
    hwConfig.network = getBoolOrDefault(env, config, "network", false);
    hwConfig.psu = getBoolOrDefault(env, config, "psu", false);
    hwConfig.controller = getBoolOrDefault(env, config, "controller", false);
    hwConfig.battery = getBoolOrDefault(env, config, "battery", false);

    // Debug: print resolved flags to stderr
    fprintf(stderr,
      "[NAPI] init flags: cpu=%d gpu=%d motherboard=%d memory=%d storage=%d network=%d psu=%d controller=%d battery=%d\n",
      hwConfig.cpu, hwConfig.gpu, hwConfig.motherboard, hwConfig.memory, hwConfig.storage, hwConfig.network, hwConfig.psu, hwConfig.controller, hwConfig.battery);

    if (g_clrHost == nullptr) {
      g_clrHost = new CLRHost();
      if (!g_clrHost->Initialize()) {
        delete g_clrHost;
        g_clrHost = nullptr;
        Napi::Error::New(env, "Failed to initialize .NET runtime").ThrowAsJavaScriptException();
        deferred.Reject(env.Undefined());
        return deferred.Promise();
      }
    }

    g_hardwareMonitor = new HardwareMonitor(g_clrHost);
    if (!g_hardwareMonitor->Initialize(hwConfig)) {
      delete g_hardwareMonitor;
      g_hardwareMonitor = nullptr;
      Napi::Error::New(env, "Failed to initialize hardware monitor").ThrowAsJavaScriptException();
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

class PollWorker : public Napi::AsyncWorker {
public:
    PollWorker(Napi::Env env, HardwareMonitor* monitor)
        : Napi::AsyncWorker(env), monitor(monitor), deferred(Napi::Promise::Deferred::New(env)) {}

    void Execute() override {
        if (monitor == nullptr) {
            SetError("Hardware monitor not initialized");
            return;
        }
        try {
            jsonData = monitor->Poll();
        } catch (const std::exception& e) {
            SetError(e.what());
        }
    }

    void OnOK() override {
        Napi::Env env = Env();
        Napi::HandleScope scope(env);
        
        try {
            Napi::Value jsonStr = Napi::String::New(env, jsonData);
            Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
            Napi::Function parse = json.Get("parse").As<Napi::Function>();
            Napi::Value result = parse.Call({jsonStr});
            deferred.Resolve(result);
        } catch (const std::exception& e) {
            deferred.Reject(Napi::Error::New(env, e.what()).Value());
        } catch (...) {
            deferred.Reject(Napi::Error::New(env, "Unknown error parsing JSON").Value());
        }
    }

    void OnError(const Napi::Error& e) override {
        deferred.Reject(e.Value());
    }

    Napi::Promise GetPromise() { return deferred.Promise(); }

private:
    HardwareMonitor* monitor;
    std::string jsonData;
    Napi::Promise::Deferred deferred;
};

Napi::Value Poll(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (g_hardwareMonitor == nullptr) {
    auto deferred = Napi::Promise::Deferred::New(env);
    deferred.Reject(Napi::Error::New(env, "Hardware monitor not initialized. Call init() first.").Value());
    return deferred.Promise();
  }

  PollWorker* worker = new PollWorker(env, g_hardwareMonitor);
  worker->Queue();
  return worker->GetPromise();
}

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

Napi::Object InitModule(Napi::Env env, Napi::Object exports) {
  napi_add_env_cleanup_hook(env, AtExit, nullptr);
  exports.Set("init", Napi::Function::New(env, Init));
  exports.Set("poll", Napi::Function::New(env, Poll));
  exports.Set("shutdown", Napi::Function::New(env, Shutdown));
  return exports;
}

NODE_API_MODULE(librehardwaremonitor_native, InitModule)
