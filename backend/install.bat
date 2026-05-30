@echo off
cd /d %~dp0
title NFSe API - Instalacao
echo ========================================
echo   NFSe API - Instalacao
echo ========================================
echo.

:: Detecta uv no PATH (instalado globalmente)
where uv.exe >nul 2>&1
if %errorlevel% equ 0 (
    set "UV_CMD=uv"
    echo [OK] uv encontrado no PATH
    goto :install_python
)

:: Detecta uv.exe baixado na mesma pasta
if exist "uv.exe" (
    set "UV_CMD=.\uv.exe"
    echo [OK] uv.exe encontrado na pasta
    goto :install_python
)

:: Baixa uv.exe via PowerShell (sempre disponivel no Windows)
echo [..] Baixando uv.exe...
PowerShell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip' -OutFile 'uv.zip'"
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao baixar uv.exe
    echo        Verifique sua conexao com a internet.
    pause
    exit /b 1
)

:: Extrai o zip
PowerShell -ExecutionPolicy Bypass -Command "Expand-Archive -Path 'uv.zip' -DestinationPath '.' -Force"
del "uv.zip"

if not exist "uv.exe" (
    echo [ERRO] uv.exe nao encontrado apos extracao
    pause
    exit /b 1
)

set "UV_CMD=.\uv.exe"
echo [OK] uv.exe baixado

:install_python
echo.
:: Instala Python 3.12 via uv
echo [..] Instalando Python 3.12...
%UV_CMD% python install 3.12
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar Python 3.12
    pause
    exit /b 1
)
echo [OK] Python 3.12 instalado

:: Cria venv e instala dependencias
echo.
echo [..] Instalando dependencias...
%UV_CMD% sync
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas

:: Configuracao inicial
echo.
if not exist config.toml (
    if exist config.toml.example (
        copy config.toml.example config.toml >nul
        echo [AVISO] config.toml criado a partir do template
        echo        Edite o arquivo com seus dados antes de iniciar
        echo.
    )
)

echo ========================================
echo   Instalacao concluida!
echo.
echo   Para iniciar o servidor:
echo     run.bat
echo.
echo   URL: http://localhost:8001
echo   Docs: http://localhost:8001/docs
echo ========================================
pause
