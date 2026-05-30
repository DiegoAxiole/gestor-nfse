@echo off
cd /d %~dp0
title NFSe API - FastAPI
echo ========================================
echo   NFSe API - Servidor FastAPI
echo   URL: http://localhost:8001
echo   Docs: http://localhost:8001/docs
echo ========================================
echo.
echo Feche esta janela para parar o servidor.
echo.
where uv.exe >nul 2>&1
if %errorlevel% equ 0 (
    uv run uvicorn main:app --host 0.0.0.0 --port 8001
) else (
    .\uv.exe run uvicorn main:app --host 0.0.0.0 --port 8001
)
pause
