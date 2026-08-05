@echo off
title Editeur de contenu - Portfolio Killian Pichon
cd /d "%~dp0"

echo.
echo   Demarrage de l'editeur de contenu...
echo.
echo   Pour tester sur iPhone via Wi-Fi, ferme cette fenetre et relance
echo   ce fichier avec un clic droit ^> "Executer en tant qu'administrateur".
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*

if errorlevel 1 (
  echo.
  echo   Le serveur s'est arrete sur une erreur.
  pause
)
