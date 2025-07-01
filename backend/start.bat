@echo off
chcp 65001 > nul
title 抖音小程序后端服务器
cls

echo ==================== 抖音小程序后端服务器 ====================
echo.
echo 正在启动服务器...
echo 服务器将在端口3090运行
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

cd /d "%~dp0"
node app.js

pause 