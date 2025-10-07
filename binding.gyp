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
            "<(module_root_dir)/deps/LibreHardwareMonitor/HidSharp.dll",
            "C:/Program Files/dotnet/packs/Microsoft.NETCore.App.Host.win-x64/9.0.9/runtimes/win-x64/native/nethost.dll"
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
