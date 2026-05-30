@echo off
cd /d %~dp0
echo Parando NFSe API...
:: Mata pelo PID salvo
if exist data\server.pid (
    set /p procId=<data\server.pid
    if defined procId (
        taskkill /F /PID %procId% >nul 2>&1
    )
    del data\server.pid 2>nul
)
:: Garantia: mata qualquer processo nas portas 8000 e 8001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 :8001 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Servidor parado.
