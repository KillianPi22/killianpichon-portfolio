@echo off
title Autorisation Wi-Fi - Editeur Portfolio
setlocal

rem A lancer UNE SEULE FOIS. Autorise l'editeur a ecouter sur le reseau local
rem pour que tu puisses ouvrir le site sur ton iPhone. Apres ca, edit-site.cmd
rem fonctionne en Wi-Fi sans avoir besoin des droits administrateur.

net session >nul 2>&1
if errorlevel 1 (
  echo   Elevation des privileges necessaire...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set PORT=8000

echo.
echo   Autorisation d'ecoute sur le port %PORT%...
netsh http add urlacl url=http://+:%PORT%/ user="%USERDOMAIN%\%USERNAME%" >nul 2>&1
if errorlevel 1 (
  echo   [i] Reservation deja presente ou non modifiee.
) else (
  echo   [ok] Reservation d'URL creee.
)

echo   Ouverture du port dans le pare-feu Windows...
netsh advfirewall firewall delete rule name="Portfolio editor %PORT%" >nul 2>&1
netsh advfirewall firewall add rule name="Portfolio editor %PORT%" dir=in action=allow protocol=TCP localport=%PORT% profile=private >nul 2>&1
if errorlevel 1 (
  echo   [!] Regle de pare-feu non creee.
) else (
  echo   [ok] Port %PORT% autorise sur les reseaux prives.
)

echo.
echo   Termine. Lance maintenant edit-site.cmd normalement :
echo   l'adresse iPhone s'affichera en haut a droite de l'editeur.
echo.
pause
