@echo off
chcp 65001 > nul
title 抖音小程序后端服务器 - 带日志监控
cls

echo ==================== 抖音小程序后端服务器 ====================
echo.
echo 正在启动服务器（带日志监控）...
echo 服务器将在端口3090运行
echo 日志文件: logs/combined.log
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

cd /d "%~dp0"

:: 启动服务器并在后台运行
start /b node app.js

:: 等待2秒让服务器启动
timeout /t 2 /nobreak > nul

:: 实时显示日志
echo 开始监控日志文件...
echo ========================================
powershell Get-Content logs/combined.log -Wait

pause 