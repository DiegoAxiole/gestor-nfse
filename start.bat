@echo off
setlocal enabledelayedexpansion

title INICIANDO GESTOR NFSe

set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%
set BACKEND=%REPO_ROOT%\backend
set FRONTEND=%REPO_ROOT%\frontend

set HAS_UV=0
uv --version >nul 2>&1 && set HAS_UV=1

cls
echo.
echo ============================================
echo        INICIANDO GESTOR NFSe
echo ============================================
echo.

if !HAS_UV! equ 0 goto install_uv
goto check_deps

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
uv --version >nul 2>&1 && echo   OK uv instalado || echo   ERRO: uv nao instalado

:check_deps
if not exist "%BACKEND%\.venv" goto install_backend
if not exist "%FRONTEND%\node_modules" goto install_frontend
if not exist "%BACKEND%\dist\index.html" goto build
goto start_servers

:install_backend
echo -- BACKEND: Dependencias --
echo   Instalando Python...
pushd "%BACKEND%" && uv sync && popd
echo   OK

:install_frontend
if not exist "%FRONTEND%\node_modules" (
  echo -- FRONTEND: Dependencias --
  echo   Instalando Node...
  pushd "%FRONTEND%" && npm install --no-progress && popd
  echo   OK
)

:build
if not exist "%BACKEND%\dist\index.html" (
  echo -- BUILD --
  echo   Compilando frontend...
  pushd "%FRONTEND%" && npm run build && popd
  echo   OK
)

:start_servers
echo.
echo Iniciando servidores...
echo.

start /MIN "Backend" cmd /c "cd /d "%BACKEND%" && uv run uvicorn main:app --host 127.0.0.1 --port 8001"
start /MIN "Frontend" cmd /c "cd /d "%FRONTEND%" && npm run dev"

echo   Aguardando backend...
:wait_backend
curl.exe -s -o nul http://127.0.0.1:8001 2>nul
if !errorlevel! equ 0 goto backend_ok
ping -n 2 127.0.0.1 >nul
goto wait_backend
:backend_ok
echo   OK backend

echo   Aguardando frontend...
:wait_frontend
curl.exe -s -o nul http://127.0.0.1:3000 2>nul
if !errorlevel! equ 0 goto frontend_ok
ping -n 2 127.0.0.1 >nul
goto wait_frontend
:frontend_ok
echo   OK frontend

start "" http://localhost:3000

echo.
echo ============================================
echo        SERVIDORES INICIADOS!
echo ============================================
echo   Backend:  http://localhost:8001
echo   Frontend: http://localhost:3000
echo.
