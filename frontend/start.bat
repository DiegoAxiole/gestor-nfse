@echo off
title NFSe Frontend (Vite)
echo ========================================
echo   Iniciando servidor frontend NFSe
echo   http://localhost:3000
echo ========================================
echo.
npx vite --port=3000 --host=0.0.0.0
pause
