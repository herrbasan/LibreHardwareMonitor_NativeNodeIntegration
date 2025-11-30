# Changelog

All notable changes to LibreHardwareMonitor Native Node Integration will be documented in this file.

## [Unreleased]

### Added - 2025-11-30

#### Physical Network Only Filter

New `physicalNetworkOnly` configuration option to filter out virtual network adapters.

**Usage:**
```javascript
monitor.init({
  network: true,
  physicalNetworkOnly: true  // Filter virtual adapters
});
```

**Filtered Adapters:**
- NDIS Lightweight Filters (`-QoS Packet Scheduler-`, `-WFP-`, etc.)
- VirtualBox Host-Only Adapters
- VMware Network Adapters
- Hyper-V Virtual Adapters
- Docker network adapters
- VPN adapters (Private Internet Access, NordVPN, ExpressVPN, etc.)
- WireGuard, Teredo, ISATAP, 6to4 tunnels

**Performance Improvement:**
| Metric | Without Filter | With Filter | Improvement |
|--------|----------------|-------------|-------------|
| Adapters | 46 | 4 | 91% reduction |
| Avg poll time | 1.8ms | 0.2ms | 89% faster |
| CPU usage | 89% | ~0% | ~100% less |

**Implementation:**
- Added `IsPhysicalNetworkOnly` property to `Computer.cs`
- Added `IsPhysicalAdapter()` filter method to `NetworkGroup.cs`
- Added `physicalNetworkOnly` parameter through full stack (JS → C++ → C#)

#### Re-implemented DIMM Detection Toggle

The `dimmDetection` parameter was restored after upstream LHM removed the property.

**Usage:**
```javascript
monitor.init({
  memory: true,
  dimmDetection: false  // Skip per-DIMM sensors (default)
});
```

**Performance Improvement:**
- Init time: 4665ms → 50ms (99% faster)
- Poll time: 6ms → ~0ms

**Implementation:**
- Re-added `IsDimmDetectionEnabled` property to `Computer.cs`
- Added early return in `MemoryGroup.cs` constructor when disabled

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
