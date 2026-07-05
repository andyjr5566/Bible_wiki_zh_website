@echo off
setlocal

set "SCRIPT=%~dp0sync_content.ps1"

if not exist "%SCRIPT%" (
    echo Missing script: %SCRIPT%
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
exit /b %ERRORLEVEL%
