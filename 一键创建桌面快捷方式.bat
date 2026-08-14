@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Creating desktop shortcut...
powershell -ExecutionPolicy Bypass -File "create_shortcut.ps1"
if %errorlevel%==0 (
    echo.
    echo ========================================
    echo   Desktop shortcut created successfully!
    echo   Name: GuDingZiChanGuanLiXiTong
    echo   Location: Desktop
    echo ========================================
) else (
    echo.
    echo   Failed to create shortcut
)
echo.
ping 127.0.0.1 -n 4 >nul
