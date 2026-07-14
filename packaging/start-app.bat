@echo off
setlocal
cd /d "%~dp0"
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-local.ps1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"
endlocal
