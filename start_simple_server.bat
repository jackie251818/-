@echo off
REM 简单的HTTP服务器启动脚本
REM 使用Python的内置http.server模块启动服务器

REM 检查Python是否可用
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Python。请确保Python已正确安装并添加到系统PATH中。
    pause
    exit /b 1
)

REM 启动HTTP服务器在端口8000
python -m http.server 8000

pause