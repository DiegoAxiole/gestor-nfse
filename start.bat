@echo off
setlocal enabledelayedexpansion
title GESTOR NFSe

set "DIR=%~dp0"
set "BACKEND=%DIR%backend"
set "TOOLS=%DIR%.tools"
set NODE_VER=22.22.3
set NODE_DIR=%TOOLS%\node-v%NODE_VER%-win-x64

goto :main

:download
  set DL_URL=%~1
  set DL_DEST=%~2
  set DL_LABEL=%~3
  echo   URL: !DL_URL!
  echo.
  echo   Tentando curl...
  curl.exe -# -f -L -o "!DL_DEST!" "!DL_URL!"
  if !errorlevel! neq 0 (
    echo.
    echo   curl falhou, tentando PowerShell...
    powershell -Command "try { Invoke-WebRequest -Uri '!DL_URL!' -OutFile '!DL_DEST!' -UseBasicParsing -ErrorAction Stop; write-host 'OK' } catch { write-host $_.Exception.Message; exit 1 }"
    if !errorlevel! neq 0 (
      echo.
      echo   PowerShell falhou, tentando bitsadmin...
      bitsadmin /transfer "NodeDownload" /download /priority high "!DL_URL!" "!DL_DEST!"
      if !errorlevel! neq 0 (
        cls
        echo ============================================
        echo        ERRO NO DOWNLOAD DO NODE.JS
        echo ============================================
        echo.
        echo   Todas as tentativas de download falharam.
        echo.
        echo   Baixe manualmente:
        echo   !DL_URL!
        echo.
        echo   Extraia para: %TOOLS%
        echo   Depois execute start.bat novamente.
        pause
        exit /b 1
      )
    )
  )
  if not exist "!DL_DEST!" (
    echo   ERRO: arquivo nao foi baixado
    pause
    exit /b 1
  )
  echo   OK
exit /b 0

:err
  echo.
  echo ============================================
  echo   ERRO: %~1
  echo ============================================
  echo.
  pause
  exit /b 1

:main
if not exist "%BACKEND%\package.json" (
  echo   ERRO: Pasta backend nao encontrada em %BACKEND%
  pause
  exit /b 1
)

node --version >nul 2>&1
if !errorlevel! equ 0 (
  set "NODE=node.exe"
  set "NPM=npm.cmd"
  set "NPX=npx.cmd"
  goto :install_deps
)

if exist "%NODE_DIR%\node.exe" (
  set "NODE=%NODE_DIR%\node.exe"
  set "NPM=%NODE_DIR%\npm.cmd"
  set "NPX=%NODE_DIR%\npx.cmd"
  goto :install_deps
)

cls
echo ============================================
echo     BAIXANDO NODE.JS %NODE_VER%
echo ============================================
echo.
echo   Tamanho: ~55 MB
echo.
if not exist "%TOOLS%" mkdir "%TOOLS%"
call :download "https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip" "%TEMP%\node.zip" "Node.js %NODE_VER%"
if errorlevel 1 exit /b 1
echo   Extraindo...
tar -xf "%TEMP%\node.zip" -C "%TOOLS%"
if !errorlevel! neq 0 (
  del "%TEMP%\node.zip" 2>nul
  call :err "Falha ao extrair Node.js"
)
del "%TEMP%\node.zip" 2>nul
if not exist "%NODE_DIR%\node.exe" (
  call :err "Node.exe nao encontrado apos extracao"
)
set "NODE=%NODE_DIR%\node.exe"
set "NPM=%NODE_DIR%\npm.cmd"
set "NPX=%NODE_DIR%\npx.cmd"

:install_deps
if exist "%BACKEND%\node_modules" goto :build_backend

echo.
echo ============================================
echo   INSTALANDO DEPENDENCIAS DO BACKEND
echo ============================================
echo.
echo   Primeira vez: pode levar 1-3 minutos
echo.
cd /d "%BACKEND%"
call "%NPM%" install
if errorlevel 1 (
  call :err "Falha ao instalar dependencias do backend"
)
echo.
echo   Gerando Prisma Client...
call "%NPX%" --yes prisma generate
if errorlevel 1 (
  call :err "Falha ao gerar Prisma Client"
)

:build_backend
if exist "%BACKEND%\dist\index.js" goto :build_frontend

echo.
echo ============================================
echo   COMPILANDO BACKEND (TypeScript)
echo ============================================
echo.
cd /d "%BACKEND%"
call "%NPX%" --yes tsc
if errorlevel 1 (
  call :err "Falha na compilacao TypeScript"
)

:build_frontend
if exist "%BACKEND%\public\index.html" goto :start_server
if not exist "%DIR%frontend\package.json" goto :start_server

echo.
echo ============================================
echo   INSTALANDO DEPENDENCIAS DO FRONTEND
echo ============================================
echo.
cd /d "%DIR%frontend"
call "%NPM%" install
if errorlevel 1 (
  call :err "Falha ao instalar dependencias do frontend"
)
echo.
echo ============================================
echo   COMPILANDO FRONTEND (Vite)
echo ============================================
echo.
call "%NPX%" --yes vite build
if errorlevel 1 (
  call :err "Falha na compilacao frontend"
)

:start_server
netstat -ano | findstr ":8001 " | findstr "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
  cls
  echo ============================================
  echo        PORTA 8001 JA EM USO
  echo ============================================
  echo.
  echo   Ja existe um servidor rodando em:
  echo   http://localhost:8001
  echo.
  pause
  exit /b 1
)

cls
echo ============================================
echo        GESTOR NFSe
echo ============================================
echo.
echo   Iniciando servidor em nova janela...
echo   Acessar: http://localhost:8001
echo ============================================
echo.

start "Gestor NFSe" "%NODE%" "%BACKEND%\dist\index.js"

ping -n 3 127.0.0.1 >nul
start "" http://localhost:8001

echo.
echo   Servidor iniciado!
echo.
echo   Pressione qualquer tecla para fechar.
pause
endlocal
