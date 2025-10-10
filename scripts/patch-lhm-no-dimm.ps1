# Patch LibreHardwareMonitor to disable DIMM memory support
# This removes RAMSPDToolkit-NDD dependency (which pulls in insecure WinRing0Driver)
# Preserves basic memory sensors (TotalMemory, VirtualMemory)

Write-Host "Patching LibreHardwareMonitor to disable DIMM memory support..." -ForegroundColor Cyan

$lhmProjectPath = "deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\LibreHardwareMonitorLib.csproj"
$memoryGroupPath = "deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\Hardware\Memory\MemoryGroup.cs"

# Files to exclude from compilation (DIMM-specific code that requires RAMSPDToolkit)
$filesToExclude = @(
    "deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\Hardware\Memory\DimmMemory.cs",
    "deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\Hardware\Memory\Sensors\SpdThermalSensor.cs",
    "deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\RAMSPDToolkitDriver.cs"
)

# Backup original files
Write-Host "Creating backups..." -ForegroundColor Yellow
Copy-Item $lhmProjectPath "$lhmProjectPath.backup" -Force
Copy-Item $memoryGroupPath "$memoryGroupPath.backup" -Force

foreach ($file in $filesToExclude) {
    if (Test-Path $file) {
        Copy-Item $file "$file.backup" -Force
    }
}

# Remove RAMSPDToolkit-NDD package reference from LibreHardwareMonitorLib.csproj
Write-Host "Removing RAMSPDToolkit-NDD package reference..." -ForegroundColor Yellow
$projectContent = Get-Content $lhmProjectPath -Raw
$projectContent = $projectContent -replace '\s*<PackageReference Include="RAMSPDToolkit-NDD"[^>]*/>[\r\n]*', ''

# Add compile exclusions for DIMM-related files
$exclusionBlock = @'

  <!-- PATCHED: Exclude DIMM-related files that require RAMSPDToolkit (WinRing0 security issue) -->
  <ItemGroup>
    <Compile Remove="Hardware\Memory\DimmMemory.cs" />
    <Compile Remove="Hardware\Memory\Sensors\SpdThermalSensor.cs" />
    <Compile Remove="RAMSPDToolkitDriver.cs" />
  </ItemGroup>
'@

# Insert before closing </Project> tag
$projectContent = $projectContent -replace '</Project>', "$exclusionBlock`r`n</Project>"
Set-Content $lhmProjectPath $projectContent -NoNewline

# Patch MemoryGroup.cs to skip RAMSPDToolkitDriver initialization and remove using directives
Write-Host "Patching MemoryGroup.cs to skip DIMM support..." -ForegroundColor Yellow
$memoryGroupContent = Get-Content $memoryGroupPath -Raw

# Remove RAMSPDToolkit using directives
$memoryGroupContent = $memoryGroupContent -replace 'using RAMSPDToolkit[^;]*;[\r\n]*', ''

# Replace the constructor to skip RAMSPDToolkitDriver and DIMM initialization
$oldConstructor = @'
    public MemoryGroup(ISettings settings)
    {
        if (DriverManager.Driver is null || !DriverManager.Driver.IsOpen)
        {
            // Assign implementation of IDriver.
            DriverManager.Driver = new RAMSPDToolkitDriver();
            SMBusManager.UseWMI = false;
        }

        _hardware.Add(new VirtualMemory(settings));
        _hardware.Add(new TotalMemory(settings));

        if (DriverManager.Driver == null || !DriverManager.LoadDriver())
        {
            return;
        }

        if (!TryAddDimms(settings))
        {
            StartRetryTask(settings);
        }
    }
'@

$newConstructor = @'
    public MemoryGroup(ISettings settings)
    {
        // PATCHED: DIMM support disabled (RAMSPDToolkit-NDD removed to avoid WinRing0 security issue)
        // Only basic memory sensors (VirtualMemory, TotalMemory) are supported
        
        _hardware.Add(new VirtualMemory(settings));
        _hardware.Add(new TotalMemory(settings));
        
        // DIMM initialization skipped - no RAMSPDToolkitDriver, no individual DIMM sensors
    }
'@

if ($memoryGroupContent -match [regex]::Escape($oldConstructor)) {
    $memoryGroupContent = $memoryGroupContent -replace [regex]::Escape($oldConstructor), $newConstructor
    
    # Comment out methods that reference DimmMemory/SPDAccessor
    $memoryGroupContent = $memoryGroupContent -replace 'private bool TryAddDimms', '// PATCHED: Method disabled (DIMM support removed)`r`n    private bool TryAddDimms_DISABLED'
    $memoryGroupContent = $memoryGroupContent -replace 'private void StartRetryTask', '// PATCHED: Method disabled (DIMM support removed)`r`n    private void StartRetryTask_DISABLED'
    
    Set-Content $memoryGroupPath $memoryGroupContent -NoNewline
    Write-Host "MemoryGroup.cs patched successfully" -ForegroundColor Green
} else {
    Write-Host "WARNING: Could not find expected constructor pattern in MemoryGroup.cs" -ForegroundColor Red
    Write-Host "Manual patching may be required" -ForegroundColor Red
}

Write-Host ""
Write-Host "Patch complete! Now rebuild LibreHardwareMonitor:" -ForegroundColor Green
Write-Host "  dotnet build deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\ -c Release" -ForegroundColor Cyan
Write-Host ""
Write-Host "To restore original files:" -ForegroundColor Yellow
Write-Host "  .\scripts\restore-lhm-original.ps1" -ForegroundColor Cyan
