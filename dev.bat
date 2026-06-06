@echo off
setlocal enabledelayedexpansion
title GESTOR NFSe - DEV

set "DIR=%~dp0"
set "BACKEND=%DIR%backend"
set "FRONTEND=%DIR%frontend"

:: Check node exists
where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale Node 22+.
    pause
    exit /b 1
)

:: Kill old processes on our ports
echo [DEV] Liberando portas...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Start backend (port 8001)
echo [DEV] Iniciando BACKEND (porta 8001)...
start "NFSe Backend" cmd /c "cd /d "%BACKEND%" && echo [BACKEND] npm run dev... && npm run dev"

:: Wait a moment for backend to start
ping -n 4 127.0.0.1 >nul

:: Start frontend (port 3000)
echo [DEV] Iniciando FRONTEND (porta 3000)...
start "NFSe Frontend" cmd /c "cd /d "%FRONTEND%" && echo [FRONTEND] npm run dev... && npm run dev"

:: Wait then open browser
ping -n 3 127.0.0.1 >nul

cls
echo ============================================
echo        GESTOR NFSe - MODO DEV
echo ============================================
echo.
echo   Backend  : http://localhost:8001
echo   Frontend : http://localhost:3000
echo.
echo   Para parar, feche as janelas abertas.
echo.
start "" http://localhost:3000
echo   Pressione qualquer tecla para continuar...
pause >nul
endlocal
