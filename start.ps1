param(
    [switch]$NoNetease
)

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  对口型是不对的 - 一键启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check ports
$ports = @(8001, 3000, 5173)
foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "[WARNING] Port $port is already in use!" -ForegroundColor Yellow
    }
}

# Python backend (port 8001)
Write-Host "[1/3] Starting Python backend (FastAPI) ..." -ForegroundColor Yellow
$psCmd = "cd '$RootDir\backend'; python server.py"
Start-Process -WindowStyle Minimized -FilePath powershell -ArgumentList "-NoExit", "-Command", $psCmd

# Netease Music API (port 3000) - optional
if (-not $NoNetease) {
    Write-Host "[2/3] Starting Netease Music API ..." -ForegroundColor Green
    $psCmd = "cd '$RootDir'; npx NeteaseCloudMusicApi@latest"
    Start-Process -WindowStyle Minimized -FilePath powershell -ArgumentList "-NoExit", "-Command", $psCmd
}

# Vite frontend (port 5173, stays in this window)
Write-Host "[3/3] Starting Vite dev server ..." -ForegroundColor Magenta
Write-Host ""
Write-Host "All services started! Press Ctrl+C to stop the frontend." -ForegroundColor Green
Write-Host "  Backend  : http://localhost:8001" -ForegroundColor Yellow
Write-Host "  NCM      : http://localhost:3000" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Magenta
Write-Host ""
npm --prefix "$RootDir" run dev
