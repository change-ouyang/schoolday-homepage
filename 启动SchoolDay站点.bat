@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   SchoolDay 工具箱本地预览
echo ========================================
echo.
echo 正在启动本地服务器...
echo 访问地址: http://localhost:8000/
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

cd /d "%~dp0"
start http://localhost:8000/
python -m http.server 8000
