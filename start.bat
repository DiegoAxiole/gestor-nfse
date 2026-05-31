@echo off
setlocal enabledelayedexpansion

title INICIANDO - GESTOR NFSe

set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%
set BACKEND=%REPO_ROOT%\backend
set FRONTEND=%REPO_ROOT%\frontend
set UV_BIN=%USERPROFILE%\.local\bin
set NODE_DIR=%REPO_ROOT%\.tools\node-v22.14.0-win-x64
set UV_PATH=%UV_BIN%\uv.exe
set NPM_CMD=%NODE_DIR%\npm.cmd
if not exist "%UV_PATH%" set UV_PATH=uv.exe
if not exist "%NPM_CMD%" set NPM_CMD=npm.cmd

cls
echo.
echo ============================================
echo        INICIANDO GESTOR NFSe
echo ============================================
echo.

echo   Iniciando backend...
start "Backend" cmd /c "PATH=%UV_BIN%;%NODE_DIR%;%PATH% & cd /d "%BACKEND%" & title Backend NFSe & "%UV_PATH%" run uvicorn main:app --host 127.0.0.1 --port 8001"

echo   Iniciando frontend...
start "Frontend" cmd /c "PATH=%UV_BIN%;%NODE_DIR%;%PATH% & cd /d "%FRONTEND%" & title Frontend NFSe & "%NPM_CMD%" run dev"

echo   Aguardando backend...
:wait_backend
  curl.exe -s -o nul http://127.0.0.1:8001/health 2>nul
  if !errorlevel! equ 0 goto backend_ok
  ping -n 2 127.0.0.1 >nul
  goto wait_backend
:backend_ok
echo   OK backend ^(http://localhost:8001^)

echo   Aguardando frontend...
:wait_frontend
  curl.exe -s -o nul http://127.0.0.1:3000 2>nul
  if !errorlevel! equ 0 goto frontend_ok
  ping -n 2 127.0.0.1 >nul
  goto wait_frontend
:frontend_ok
echo   OK frontend ^(http://localhost:3000^)

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
