@echo off
setlocal
cd /d "%~dp0"
start "职业标准能力图谱生成器" powershell -ExecutionPolicy Bypass -File "%~dp0run-local.ps1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"
endlocal
