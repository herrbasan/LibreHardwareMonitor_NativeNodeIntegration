param(
    [string[]] $flags = @("cpu","gpu"),
    [string] $exePath = "dist\LibreMonCLI.exe"
)

# Build the init JSON with provided flags
$init = @{ cmd = 'init'; flags = $flags; flat = $false } | ConvertTo-Json -Compress
$poll = @{ cmd = 'poll' } | ConvertTo-Json -Compress
$shutdown = @{ cmd = 'shutdown' } | ConvertTo-Json -Compress

$input = @($init, $poll, $shutdown) -join "`n"

Write-Host "Running daemon with flags: $($flags -join ', ')" -ForegroundColor Cyan

# Execute daemon and capture combined stdout+stderr
$raw = $input | & $exePath --daemon 2>&1

# Split into lines and find the poll response (line that contains "\"timestamp\":")
$lines = $raw -split "`n"
$pollLine = $lines | Where-Object { $_ -match '"timestamp":' } | Select-Object -First 1
if (-not $pollLine) {
    Write-Host "Poll response not found in output" -ForegroundColor Red
    Write-Host "Full output:`n$raw"
    exit 2
}

# Parse JSON
try {
    $pollObj = $pollLine | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Host "Failed to parse poll JSON: $_" -ForegroundColor Red
    exit 3
}

# Extract hardware ids under the machine root (safer than matching display names)
$hardwareIds = @()
$hardwareNames = @()
try {
    $rootChildren = $pollObj.data.children
    foreach ($root in $rootChildren) {
        foreach ($machine in $root.children) {
            if ($machine.children) {
                foreach ($hw in $machine.children) {
                    if ($hw.id) { $hardwareIds += ($hw.id.ToString().ToLower()) }
                    if ($hw.text) { $hardwareNames += $hw.text }
                }
            }
        }
    }
} catch {
    Write-Host "Unexpected JSON structure: $_" -ForegroundColor Yellow
}

Write-Host "Detected hardware names: $($hardwareNames -join ', ')" -ForegroundColor Green
Write-Host "Detected hardware ids: $($hardwareIds -join ', ')" -ForegroundColor Green

# Use id-based matchers for groups to avoid false positives
$groupChecks = @{
    cpu = @('/cpu','/intelcpu')
    gpu = @('/gpu')
    memory = @('/ram','/vram','memory')
    storage = @('physicaldrive','/storage','/disk')
    network = @('/nic','ethernet','wlan','vethernet')
    motherboard = @('/motherboard')
}

$failures = 0
foreach ($group in $groupChecks.Keys) {
    $enabled = $flags -contains $group
    if (-not $enabled) {
        foreach ($matcher in $groupChecks[$group]) {
            if ($hardwareIds -match $matcher) {
                Write-Host "ERROR: Hardware matching disabled group '$group' found (id matcher='$matcher')" -ForegroundColor Red
                $failures++
                break
            }
        }
    }
}

if ($failures -eq 0) {
    Write-Host "Verification passed: disabled groups were not polled." -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Verification failed: $failures unexpected hardware occurrences found." -ForegroundColor Red
    exit 1
}
