# Changelog

All notable changes to LibreHardwareMonitor Native Node Integration will be documented in this file.

## [Unreleased]

### Changed - 2025-11-21

#### LibreHardwareMonitor Submodule Update
- Updated `deps/LibreHardwareMonitor-src` submodule to commit `5b2645bcbbe10373ec21afc3e95cda3a0a93c97e`
- Brings latest Intel GPU VRAM sensor improvements and bug fixes from upstream

#### Managed Bridge Compatibility Fixes

**Removed Obsolete API Usage**
- Removed `IsDimmDetectionEnabled` property from `HardwareMonitorBridge.cs` (line 70)
- This property was removed from LibreHardwareMonitor's `Computer` class in recent versions
- DIMM detection is now implicitly enabled when memory monitoring is enabled

**Fixed Build System Reference**
- Changed `LibreHardwareMonitorBridge.csproj` to use ProjectReference instead of DLL reference
- **Before**: `<Reference Include="LibreHardwareMonitorLib"><HintPath>../../deps/LibreHardwareMonitor/LibreHardwareMonitorLib.dll</HintPath></Reference>`
- **After**: `<ProjectReference Include="../../deps/LibreHardwareMonitor-src/LibreHardwareMonitorLib/LibreHardwareMonitorLib.csproj" />`
- **Benefit**: Bridge now always compiles against current LibreHardwareMonitor source instead of stale cached DLL
- **Impact**: Prevents runtime errors from API mismatches between bridge and LHM library

#### Technical Details

**Problem Solved**
When the LibreHardwareMonitor submodule was updated, the bridge was still referencing a pre-built DLL from an older version. This caused:
1. Build success but runtime failures due to API incompatibilities
2. Missing .NET APIs (e.g., `System.Threading.Mutex` constructor with `MutexSecurity` parameter)
3. Obsolete property references that no longer exist in the updated library

**Solution Implemented**
Using ProjectReference ensures the build system:
1. Compiles LibreHardwareMonitorLib from source alongside the bridge
2. Automatically detects and enforces API compatibility at compile time
3. Eliminates the risk of stale DLL references
4. Maintains version coherence between bridge and library

**Files Modified**
- `managed/LibreHardwareMonitorBridge/HardwareMonitorBridge.cs` - Removed `IsDimmDetectionEnabled` property assignment
- `managed/LibreHardwareMonitorBridge/LibreHardwareMonitorBridge.csproj` - Changed to ProjectReference

**Build Process Impact**
- Self-contained runtime now includes correct .NET assemblies
- All System.* dependencies properly resolved from .NET 9.0
- Bridge and LibreHardwareMonitorLib compiled with matching target framework
