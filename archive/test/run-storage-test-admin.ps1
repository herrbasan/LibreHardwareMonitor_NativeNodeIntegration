# Run storage test with administrator privileges
# This script will elevate to admin and run the storage test

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$testScript = Join-Path $scriptPath "test-storage-admin.js"

Write-Host "Testing storage detection with administrator privileges..." -ForegroundColor Cyan
Write-Host ""

# Check if already admin
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    Write-Host "Already running as administrator" -ForegroundColor Green
    Write-Host ""
    node $testScript
} else {
    Write-Host "Not running as administrator - attempting to elevate..." -ForegroundColor Yellow
    Write-Host ""
    
    # Re-run this script as admin
    Start-Process powershell -Verb RunAs -ArgumentList "-NoExit", "-Command", "cd '$PWD'; node '$testScript'"
}
