@echo off
title iTasks Cloudflare Tunnel
echo ==================================================
echo Starting Cloudflare Public Tunnel for iTasks...
echo Forwarding to: http://127.0.0.1:8000
echo.
echo NOTE: Each time this script runs, Cloudflare creates
echo a BRAND NEW LINK below ending in: .trycloudflare.com
echo.
echo Look below, copy the NEW link, and share it!
echo Keep this window open during your survey.
echo ==================================================
echo.

"%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:8000
pause
