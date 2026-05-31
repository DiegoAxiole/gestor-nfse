@echo off
setlocal enabledelayedexpansion

title INICIANDO - GESTOR NFSe

set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%
set BACKEND=%REPO_ROOT%\backend
set FRONTEND=%REPO_ROOT%\frontend
set TOOLS=%REPO_ROOT%\.tools
set NODE_DIR=%TOOLS%\node-v22.14.0-win-x64

:: Adiciona Node portátil ao PATH se existir
if exist "%NODE_DIR%\node.exe" set PATH=%NODE_DIR%;%PATH%

cls
echo.
echo ============================================
echo        INICIANDO GESTOR NFSe
echo ============================================
echo.

:: Iniciar backend
echo   Iniciando backend...
start "Backend" /D "%BACKEND%" cmd /c "title Backend NFSe & uv run uvicorn main:app --host 127.0.0.1 --port 8001"

:: Iniciar frontend
echo   Iniciando frontend...
start "Frontend" /D "%FRONTEND%" cmd /c "title Frontend NFSe & npm run dev"

:: Aguardar backend
echo   Aguardando backend...
:wait_backend
  curl.exe -s -o nul http://127.0.0.1:8001/health 2>nul
  if !errorlevel! equ 0 goto backend_ok
  ping -n 2 127.0.0.1 >nul
  goto wait_backend
:backend_ok
echo   OK backend ^(http://localhost:8001^)

:: Aguardar frontend
echo   Aguardando frontend...
:wait_frontend
  curl.exe -s -o nul http://127.0.0.1:3000 2>nul
  if !errorlevel! equ 0 goto frontend_ok
  ping -n 2 127.0.0.1 >nul
  goto wait_frontend
:frontend_ok
echo   OK frontend ^(http://localhost:3000^)

:: Abrir navegador
start "" http://localhost:3000

echo.
echo ============================================
echo        SERVIDORES INICIADOS!
echo ============================================
echo.
echo   Backend:  http://localhost:8001
echo   Frontend: http://localhost:3000
echo.
echo   Documentacao API: http://localhost:8001/docs
echo.
echo   Para parar, feche as janelas "Backend" e "Frontend"
echo   ou pressione Ctrl+C neste terminal.
echo.
echo ============================================
echo.
pause

:end
endlocal
