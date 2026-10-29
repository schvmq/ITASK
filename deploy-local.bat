@echo off
REM ==============================================================================
REM ITASK 1-Click Direct Deployment Script (Windows CMD)
REM Deploys directly to your production VPS without pushing to GitHub.
REM ==============================================================================

echo [ITASK] Starting Direct Production Deployment...

REM 1. Check if git remote 'production' exists
git remote | findstr /C:"production" >nul
if %errorlevel% neq 0 (
    echo [ERROR] Git remote 'production' is not configured yet.
    echo Please run: git remote add production username@YOUR_SERVER_IP:/var/repo/itask.git
    pause
    exit /b 1
)

REM 2. Commit any pending local changes if desired, or push current branch
echo [ITASK] Pushing latest code directly to production remote...
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i

echo Deploying branch: %CURRENT_BRANCH% to production...
git push production %CURRENT_BRANCH%:main

if %errorlevel% equ 0 (
    echo.
    echo ==============================================================================
    echo [SUCCESS] Successfully deployed to production server!
    echo Docker database and latest changes are live.
    echo ==============================================================================
) else (
    echo.
    echo [ERROR] Deployment push failed. Check your SSH connection and permissions.
)

pause
