@echo off
echo Procurando processo na porta 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
  echo Encerrando PID %%a
  taskkill /f /pid %%a >nul 2>&1
)
echo Servidor encerrado.
pause
