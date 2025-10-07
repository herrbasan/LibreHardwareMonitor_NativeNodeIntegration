# Visual Studio Setup Guide

## Required Components for Building LibreHardwareMonitor Native

This guide lists the **exact** Visual Studio components needed to build the native Node.js addon.

## Installation Options

### Option 1: Visual Studio 2022 Community (Recommended)

**Download**: [Visual Studio 2022 Community](https://visualstudio.microsoft.com/downloads/)
- Free for individual developers, open source projects, and small teams
- Fully featured IDE with debugging support

### Option 2: Build Tools for Visual Studio 2022 (Minimal)

**Download**: [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
- Command-line only (no IDE)
- Smaller download (~2-3 GB vs ~10+ GB)
- Perfect for CI/CD or minimal installations

## Required Workload

### Desktop development with C++

During installation, select this workload from the **Workloads** tab:

```
☑ Desktop development with C++
```

This single workload includes everything needed for node-gyp and native addon compilation.

## Detailed Component Breakdown

When you select "Desktop development with C++", the following components are automatically included:

### Core Components (Required)

| Component | Purpose | Size |
|-----------|---------|------|
| **MSVC v143 - VS 2022 C++ x64/x86 build tools** | C++ compiler and linker | ~500 MB |
| **Windows 11 SDK (10.0.22621.0 or later)** | Windows API headers and libraries | ~1 GB |
| **C++ CMake tools for Windows** | CMake integration (used by node-gyp) | ~50 MB |
| **C++ core features** | Standard library and runtime | ~100 MB |

### Optional but Recommended Components

| Component | Purpose | Needed? |
|-----------|---------|---------|
| **C++ profiling tools** | Performance analysis | ❌ Optional |
| **C++ AddressSanitizer** | Memory error detection | ✅ Useful for debugging |
| **Just-In-Time debugger** | Crash debugging | ✅ Useful for development |
| **C++ IntelliSense** | Code completion | ✅ If using IDE |
| **Windows 10 SDK (older versions)** | Backward compatibility | ❌ Not needed |

## Step-by-Step Installation (Visual Studio 2022)

### 1. Download the Installer

- Go to https://visualstudio.microsoft.com/downloads/
- Click **Download** under "Visual Studio 2022 Community"
- Run `vs_community.exe`

### 2. Select Workload

On the **Workloads** tab:
1. ✅ Check **"Desktop development with C++"**
2. Leave other workloads unchecked (unless needed for other projects)

### 3. Verify Individual Components (Optional)

Switch to the **Individual components** tab and verify these are selected:

**Compilers, build tools, and runtimes**:
- ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
- ✅ C++ 2022 Redistributable Update
- ✅ C++ core features

**SDKs, libraries, and frameworks**:
- ✅ Windows 11 SDK (10.0.22621.0) - or latest available
- ✅ C++ CMake tools for Windows

### 4. Installation Location

- Default location: `C:\Program Files\Microsoft Visual Studio\2022\Community`
- Required disk space: ~7-10 GB
- Installation time: 15-30 minutes (depending on internet speed)

### 5. Complete Installation

Click **Install** and wait for completion.

## Step-by-Step Installation (Build Tools Only)

For minimal installation without the IDE:

### 1. Download Build Tools

- Go to https://visualstudio.microsoft.com/downloads/
- Scroll to **"Tools for Visual Studio"**
- Download **"Build Tools for Visual Studio 2022"**
- Run `vs_BuildTools.exe`

### 2. Select Workload

On the **Workloads** tab:
1. ✅ Check **"Desktop development with C++"**
2. Click **Install**

### 3. Verify Installation

After installation, open PowerShell and verify:

```powershell
# Check if MSBuild is available
where.exe msbuild

# Should output something like:
# C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin\MSBuild.exe
```

## Verification After Installation

### Test node-gyp

```powershell
# Navigate to project directory
cd D:\Work\_GIT\LibreHardwareMonitor_NativeNodeIntegration

# Clean previous build attempts
npm run clean

# Try building
npm install
```

Expected output:
```
gyp info using node-gyp@10.3.1
gyp info using node@24.5.0 | win32 | x64
gyp info find Python using Python version 3.13.6
gyp info find VS using Visual Studio 2022 (17.x.x)
gyp info spawn C:\Program Files\Microsoft Visual Studio\2022\...
...
gyp info ok
```

### Common Issues After Installation

**Issue**: node-gyp still can't find Visual Studio

**Solution**: Open a **new** PowerShell window (node-gyp caches Visual Studio detection)

---

**Issue**: `msbuild.exited with code: 1`

**Solution**: Check that Windows SDK is installed:
```powershell
dir "C:\Program Files (x86)\Windows Kits\10\Include"
# Should show at least one SDK version folder
```

---

**Issue**: `error C1083: Cannot open include file: 'windows.h'`

**Solution**: Windows SDK not properly installed. Re-run Visual Studio Installer and verify Windows SDK is checked.

## Minimal Component List (Summary)

If manually selecting components, you need **at minimum**:

### Required (Cannot build without these)
1. ✅ **MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)**
2. ✅ **Windows 11 SDK (10.0.22621.0 or later)** OR **Windows 10 SDK (10.0.19041.0 or later)**
3. ✅ **C++ core features**

### Recommended (Makes development easier)
4. ✅ **C++ CMake tools for Windows**
5. ✅ **Just-In-Time debugger**
6. ✅ **C++ AddressSanitizer** (for debugging memory issues)

### Not Needed
- ❌ .NET Desktop Development workload
- ❌ Universal Windows Platform development
- ❌ Azure development
- ❌ Mobile development
- ❌ Game development
- ❌ Office/SharePoint development

## Alternative: Use Existing Visual Studio Installation

If you already have Visual Studio 2019 or 2022 installed:

1. Run **Visual Studio Installer**
2. Click **Modify** on your installation
3. Switch to **Workloads** tab
4. ✅ Check **"Desktop development with C++"** if not already selected
5. Click **Modify** to install missing components

## Disk Space Requirements

| Installation Type | Download Size | Installed Size |
|-------------------|--------------|----------------|
| Build Tools Only | ~2-3 GB | ~3-4 GB |
| Visual Studio Community (with C++ only) | ~4-6 GB | ~7-10 GB |
| Visual Studio Community (full install) | ~10-15 GB | ~30-50 GB |

## Summary Checklist

Before building the native addon, verify:

- ✅ Visual Studio 2019 or 2022 installed
- ✅ "Desktop development with C++" workload selected
- ✅ MSVC compiler (v142 or v143) installed
- ✅ Windows SDK (10.0.19041.0 or later) installed
- ✅ Python 3.x available in PATH
- ✅ .NET SDK 6.0+ installed
- ✅ Node.js 16+ installed

Then run:
```bash
npm install
```

---

**Questions?** Check the [Troubleshooting section in README.md](../README.md#-troubleshooting) or the [node-gyp Windows documentation](https://github.com/nodejs/node-gyp#on-windows).
