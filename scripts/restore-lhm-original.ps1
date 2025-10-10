# Restore original LibreHardwareMonitor files (undo patch)

Write-Host "Restoring original LibreHardwareMonitor files..." -ForegroundColor Cyan

$lhmProjectPath = "deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\LibreHardwareMonitorLib.csproj"
$memoryGroupPath = "deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\Hardware\Memory\MemoryGroup.cs"

$filesToRestore = @(
    @{Original = $lhmProjectPath; Backup = "$lhmProjectPath.backup"},
    @{Original = $memoryGroupPath; Backup = "$memoryGroupPath.backup"}
)

foreach ($file in $filesToRestore) {
    if (Test-Path $file.Backup) {
        Copy-Item $file.Backup $file.Original -Force
        Write-Host "Restored: $($file.Original)" -ForegroundColor Green
    } else {
        Write-Host "Backup not found: $($file.Backup)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Original files restored. You can now rebuild with DIMM support:" -ForegroundColor Green
Write-Host "  dotnet build deps\LibreHardwareMonitor-src\LibreHardwareMonitorLib\ -c Release" -ForegroundColor Cyan
