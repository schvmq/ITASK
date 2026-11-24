@echo off
title iTasks Stopper
echo ====================================================
echo Stopping iTasks System...
echo ====================================================

echo Stopping Cloudflare tunnel...
taskkill /F /IM cloudflared.exe >nul 2>&1

echo Stopping Laravel backend...
taskkill /F /IM php.exe >nul 2>&1

echo Stopping Docker database...
cd /d "%~dp0"
docker compose down

echo.
echo ====================================================
echo All iTasks servers and containers have been stopped.
echo ====================================================
pause
