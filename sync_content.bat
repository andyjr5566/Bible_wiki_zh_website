@echo off
setlocal
echo ============================================================
echo   Bible Wiki ZH - Content Sync ^& Git Upload
echo ============================================================
echo.

set "SCRIPT=%~dp0sync_content.ps1"

if not exist "%SCRIPT%" (
    echo [ERROR] Missing script: %SCRIPT%
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
exit /b %ERRORLEVEL%
