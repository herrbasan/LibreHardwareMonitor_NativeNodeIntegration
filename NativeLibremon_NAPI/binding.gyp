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
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.11/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/10.0.0/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.9/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.10/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.8/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.0/runtimes/win-x64/native",
        "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/8.0.0/runtimes/win-x64/native"
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
            "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.11/runtimes/win-x64/native",
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
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/LibreHardwareMonitorBridge.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/System.Management.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/System.IO.Ports.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/System.Threading.AccessControl.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/System.CodeDom.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/DiskInfoToolkit.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/RAMSPDToolkit-NDD.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/HidSharp.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/hostfxr.dll",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/LibreHardwareMonitorBridge.deps.json",
            "<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/LibreHardwareMonitorBridge.runtimeconfig.json"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/hostpolicy.dll"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/coreclr.dll"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/clrjit.dll"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/mscordbi.dll"
            ,"<(module_root_dir)/../managed/LibreHardwareMonitorBridge/bin/Release/net9.0/win-x64/publish-selfcontained/mscordaccore.dll"
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
