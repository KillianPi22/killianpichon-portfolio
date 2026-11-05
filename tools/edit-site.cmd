@echo off
title Editeur de contenu - Portfolio Killian Pichon
cd /d "%~dp0"

echo.
echo   Demarrage de l'editeur de contenu...
echo.
echo   Pour activer l'acces iPhone, lance setup-wifi.cmd une seule fois.
echo   Ensuite, garde l'editeur ouvert et utilise l'adresse iPhone affichee.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*

if errorlevel 1 (
  echo.
  echo   Le serveur s'est arrete sur une erreur.
  pause
)
