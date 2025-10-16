# LibreMonCLI Project Cleanup Script
# Removes build artifacts, temporary files, and test outputs

Write-Host "Project Cleanup Analysis" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

# Function to calculate folder size
function Get-FolderSize {
    param([string]$Path)
    $size = (Get-ChildItem $Path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    return [math]::Round($size / 1MB, 2)
}

$cleanupItems = @()
$totalSizeSaved = 0

# 1. Remove empty files in root
Write-Host "`nChecking root directory..." -ForegroundColor Yellow
$emptyFiles = @("error.txt", "output.txt") | Where-Object { Test-Path $_ -and (Get-Item $_).Length -eq 0 }
if ($emptyFiles) {
    foreach ($file in $emptyFiles) {
        Remove-Item $file -Force
        Write-Host "  Removed empty file: $file" -ForegroundColor Green
    }
    $cleanupItems += "Empty root files: $($emptyFiles -join ', ')"
}

# 2. Clean build artifacts in managed/
Write-Host "`nCleaning managed/ build artifacts..." -ForegroundColor Yellow
$managedBinObj = Get-ChildItem "managed/" -Recurse -Directory | Where-Object { $_.Name -in @('bin', 'obj') }
$managedSizeBefore = Get-FolderSize "managed/"
foreach ($dir in $managedBinObj) {
    $size = Get-FolderSize $dir.FullName
    Remove-Item $dir.FullName -Recurse -Force
    Write-Host "  Removed: $($dir.FullName) ($size MB)" -ForegroundColor Green
    $totalSizeSaved += $size
}
$cleanupItems += "Managed build artifacts: $($managedBinObj.Count) directories"

# 3. Clean build artifacts in deps/
Write-Host "`nCleaning deps/ build artifacts..." -ForegroundColor Yellow
$depsBinObj = Get-ChildItem "deps/" -Recurse -Directory | Where-Object { $_.Name -in @('bin', 'obj') }
foreach ($dir in $depsBinObj) {
    $size = Get-FolderSize $dir.FullName
    Remove-Item $dir.FullName -Recurse -Force
    Write-Host "  Removed: $($dir.FullName) ($size MB)" -ForegroundColor Green
    $totalSizeSaved += $size
}
$cleanupItems += "Deps build artifacts: $($depsBinObj.Count) directories"

# 4. Clean test output files
Write-Host "`nCleaning test outputs..." -ForegroundColor Yellow
$testOutputs = @("output/", "test/output/")
foreach ($dir in $testOutputs) {
    if (Test-Path $dir) {
        $files = Get-ChildItem $dir -File
        if ($files) {
            $size = Get-FolderSize $dir
            Remove-Item "$dir/*" -Force
            Write-Host "  Cleaned: $dir ($size MB, $($files.Count) files)" -ForegroundColor Green
            $totalSizeSaved += $size
            $cleanupItems += "Test outputs in $dir"
        }
    }
}

# 5. Check for redundant test files
Write-Host "`nAnalyzing test files..." -ForegroundColor Yellow
$testFiles = Get-ChildItem "test/" -File -Filter "*.js" | Where-Object { $_.Name -match "test.*\.js" }
$redundantTests = $testFiles | Where-Object {
    $content = Get-Content $_.FullName -Raw
    # Check for very short or duplicate test files
    ($content.Length -lt 500) -or
    ($content -match "TODO|FIXME|console\.log.*test") -or
    ($_.Name -match ".*-(old|backup|temp|debug)\.js$")
}

if ($redundantTests) {
    Write-Host "  Found potentially redundant test files:" -ForegroundColor Yellow
    foreach ($file in $redundantTests) {
        $size = [math]::Round($file.Length / 1KB, 1)
        Write-Host "    - $($file.Name) (${size}KB)" -ForegroundColor Gray
    }
    Write-Host "  Consider reviewing these for removal" -ForegroundColor Cyan
}

# Summary
Write-Host "`nCleanup Summary" -ForegroundColor Green
Write-Host "=" * 30 -ForegroundColor Green
Write-Host "Space saved: ~$([math]::Round($totalSizeSaved, 1)) MB" -ForegroundColor White
Write-Host "Items cleaned:" -ForegroundColor White
foreach ($item in $cleanupItems) {
    Write-Host "  - $item" -ForegroundColor Gray
}

Write-Host "`nProject cleanup completed!" -ForegroundColor Green
Write-Host "Note: dist/ is intentionally not cleaned (self-contained deployment)" -ForegroundColor Cyan