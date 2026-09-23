@echo off
rem School System Workshop - double-click to start.
rem Makes each school's installer on this computer.
title School System Workshop
cd /d "%~dp0"

echo.
echo   School System Workshop
echo   ======================
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 goto oldnode

if exist "node_modules\electron\dist\electron.exe" if exist "node_modules\electron-builder\cli.js" goto ready
echo   First start: downloading the build tools.
echo   This needs the internet and takes 5 to 15 minutes. It only happens once.
echo.
call npm install --no-audit --no-fund
if errorlevel 1 goto installfailed
if not exist "node_modules\electron\dist\electron.exe" goto installfailed

:ready
echo.
echo   Starting. Your browser will open the workshop page.
echo   Keep this window open while you work. Close it when you are done.
echo.
node scripts\builder\server.mjs --open
echo.
pause
exit /b 0

:nonode
echo   Node.js is not installed on this computer.
echo.
echo   1. Your browser will open the Node.js download page.
echo   2. Download the "LTS" version for Windows and install it
echo      (click Next on every screen).
echo   3. Then double-click this file again.
echo.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:oldnode
echo   The Node.js on this computer is too old. Version 20 or newer is needed.
echo   Install the "LTS" version from https://nodejs.org and try again.
echo.
start "" "https://nodejs.org/en/download"
pause
exit /b 1

:installfailed
echo.
echo   The build tools could not be downloaded.
echo   Check the internet connection and double-click this file again.
echo   If it keeps failing, send a photo of this window.
echo.
pause
exit /b 1
