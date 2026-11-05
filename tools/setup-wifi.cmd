@echo off
title Autorisation Wi-Fi - Editeur Portfolio
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-wifi.ps1" %*
echo.
pause
