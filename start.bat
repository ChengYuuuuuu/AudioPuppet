@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   对口型是不对的 - 一键启动脚本
echo ========================================
echo.

REM Python backend (port 8001)
echo [1/3] Starting Python backend (FastAPI) ...
start "Backend" /min cmd /c "cd /d "%~dp0backend" && python server.py"

REM Netease Music API (port 3000)
echo [2/3] Starting Netease Music API ...
start "NCM" /min cmd /c "npx NeteaseCloudMusicApi@latest"

REM Vite frontend (port 5173, stays in this window)
echo [3/3] Starting Vite dev server ...
echo.
echo All services started! Press Ctrl+C to stop the frontend.
echo   Backend  : http://localhost:8001
echo   NCM      : http://localhost:3000
echo   Frontend : http://localhost:5173
echo.
npx vite
pause
