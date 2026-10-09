@echo off
title Stability Analysis Dashboard
cd /d "%~dp0"
echo.
echo   Stability Analysis Management Dashboard
echo   ---------------------------------------
echo   Starting server... KEEP THIS WINDOW OPEN.
echo   The browser will open at http://localhost:4173 in a few seconds.
echo   Press Ctrl + C (or close this window) to stop.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:4173"
node serve.js
pause
