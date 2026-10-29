@echo off
title iTasks Launcher
echo ====================================================
echo Starting iTasks System...
echo ====================================================

echo [1/3] Starting Docker Database (PostgreSQL)...
cd /d "%~dp0"
docker compose up -d

echo [2/3] Launching Laravel Backend (Port 8000)...
start "iTasks Backend" cmd /k "cd /d "%~dp0backend" && php artisan serve"

echo [3/3] Launching Cloudflare Public Tunnel...
timeout /t 3 >nul
start "iTasks Cloudflare Tunnel" cmd /k "cd /d "%~dp0" && "%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:8000"

echo.
echo ====================================================
echo SUCCESS!
echo.
echo 1. Look at the new "iTasks Cloudflare Tunnel" window.
echo 2. Find the line:
echo    https://xxxx-xxxx-xxxx.trycloudflare.com
echo 3. Open that link on your PHONE!
echo.
echo Keep the backend and tunnel windows OPEN while testing.
echo ====================================================
pause
