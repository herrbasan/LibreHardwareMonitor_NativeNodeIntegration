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
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/10.0.0/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.9/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.10/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.8/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.0/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/8.0.0/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64"
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
            "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/10.0.0/runtimes/win-x64/native",
            "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.9/runtimes/win-x64/native",
            "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.10/runtimes/win-x64/native",
            "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.8/runtimes/win-x64/native"
          ]
        }
      },
      "msvs_toolset": "v142",
      "libraries": [
        "-lnethost"
      ],
      "copies": [
        {
          "destination": "<(module_root_dir)/build/Release",
          "files": [
            "<(module_root_dir)/../deps/LibreHardwareMonitor/LibreHardwareMonitorLib.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/LibreHardwareMonitorBridge.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/System.Management.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/System.IO.Ports.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/System.Threading.AccessControl.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/System.CodeDom.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/DiskInfoToolkit.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/RAMSPDToolkit-NDD.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/HidSharp.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/hostfxr.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/LibreHardwareMonitorBridge.deps.json",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/LibreHardwareMonitorBridge.runtimeconfig.json"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/hostpolicy.dll"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/coreclr.dll"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/clrjit.dll"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/mscordbi.dll"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish/mscordaccore.dll"
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
