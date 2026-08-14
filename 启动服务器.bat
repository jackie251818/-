@echo off
chcp 65001 >nul
title 电脑固定资产管理系统 - 服务器

echo ============================================
echo   电脑固定资产管理系统 v2.4
echo   正在启动本地服务器...
echo ============================================
echo.

REM 检查 Node.js 是否已安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 检查依赖是否已安装
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo.
)

REM 启动服务器
echo [信息] 服务器将在 http://localhost:8000 启动
echo [信息] 启动成功后，请在浏览器中访问上述地址
echo [信息] 按 Ctrl+C 停止服务器
echo.

node simple_server.js

pause
