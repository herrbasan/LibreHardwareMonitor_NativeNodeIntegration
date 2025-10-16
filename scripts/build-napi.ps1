# Build NativeLibremon N-API addon and copy dist artifacts

param(
    [switch]$Prune
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$projectDir = Join-Path $root "NativeLibremon_NAPI"
$releaseDir = Join-Path $projectDir "build\Release"
$distDir = Join-Path $root "dist\NativeLibremon_NAPI"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "LibreMon N-API Build" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $projectDir)) {
    Write-Host "ERROR: NativeLibremon_NAPI project folder not found at $projectDir" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] Building N-API addon (node-gyp)..." -ForegroundColor Cyan
$npmExe = (Get-Command npm.cmd -ErrorAction Stop).Source
Push-Location $root
try {
    & $npmExe 'run' 'build:napi'
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm run build:napi failed" -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path $releaseDir)) {
    Write-Host "ERROR: Expected build output folder not found: $releaseDir" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/3] Copying artifacts to dist/NativeLibremon_NAPI" -ForegroundColor Cyan
if (Test-Path $distDir) {
    Remove-Item $distDir -Recurse -Force
}
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

Copy-Item -Path (Join-Path $releaseDir '*') -Destination $distDir -Recurse -Force

Write-Host "  Copied contents from $releaseDir" -ForegroundColor Gray

# Copy JavaScript entrypoint (adjust require path for dist layout)
$entrySrc = Join-Path $projectDir "lib\index.js"
if (Test-Path $entrySrc) {
    $entryContent = Get-Content $entrySrc -Raw
    $entryContent = $entryContent -replace "\.\./build/Release/librehardwaremonitor_native\.node", "./librehardwaremonitor_native.node"
    $entryDest = Join-Path $distDir "index.js"
    Set-Content -Path $entryDest -Value $entryContent -Encoding UTF8
    Write-Host "  Added JavaScript entrypoint: $entryDest" -ForegroundColor Gray
} else {
    Write-Host "WARNING: JavaScript entrypoint not found at $entrySrc" -ForegroundColor Yellow
}

if ($Prune) {
    Write-Host ""
    Write-Host "[3/3] Pruning optional artifacts" -ForegroundColor Cyan
    Push-Location $root
    try {
        node (Join-Path $root "scripts\prune-dist-napi.js")
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "[3/3] Skipping prune (use -Prune to trim dist)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "N-API build complete. Artifacts in $distDir" -ForegroundColor Green
