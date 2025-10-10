@echo off
echo 🚀 LibreMonCLI Performance Test - All Sensor Groups
echo ====================================================

echo.
echo 📊 Test 1: Initialization Performance
echo Measuring time to initialize all sensor groups...

powershell -Command "& { $start = Get-Date; echo '{\"cmd\":\"init\",\"flags\":[\"cpu\",\"gpu\",\"motherboard\",\"memory\",\"storage\",\"network\"]}' | .\dist\LibreMonCLI.exe --daemon 2>$null | Select-Object -Last 1; $end = Get-Date; Write-Host \"Init time: $(($end - $start).TotalMilliseconds)ms\" -ForegroundColor Green }"

echo.
echo 📊 Test 2: Polling Performance
echo Measuring poll latency over 3 iterations...

for /L %%i in (1,1,3) do (
    echo Poll %%i/3...
    powershell -Command "& { $start = Get-Date; (echo '{\"cmd\":\"init\",\"flags\":[\"cpu\",\"gpu\",\"motherboard\",\"memory\",\"storage\",\"network\"]}'; echo '{\"cmd\":\"poll\"}') | .\dist\LibreMonCLI.exe --daemon 2>$null | Select-Object -Last 1; $end = Get-Date; Write-Host \"Latency: $(($end - $start).TotalMilliseconds)ms\" -ForegroundColor Gray }"
)

echo.
echo ✅ Performance test completed!
pause