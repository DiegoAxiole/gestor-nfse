@echo off
setlocal enabledelayedexpansion

title INSTALADOR - GESTOR NFSe

set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%
set BACKEND=%REPO_ROOT%\backend
set FRONTEND=%REPO_ROOT%\frontend
set TOOLS=%REPO_ROOT%\.tools
set NODE_VER=24.16.0
set NODE_DIR=%TOOLS%\node-v%NODE_VER%-win-x64

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
echo   Dependencias do backend e frontend
echo.
echo Acompanhe o progresso abaixo:
echo ============================================
echo.

:: ======== DETECTAR FERRAMENTAS EXISTENTES ========
set HAS_NODE=0
node --version >nul 2>&1 && set HAS_NODE=1

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

:: ======== 1. INSTALL NODE.JS (PORTATIL) ========
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

:: ======== 2. BACKEND DEPS ========
echo.
echo [2/5] Backend --
pushd "%BACKEND%"
if not exist "node_modules" (
  echo   Instalando dependencias...
  call npm install --no-progress
) else (
  echo   npm install...
  call npm install --no-progress
)
if !errorlevel! equ 0 (echo   OK) else (echo   ERRO & popd & pause & exit /b 1)

popd

:: ======== 3. FRONTEND DEPS ========
echo.
echo [3/5] Frontend --
pushd "%FRONTEND%"
if not exist "node_modules" (
  echo   Instalando dependencias...
  call npm install --no-progress
) else (
  echo   npm install...
  call npm install --no-progress
)
if !errorlevel! equ 0 (echo   OK) else (echo   ERRO & popd & pause & exit /b 1)
popd

:: ======== 4. BUILD ========
echo.
echo [4/5] Build --
if not exist "%BACKEND%\dist\index.js" (
  echo   Compilando backend...
  pushd "%BACKEND%" && call npm run build && popd
  if !errorlevel! equ 0 (echo   OK) else (echo   ERRO & pause & exit /b 1)
) else (
  echo   Backend ja compilado
)

if not exist "%BACKEND%\public\index.html" (
  echo   Compilando frontend...
  pushd "%FRONTEND%" && call npm run build && popd
  if !errorlevel! equ 0 (echo   OK) else (echo   ERRO & pause & exit /b 1)
) else (
  echo   Frontend ja compilado
)

:: ======== 5. INICIAR SERVIDOR ========
echo.
echo ============================================
echo        INSTALACAO CONCLUIDA!
echo ============================================
echo.
echo Iniciando servidor...
echo.

set NODE_EXE=%NODE_DIR%\node.exe
if not exist "!NODE_EXE!" set NODE_EXE=node.exe

start "Gestor NFSe" cmd /c "title Gestor NFSe & "%NODE_EXE%" "%BACKEND%\dist\index.js""

:: ======== 6. AGUARDAR SERVIDOR ========
echo   Aguardando backend...
:wait_backend
  curl.exe -s -o nul http://127.0.0.1:8001/health 2>nul
  if !errorlevel! equ 0 goto backend_ok
  ping -n 2 127.0.0.1 >nul
  goto wait_backend
:backend_ok
echo   OK backend ^(http://localhost:8001^)

:: ======== 7. ABRIR NAVEGADOR ========
start "" http://localhost:8001

echo.
echo ============================================
echo        SERVIDOR INICIADO!
echo ============================================
echo.
echo   Backend + Frontend: http://localhost:8001
echo.
echo   Documentacao API: http://localhost:8001/docs
echo.
echo   Para parar, feche a janela "Gestor NFSe"
echo   ou pressione Ctrl+C neste terminal.
echo.
echo ============================================
echo.

:end
endlocal
