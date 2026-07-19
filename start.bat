@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   对口型是不对的 - 一键启动脚本
echo ========================================
echo.

REM Python backend (port 8001)
echo [1/4] Starting Python backend (FastAPI) ...
start "Backend" /min cmd /c "cd /d "%~dp0backend" && python server.py"

REM Express server (port 3001)
echo [2/4] Starting Express server ...
start "Express" /min cmd /c "cd /d "%~dp0server" && node index.js"

REM Netease Music API (port 3000)
echo [3/4] Starting Netease Music API ...
start "NCM" /min cmd /c "npx NeteaseCloudMusicApi@latest"

REM Vite frontend (port 5173, stays in this window)
echo [4/4] Starting Vite dev server ...
echo.
echo All services started! Press Ctrl+C to stop the frontend.
echo   Backend  : http://localhost:8001
echo   Express  : http://localhost:3001
echo   NCM      : http://localhost:3000
echo   Frontend : http://localhost:5173
echo.
npx vite
pause
