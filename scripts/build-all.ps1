# Complete build script for LibreHardwareMonitor N-API addon
# Builds everything from source in correct order

param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " LibreHardwareMonitor N-API Complete Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build LibreHardwareMonitor from source
Write-Host "[1/4] Building LibreHardwareMonitor from source..." -ForegroundColor Cyan
$lhmSrc = Join-Path $root "deps\LibreHardwareMonitor-src"
$lhmDest = Join-Path $root "deps\LibreHardwareMonitor"
$lhmProject = Join-Path $lhmSrc "LibreHardwareMonitorLib\LibreHardwareMonitorLib.csproj"

if (-not (Test-Path $lhmProject)) {
    Write-Host "ERROR: LibreHardwareMonitor source not found at $lhmProject" -ForegroundColor Red
    Write-Host "Run: git submodule update --init --recursive" -ForegroundColor Yellow
    exit 1
}

Push-Location $lhmSrc
try {
    dotnet build $lhmProject -c Release -p:Platform=x64
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: LibreHardwareMonitor build failed" -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
}

# Copy built DLL to deps folder
$builtDll = Join-Path $lhmSrc "bin\Release\x64\net9.0-windows\LibreHardwareMonitorLib.dll"
if (-not (Test-Path $builtDll)) {
    Write-Host "ERROR: Built DLL not found at $builtDll" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $lhmDest)) {
    New-Item -ItemType Directory -Path $lhmDest -Force | Out-Null
}

Copy-Item $builtDll $lhmDest -Force
Write-Host "  + Copied LibreHardwareMonitorLib.dll to deps/LibreHardwareMonitor/" -ForegroundColor Green

# Step 2: Build LibreHardwareMonitorBridge
Write-Host ""
Write-Host "[2/4] Building LibreHardwareMonitorBridge (.NET 9.0)..." -ForegroundColor Cyan
$bridgeProject = Join-Path $root "managed\LibreHardwareMonitorBridge\LibreHardwareMonitorBridge.csproj"

if (-not (Test-Path $bridgeProject)) {
    Write-Host "ERROR: Bridge project not found at $bridgeProject" -ForegroundColor Red
    exit 1
}

dotnet publish $bridgeProject -c Release -r win-x64 -p:Platform=x64 -p:SelfContained=true --no-restore
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Bridge build failed" -ForegroundColor Red
    exit 1
}

Write-Host "  + Bridge built successfully" -ForegroundColor Green

# Step 3: Build N-API addon
Write-Host ""
Write-Host "[3/4] Building N-API addon with node-gyp..." -ForegroundColor Cyan
$napiDir = Join-Path $root "NativeLibremon_NAPI"

Push-Location $napiDir
try {
    if ($Clean) {
        if (Test-Path "build") {
            Remove-Item "build" -Recurse -Force
        }
    }
    
    npm install
    node-gyp rebuild
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: N-API addon build failed" -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
}

Write-Host "  + N-API addon built successfully" -ForegroundColor Green

# Step 4: Copy everything to dist
Write-Host ""
Write-Host "[4/4] Assembling dist folder..." -ForegroundColor Cyan

$distDir = Join-Path $root "dist\NativeLibremon_NAPI"
$releaseDir = Join-Path $napiDir "build\Release"
$bridgePublishDir = Join-Path $root "managed\LibreHardwareMonitorBridge\bin\Release\net9.0\win-x64\publish"

if (Test-Path $distDir) {
    Remove-Item $distDir -Recurse -Force
}
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

# Copy N-API addon
Copy-Item -Path "$releaseDir\*" -Destination $distDir -Recurse -Force
Write-Host "  + Copied N-API addon" -ForegroundColor Gray

# Copy all bridge publish files (self-contained runtime)
Copy-Item -Path "$bridgePublishDir\*" -Destination $distDir -Recurse -Force
Write-Host "  + Copied self-contained .NET runtime" -ForegroundColor Gray

# Copy nethost.dll
$nethostPath = Get-ChildItem -Path "C:\Program Files\dotnet\packs" -Filter "nethost.dll" -Recurse | 
    Select-Object -First 1 -ExpandProperty FullName

if ($nethostPath) {
    Copy-Item -Path $nethostPath -Destination $distDir -Force
    Write-Host "  + Copied nethost.dll" -ForegroundColor Gray
} else {
    Write-Host "  ! nethost.dll not found (may cause runtime issues)" -ForegroundColor Yellow
}

# Copy JavaScript entry point
$entrySrc = Join-Path $napiDir "lib\index.js"
$entryContent = Get-Content $entrySrc -Raw
$entryContent = $entryContent -replace "\.\./build/Release/librehardwaremonitor_native\.node", "./librehardwaremonitor_native.node"
Set-Content -Path "$distDir\index.js" -Value $entryContent -Encoding UTF8
Write-Host "  + Created index.js entry point" -ForegroundColor Gray

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " + Build completed successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output: $distDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test with:" -ForegroundColor Cyan
Write-Host "  node test/simple-poll.js" -ForegroundColor Gray
