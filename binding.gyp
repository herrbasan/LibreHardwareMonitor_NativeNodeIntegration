{
  "targets": [
    {
      "target_name": "librehardwaremonitor_native",
      "sources": [
        "src/addon.cc",
        "src/clr_host.cc",
        "src/hardware_monitor.cc",
        "src/json_builder.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.9/runtimes/win-x64/native"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "UNICODE",
        "_UNICODE"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/std:c++17"]
        },
        "VCLinkerTool": {
          "AdditionalLibraryDirectories": [
            "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.9/runtimes/win-x64/native"
          ]
        }
      },
      "libraries": [
        "-lnethost"
      ],
      "copies": [
        {
          "destination": "<(module_root_dir)/build/Release",
          "files": [
            "<(module_root_dir)/deps/LibreHardwareMonitor/LibreHardwareMonitorLib.dll",
            "<(module_root_dir)/deps/LibreHardwareMonitor/LibreHardwareMonitorLib.deps.json",
            "<(module_root_dir)/deps/LibreHardwareMonitor/HidSharp.dll",
            "<(module_root_dir)/deps/LibreHardwareMonitor/RAMSPDToolkit-NDD.dll",
            "<(module_root_dir)/deps/LibreHardwareMonitor/Mono.Posix.NETStandard.dll",
            "<(module_root_dir)/deps/LibreHardwareMonitor/MonoPosixHelper.dll",
            "<(module_root_dir)/deps/LibreHardwareMonitor/libMonoPosixHelper.dll",
            "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.9/runtimes/win-x64/native/nethost.dll",
            "<(module_root_dir)/managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/LibreHardwareMonitorBridge.dll",
            "<(module_root_dir)/managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/System.Management.dll",
            "<(module_root_dir)/managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/System.IO.Ports.dll",
            "<(module_root_dir)/managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/System.Threading.AccessControl.dll",
            "<(module_root_dir)/managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/System.CodeDom.dll",
            "<(module_root_dir)/managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/LibreHardwareMonitorBridge.deps.json",
            "<(module_root_dir)/managed/LibreHardwareMonitorBridge/LibreHardwareMonitorBridge.runtimeconfig.json"
          ]
        }
      ],
      "conditions": [
        ["OS=='win'", {
          "defines": [
            "WIN32_LEAN_AND_MEAN",
            "NOMINMAX"
          ]
        }]
      ]
    }
  ]
}
