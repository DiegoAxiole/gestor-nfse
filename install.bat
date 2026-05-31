@echo off
setlocal enabledelayedexpansion

title INSTALADOR - GESTOR NFSe

set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%
set BACKEND=%REPO_ROOT%\backend
set FRONTEND=%REPO_ROOT%\frontend
set TOOLS=%REPO_ROOT%\.tools
set NODE_VER=22.14.0
set NODE_DIR=%TOOLS%\node-v%NODE_VER%-win-x64
set UV_BIN=%USERPROFILE%\.local\bin

:: ========
cls
echo.
echo ============================================
echo       INSTALADOR - GESTOR NFSe
echo ============================================
echo.
echo Isso vai instalar tudo que eh necessario e
echo iniciar o servidor automaticamente.
echo.
echo   Node.js %NODE_VER%  ^(portatil, nao precisa de admin^)
echo   Python 3.12        ^(via uv^)
echo   Dependencias do backend e frontend
echo.
echo Acompanhe o progresso abaixo:
echo ============================================
echo.

:: ======== DETECTAR FERRAMENTAS EXISTENTES ========
set HAS_NODE=0
node --version >nul 2>&1 && set HAS_NODE=1
set HAS_UV=0
uv --version >nul 2>&1 && set HAS_UV=1
set HAS_PYTHON=0
if !HAS_UV! equ 1 (
  uv python find 3.12 >nul 2>&1 && set HAS_PYTHON=1
)

:: ======== FUNCAO: DOWNLOAD COM FALLBACK ========
goto :main

:download
  set DL_URL=%~1
  set DL_DEST=%~2
  set DL_LABEL=%~3
  echo   Baixando !DL_LABEL!...
  curl.exe -# -L -o "!DL_DEST!" "!DL_URL!"
  if !errorlevel! neq 0 (
    echo   curl falhou, tentando PowerShell...
    powershell -Command "Invoke-WebRequest -Uri '!DL_URL!' -OutFile '!DL_DEST!' -UseBasicParsing"
    if !errorlevel! neq 0 (
      echo   ERRO: Nao foi possivel baixar !DL_LABEL!
      echo   Verifique sua conexao com a internet.
      pause
      exit /b 1
    )
  )
  echo   OK download !DL_LABEL!
exit /b 0

:main

:: ======== 1. INSTALL uv ========
if !HAS_UV! equ 0 (
  echo.
  echo -- INSTALANDO uv --
  call :download "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip" "%TEMP%\uv.zip" "uv"
  if !errorlevel! neq 0 pause & exit /b 1
  echo   Extraindo...
  if exist "%TEMP%\uv-extract" rmdir /s /q "%TEMP%\uv-extract"
  mkdir "%TEMP%\uv-extract" >nul 2>&1
  tar -xf "%TEMP%\uv.zip" -C "%TEMP%\uv-extract" >nul 2>&1
  del "%TEMP%\uv.zip" 2>nul
  for /f "delims=" %%f in ('dir /s /b "%TEMP%\uv-extract\uv.exe"') do set UV_EXE=%%f
  if not exist "%UV_BIN%" mkdir "%UV_BIN%"
  copy /y "!UV_EXE!" "%UV_BIN%\uv.exe" >nul
  rmdir /s /q "%TEMP%\uv-extract"
  set PATH=%UV_BIN%;%PATH%
  set HAS_UV=1
  uv --version >nul 2>&1 && echo   OK uv instalado || echo   ERRO: uv nao instalado
) else (
  echo   uv ja instalado
)

:: ======== 2. INSTALL NODE.JS (PORTATIL) ========
if !HAS_NODE! equ 0 (
  if not exist "%NODE_DIR%\node.exe" (
    echo.
    echo -- INSTALANDO NODE.JS %NODE_VER% --
    if not exist "%TOOLS%" mkdir "%TOOLS%"
    call :download "https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip" "%TEMP%\node.zip" "Node.js"
    if !errorlevel! neq 0 pause & exit /b 1
    echo   Extraindo...
    tar -xf "%TEMP%\node.zip" -C "%TOOLS%" >nul 2>&1
    del "%TEMP%\node.zip" 2>nul
    if exist "!NODE_DIR!\node.exe" (
      echo   OK Node.js !NODE_VER! instalado em .tools\
    ) else (
      echo   ERRO: Falha ao extrair Node.js
      pause
      exit /b 1
    )
  )
  set PATH=%NODE_DIR%;%PATH%
  set HAS_NODE=1
) else (
  echo   Node.js ja instalado no sistema
)

:: ======== 3. INSTALL PYTHON ========
if !HAS_PYTHON! equ 0 (
  echo.
  echo -- INSTALANDO PYTHON 3.12 --
  uv python install 3.12
  if !errorlevel! equ 0 (
    echo   OK Python 3.12
    set HAS_PYTHON=1
  ) else (
    echo   ERRO: Falha ao instalar Python 3.12
    pause
    exit /b 1
  )
) else (
  echo   Python 3.12 ja instalado
)

:: ======== 4. BACKEND DEPS ========
echo.
echo -- BACKEND --
if not exist "%BACKEND%\.venv" (
  echo   Instalando dependencias Python...
  pushd "%BACKEND%" && uv sync && popd
  if !errorlevel! equ 0 (echo   OK) else (echo   ERRO & pause & exit /b 1)
) else (
  echo   .venv ja existe
  pushd "%BACKEND%" && uv sync && popd
)

:: ======== 5. FRONTEND DEPS ========
echo.
echo -- FRONTEND --
if not exist "%FRONTEND%\node_modules" (
  echo   Instalando dependencias Node...
  pushd "%FRONTEND%" && npm install --no-progress && popd
  if !errorlevel! equ 0 (echo   OK) else (echo   ERRO & pause & exit /b 1)
) else (
  echo   node_modules ja existe
)

:: ======== 6. BUILD ========
echo.
echo -- BUILD --
if not exist "%BACKEND%\dist\index.html" (
  echo   Compilando frontend...
  pushd "%FRONTEND%" && npm run build && popd
  if !errorlevel! equ 0 (echo   OK) else (echo   ERRO & pause & exit /b 1)
) else (
  echo   Build ja existe
)

:: ======== 7. INICIAR SERVERS ========
echo.
echo ============================================
echo        INSTALACAO CONCLUIDA!
echo ============================================
echo.
echo Iniciando servidores...
echo.

set UV_PATH=%UV_BIN%\uv.exe
set NODE_EXE=%NODE_DIR%\node.exe
set NPM_CMD=%NODE_DIR%\npm.cmd
if not exist "!UV_PATH!" set UV_PATH=uv.exe
if not exist "!NPM_CMD!" set NPM_CMD=npm.cmd

start "Backend" cmd /c "PATH=%UV_BIN%;%NODE_DIR%;%PATH% & cd /d "%BACKEND%" & title Backend NFSe & "%UV_PATH%" run uvicorn main:app --host 127.0.0.1 --port 8001"

start "Frontend" cmd /c "PATH=%UV_BIN%;%NODE_DIR%;%PATH% & cd /d "%FRONTEND%" & title Frontend NFSe & "%NPM_CMD%" run dev"

:: ======== 8. AGUARDAR SERVERS ========
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

:: ======== 9. ABRIR NAVEGADOR ========
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

:end
endlocal
