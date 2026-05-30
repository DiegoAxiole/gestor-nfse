@echo off
cd /d %~dp0
echo Parando servidor...

:: Mata o processo da porta 8001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
del data\server.pid 2>nul

:: Aguarda a porta ser liberada (TIME_WAIT)
echo Aguardando porta 8001 liberar...
:waitloop
netstat -ano | findstr ":8001 " >nul 2>&1
if not errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto waitloop
)

echo Iniciando servidor...
start "" cmd /c "title NFSe API - FastAPI && echo ======================================== && echo   NFSe API - Servidor FastAPI && echo   URL: http://localhost:8001 && echo   Docs: http://localhost:8001/docs && echo ======================================== && echo. && echo Feche esta janela para parar o servidor. && echo. && where uv.exe >nul 2>&1 && (uv run uvicorn main:app --host 0.0.0.0 --port 8001) || (.\uv.exe run uvicorn main:app --host 0.0.0.0 --port 8001) && pause"
timeout /t 3 /nobreak >nul
echo Servidor iniciado em http://localhost:8001
