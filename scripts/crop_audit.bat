@echo off
chcp 65001 >nul
title 油菜小麦面积核对插件

echo ================================================
echo      油菜小麦面积核对插件
echo ================================================
echo.

REM 检查Python
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Python，请先安装Python
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 安装依赖
pip show openpyxl >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖...
    pip install openpyxl
)

REM 运行脚本
python "%~dp0crop_audit.py"

echo.
pause
