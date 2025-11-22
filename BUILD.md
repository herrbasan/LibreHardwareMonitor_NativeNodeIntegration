# Build Instructions

Simple guide for building the N-API addon distribution.

## Quick Build

```bash
# From repository root
npm run build
```

Output: `dist/native-libremon-napi/` (~207 files, ~80MB)

## What Gets Built

The build process creates a **self-contained Node.js module** with:

- `librehardwaremonitor_native.node` - Native N-API addon
- `.NET 9.0 runtime` - ~200 DLL files (coreclr.dll, etc.)
- `LibreHardwareMonitorBridge.dll` - C# interop layer
- `LibreHardwareMonitorLib.dll` - Hardware monitoring library
- `index.js` - JavaScript API wrapper
- `package.json` - Module metadata

## Build Requirements

- **Windows 10/11 x64**
- **Node.js 16.0+**
- **Visual Studio 2019+ Build Tools**
  - MSVC v142 toolset
  - Windows 10/11 SDK
  - C++ build tools
- **.NET SDK 9.0+**
- **Python 3.x** (for node-gyp)

## Build Steps (Internal)

`npm run build` executes the following in `NativeLibremon_NAPI/`:

1. **Build Managed Bridge** (`npm run build:managed`)
   - Publishes C# bridge as self-contained .NET 9.0 app
   - Includes entire .NET runtime (~196 DLLs)
   - Fixes runtimeconfig.json to force bundled runtime

2. **Build Native Addon** (`npm run build:native`)
   - Runs `node-gyp configure` (generates VS project files)
   - Patches toolset from ClangCL to MSVC v142
   - Runs `node-gyp build` (compiles C++ to .node file)

3. **Assemble Distribution** (`npm run build:dist`)
   - Copies native addon from `build/Release/`
   - Copies all .NET runtime DLLs
   - Copies `nethost.dll` from .NET SDK
   - Copies JavaScript wrapper
   - Creates `package.json` and README

## Troubleshooting

### ClangCL Errors

The build automatically patches ClangCL requests to use MSVC v142. If you see ClangCL errors:
- Ensure VS 2019 Build Tools are installed
- Check that MSVC v142 toolset is available
- Verify `patch-vcxproj.js` ran between configure and build

### Missing .NET Runtime

If the managed build fails:
- Verify .NET SDK 9.0+ is installed: `dotnet --version`
- Check PATH includes .NET SDK location

### node-gyp Errors

If native compilation fails:
- Ensure Python 3.x is in PATH
- Verify Visual Studio Build Tools are installed
- Try running `npm install --global windows-build-tools`

## Cleaning

```bash
# Clean build artifacts
cd NativeLibremon_NAPI
npm run clean
```

This removes:
- `build/` directory
- Managed publish output
- `dist/` directory

## Distribution

After building, the `dist/native-libremon-napi/` folder is ready to:
- Copy to other projects
- Commit to version control (if desired, though 80MB)
- Deploy to production machines
- Distribute as standalone module

**No build tools required on target machines** - the module is completely self-contained.
