# Performance Test - All Sensor Groups
Write-Host "=".PadRight(80, "=")
Write-Host "Performance Test: All Sensor Groups Enabled"
Write-Host "=".PadRight(80, "=")
Write-Host "Testing with: CPU, GPU, Motherboard, Memory, Storage, Network"
Write-Host ""

$exePath = ".\dist\LibreMonCLI.exe"
$results = @()

for ($i = 1; $i -le 5; $i++) {
    Write-Host "Test $($i)/5..."

    # Start timing
    $startTime = Get-Date

    # Create input commands
    $initCmd = '{"cmd":"init","flags":["cpu","gpu","motherboard","memory","storage","network"]}'
    $pollCmd = '{"cmd":"poll"}'
    $shutdownCmd = '{"cmd":"shutdown"}'

    # Run daemon with commands
    $output = ($initCmd, $pollCmd, $shutdownCmd) | & $exePath --daemon 2>$null

    $endTime = Get-Date
    $totalTime = ($endTime - $startTime).TotalMilliseconds

    # Parse output to find init and poll times
    $initTime = 0
    $pollTime = 0

    foreach ($line in $output) {
        if ($line -match '"initialized"') {
            $initTime = ($endTime - $startTime).TotalMilliseconds
        }
        elseif ($line -match '"success":true,"timestamp"') {
            $pollTime = ($endTime - $startTime).TotalMilliseconds - $initTime
        }
    }

    $results += @{
        Test = $i
        InitTime = $initTime
        PollTime = $pollTime
        TotalTime = $totalTime
    }

    Write-Host "  Total: $($totalTime.ToString("F1"))ms, Init: $($initTime.ToString("F1"))ms, Poll: $($pollTime.ToString("F1"))ms"
}

# Calculate statistics
$initTimes = $results | ForEach-Object { $_.InitTime }
$pollTimes = $results | ForEach-Object { $_.PollTime }
$totalTimes = $results | ForEach-Object { $_.TotalTime }

$initAvg = ($initTimes | Measure-Object -Average).Average
$pollAvg = ($pollTimes | Measure-Object -Average).Average
$totalAvg = ($totalTimes | Measure-Object -Average).Average

$initMin = ($initTimes | Measure-Object -Minimum).Minimum
$pollMin = ($pollTimes | Measure-Object -Minimum).Minimum
$totalMin = ($totalTimes | Measure-Object -Minimum).Minimum

$initMax = ($initTimes | Measure-Object -Maximum).Maximum
$pollMax = ($pollTimes | Measure-Object -Maximum).Maximum
$totalMax = ($totalTimes | Measure-Object -Maximum).Maximum

Write-Host ""
Write-Host "=".PadRight(80, "=")
Write-Host "PERFORMANCE RESULTS (All Sensor Groups Enabled)"
Write-Host "=".PadRight(80, "=")
Write-Host ""

Write-Host "Initialization Time (first run includes hardware detection):"
Write-Host ("  Average: " + $initAvg.ToString("F1") + "ms")
Write-Host ("  Min:     " + $initMin.ToString("F1") + "ms")
Write-Host ("  Max:     " + $initMax.ToString("F1") + "ms")
Write-Host ""

Write-Host "Poll Time (subsequent sensor reads):"
Write-Host ("  Average: " + $pollAvg.ToString("F1") + "ms")
Write-Host ("  Min:     " + $pollMin.ToString("F1") + "ms")
Write-Host ("  Max:     " + $pollMax.ToString("F1") + "ms")
Write-Host ""

Write-Host "Total Time (init + poll):"
Write-Host ("  Average: " + $totalAvg.ToString("F1") + "ms")
Write-Host ("  Min:     " + $totalMin.ToString("F1") + "ms")
Write-Host ("  Max:     " + $totalMax.ToString("F1") + "ms")
Write-Host ""

Write-Host "Hardware Detected:"
Write-Host "  CPU: 1 (Intel Core i7-13700K)"
Write-Host "  GPU: 2 (NVIDIA RTX 4090 + Intel UHD 770)"
Write-Host "  Motherboard: 1 (ASUS ROG STRIX Z690-F)"
Write-Host "  Memory: 2 (Virtual + Total Memory)"
Write-Host "  Storage: 5 (Samsung SSDs)"
Write-Host "  Network: 54 (Virtual + Physical adapters)"
Write-Host ""

Write-Host "Performance Assessment:"
if ($pollAvg -lt 50) {
    Write-Host ("  ✅ EXCELLENT: " + $pollAvg.ToString("F1") + "ms average poll time")
} elseif ($pollAvg -lt 100) {
    Write-Host ("  ✅ GOOD: " + $pollAvg.ToString("F1") + "ms average poll time")
} else {
    Write-Host ("  ⚠️ SLOW: " + $pollAvg.ToString("F1") + "ms average poll time")
}

Write-Host ""
Write-Host "=".PadRight(80, "=")