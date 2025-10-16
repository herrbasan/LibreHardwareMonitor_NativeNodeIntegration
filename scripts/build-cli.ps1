# LibreMonCLI Build Script
# Builds LibreHardwareMonitor from submodule and compiles CLI daemon with NativeAOT

param(
    [switch]$Clean,
    [switch]$SkipLHM,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Paths
$RootDir = Split-Path -Parent $PSScriptRoot
$LHMSourceDir = Join-Path $RootDir "deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib"
$LHMOutputDir = Join-Path $RootDir "deps\LibreHardwareMonitor"
$CLIProjectDir = Join-Path $RootDir "managed\LibreMonCLI"
$DistDir = Join-Path $RootDir "dist\NativeLibre_CLI"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "LibreMonCLI Build Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Clean if requested
if ($Clean) {
    Write-Host "Cleaning build artifacts..." -ForegroundColor Yellow
    
    if (Test-Path $DistDir) {
        Remove-Item $DistDir -Recurse -Force
        Write-Host "  Removed $DistDir" -ForegroundColor Gray
    }
    
    if (Test-Path $LHMOutputDir) {
        Remove-Item $LHMOutputDir -Recurse -Force
        Write-Host "  Removed $LHMOutputDir" -ForegroundColor Gray
    }
    
    $CLIBinDir = Join-Path $CLIProjectDir "bin"
    $CLIObjDir = Join-Path $CLIProjectDir "obj"
    if (Test-Path $CLIBinDir) {
        Remove-Item $CLIBinDir -Recurse -Force
        Write-Host "  Removed $CLIBinDir" -ForegroundColor Gray
    }
    if (Test-Path $CLIObjDir) {
        Remove-Item $CLIObjDir -Recurse -Force
        Write-Host "  Removed $CLIObjDir" -ForegroundColor Gray
    }
    
    Write-Host "Clean complete!" -ForegroundColor Green
    Write-Host ""
}

# Step 1: Build LibreHardwareMonitor
if (-not $SkipLHM) {
    Write-Host "[1/3] Building LibreHardwareMonitor..." -ForegroundColor Cyan
    
    if (-not (Test-Path $LHMSourceDir)) {
        Write-Host "ERROR: LibreHardwareMonitor source not found at $LHMSourceDir" -ForegroundColor Red
        Write-Host "Did you initialize the submodule? Run: git submodule update --init --recursive" -ForegroundColor Yellow
        exit 1
    }
    
    $LHMProject = Join-Path $LHMSourceDir "LibreHardwareMonitorLib.csproj"
    
    $buildArgs = @(
        "build",
        $LHMProject,
        "-c", "Release"
    )
    
    if ($Verbose) {
        $buildArgs += "-v", "detailed"
    }
    
    & dotnet @buildArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: LibreHardwareMonitor build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  LibreHardwareMonitor build successful!" -ForegroundColor Green
    Write-Host ""
    
    # Step 2: Copy LibreHardwareMonitor DLLs
    Write-Host "[2/3] Copying LibreHardwareMonitor DLLs..." -ForegroundColor Cyan
    
    # Find the built DLLs
    $LHMBuildDir = Join-Path $LHMSourceDir "bin\Release"
    $NetFolders = Get-ChildItem -Path $LHMBuildDir -Directory -Filter "net*" | Sort-Object Name -Descending
    
    if ($NetFolders.Count -eq 0) {
        Write-Host "ERROR: No build output found in $LHMBuildDir" -ForegroundColor Red
        exit 1
    }
    
    $SourceDir = $NetFolders[0].FullName
    Write-Host "  Source: $SourceDir" -ForegroundColor Gray
    
    # Create output directory
    if (-not (Test-Path $LHMOutputDir)) {
        New-Item -ItemType Directory -Path $LHMOutputDir -Force | Out-Null
    }
    
    # Copy DLLs
    Copy-Item -Path "$SourceDir\*" -Destination $LHMOutputDir -Force -Recurse
    Write-Host "  Copied to: $LHMOutputDir" -ForegroundColor Gray
    
    # Verify LibreHardwareMonitorLib.dll exists
    $MainDLL = Join-Path $LHMOutputDir "LibreHardwareMonitorLib.dll"
    if (-not (Test-Path $MainDLL)) {
        Write-Host "ERROR: LibreHardwareMonitorLib.dll not found!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  DLLs copied successfully!" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[1/3] Skipping LibreHardwareMonitor build (--SkipLHM)" -ForegroundColor Yellow
    Write-Host "[2/3] Skipping DLL copy (--SkipLHM)" -ForegroundColor Yellow
    Write-Host ""
}

# Step 3: Build CLI with NativeAOT
Write-Host "[3/3] Building LibreMonCLI with NativeAOT..." -ForegroundColor Cyan

if (-not (Test-Path $CLIProjectDir)) {
    Write-Host "ERROR: CLI project not found at $CLIProjectDir" -ForegroundColor Red
    exit 1
}

# Create dist directory (scoped subfolder)
if (-not (Test-Path $DistDir)) {
    New-Item -ItemType Directory -Path $DistDir -Force | Out-Null
}

$publishArgs = @(
    "publish",
    $CLIProjectDir,
    "-c", "Release",
    "-r", "win-x64",
    "-o", $DistDir
)

if ($Verbose) {
    $publishArgs += "-v", "detailed"
}

& dotnet @publishArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: LibreMonCLI build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "  LibreMonCLI build successful!" -ForegroundColor Green
Write-Host ""

# Step 4: Show results
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$ExePath = Join-Path $DistDir "LibreMonCLI.exe"
if (Test-Path $ExePath) {
    $FileInfo = Get-Item $ExePath
    $SizeMB = [math]::Round($FileInfo.Length / 1MB, 2)
    
    Write-Host "Binary: $ExePath" -ForegroundColor White
    Write-Host "Size: $SizeMB MB" -ForegroundColor White
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Cyan
    Write-Host "  LibreMonCLI.exe --daemon    # Start persistent daemon" -ForegroundColor Gray
    Write-Host "  LibreMonCLI.exe --version   # Show version info" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "WARNING: LibreMonCLI.exe not found in $DistDir" -ForegroundColor Yellow
}
