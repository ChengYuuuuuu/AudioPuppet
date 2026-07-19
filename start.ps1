param(
    [switch]$NoExpress,
    [switch]$NoNetease
)

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  对口型是不对的 - 一键启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Python backend (port 8001)
Write-Host "[1/4] Starting Python backend (FastAPI) ..." -ForegroundColor Yellow
$psCmd = "cd '$RootDir\backend'; python server.py"
Start-Process -WindowStyle Minimized -FilePath powershell -ArgumentList "-NoExit", "-Command", $psCmd

# Express server (port 3001) - optional
if (-not $NoExpress) {
    Write-Host "[2/4] Starting Express server ..." -ForegroundColor Cyan
    $psCmd = "cd '$RootDir\server'; node index.js"
    Start-Process -WindowStyle Minimized -FilePath powershell -ArgumentList "-NoExit", "-Command", $psCmd
}

# Netease Music API (port 3000) - optional
if (-not $NoNetease) {
    Write-Host "[3/4] Starting Netease Music API ..." -ForegroundColor Green
    $psCmd = "cd '$RootDir'; npx NeteaseCloudMusicApi@latest"
    Start-Process -WindowStyle Minimized -FilePath powershell -ArgumentList "-NoExit", "-Command", $psCmd
}

# Vite frontend (port 5173, stays in this window)
Write-Host "[4/4] Starting Vite dev server ..." -ForegroundColor Magenta
Write-Host ""
Write-Host "All services started! Press Ctrl+C to stop the frontend." -ForegroundColor Green
Write-Host "  Backend  : http://localhost:8001" -ForegroundColor Yellow
Write-Host "  Express  : http://localhost:3001" -ForegroundColor Cyan
Write-Host "  NCM      : http://localhost:3000" -ForegroundColor Green
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Magenta
Write-Host ""
npm --prefix "$RootDir" run dev
