@echo off
setlocal enabledelayedexpansion

title SETUP - GESTOR NFSe

set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%
set BACKEND=%REPO_ROOT%\backend
set FRONTEND=%REPO_ROOT%\frontend

:: Check tools
set HAS_NODE=0
node --version >nul 2>&1 && set HAS_NODE=1
set HAS_UV=0
uv --version >nul 2>&1 && set HAS_UV=1
set HAS_PYTHON=0
if !HAS_UV! equ 1 (
  uv python find 3.12 >nul 2>&1 && set HAS_PYTHON=1
)

cls
echo.
echo ============================================
echo        SETUP - GESTOR NFSe
echo ============================================
echo.
echo Ferramentas:
if !HAS_NODE! equ 1 (echo   Node.js: OK) else (echo   Node.js: ausente)
if !HAS_UV! equ 1 (echo   uv:      OK) else (echo   uv:      ausente)
if !HAS_PYTHON! equ 1 (echo   Python:  OK) else (echo   Python:  ausente)
echo.

if !HAS_NODE! equ 0 goto install_node
:check_uv
if !HAS_UV! equ 0 goto install_uv
:check_python
if !HAS_PYTHON! equ 0 goto install_python
goto backend_setup

:install_node
echo -- INSTALANDO NODE.JS --
curl.exe -# -L -o "%TEMP%\node-install.msi" "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
echo   Instalando...
start /wait msiexec /i "%TEMP%\node-install.msi" /quiet /norestart
del "%TEMP%\node-install.msi" 2>nul
set HAS_NODE=0
for /l %%i in (1,1,30) do (
  node --version >nul 2>&1 && set HAS_NODE=1 && goto install_node_ok
  ping -n 2 127.0.0.1 >nul
)
:install_node_ok
if !HAS_NODE! equ 1 (echo   OK Node.js instalado) else (echo   ERRO: Node.js nao instalado)
goto check_uv

:install_uv
echo -- INSTALANDO uv --
curl.exe -# -L -o "%TEMP%\uv.zip" "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
echo   Extraindo...
if exist "%TEMP%\uv-extract" rmdir /s /q "%TEMP%\uv-extract"
mkdir "%TEMP%\uv-extract" >nul 2>&1
tar -xf "%TEMP%\uv.zip" -C "%TEMP%\uv-extract"
del "%TEMP%\uv.zip" 2>nul
for /f "delims=" %%f in ('dir /s /b "%TEMP%\uv-extract\uv.exe"') do set UV_EXE=%%f
if not exist "%USERPROFILE%\.local\bin" mkdir "%USERPROFILE%\.local\bin"
copy /y "!UV_EXE!" "%USERPROFILE%\.local\bin\uv.exe" >nul
rmdir /s /q "%TEMP%\uv-extract"
set PATH=%USERPROFILE%\.local\bin;%PATH%
set HAS_UV=0
uv --version >nul 2>&1 && set HAS_UV=1 && echo   OK uv instalado || echo   ERRO: uv nao instalado
goto check_python

:install_python
echo -- INSTALANDO PYTHON 3.12 --
uv python install 3.12
echo   OK Python 3.12
goto backend_setup

:backend_setup
echo.
echo -- BACKEND --
echo   Instalando dependencias Python...
pushd "%BACKEND%" && uv sync && popd
if exist "%BACKEND%\.venv" (echo   OK) else (echo   OK)

:frontend_setup
echo.
echo -- FRONTEND --
if not exist "%FRONTEND%\node_modules" (
  echo   Instalando dependencias Node...
  pushd "%FRONTEND%" && npm install --no-progress && popd
  echo   OK
) else (echo   OK node_modules)

:build
echo.
echo -- BUILD --
if not exist "%BACKEND%\dist\index.html" (
  echo   Compilando frontend...
  pushd "%FRONTEND%" && npm run build && popd
  echo   OK
) else (echo   OK build)

echo.
echo ============================================
echo        SETUP CONCLUIDO!
echo ============================================
echo Execute start.bat
echo.
pause
