@echo off
title Mot de passe - Editeur Portfolio
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0set-password.ps1"
