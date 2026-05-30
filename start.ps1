param(
  [int]$BackendPort = 8001,
  [int]$FrontendPort = 3000
)

$RepoRoot = Split-Path -Parent $PSCommandPath
if (-not $RepoRoot) {
  Write-Host ""
  Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Red
  Write-Host "║  ERRO: Execute o script como arquivo .ps1            ║" -ForegroundColor Red
  Write-Host "╠═══════════════════════════════════════════════════════╣" -ForegroundColor Red
  Write-Host "║                                                     " -ForegroundColor Red
  Write-Host "║  Não cole os comandos no terminal. Use:" -ForegroundColor White
  Write-Host "║                                                     " -ForegroundColor Red
  Write-Host "║     cd C:\caminho\para\gestor-nfse" -ForegroundColor Green
  Write-Host "║     .\start.ps1" -ForegroundColor Green
  Write-Host "║                                                     " -ForegroundColor Red
  Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path (Join-Path $RepoRoot "backend\main.py"))) {
  Write-Host ""
  Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Red
  Write-Host "║  ERRO: Script fora da pasta do projeto               ║" -ForegroundColor Red
  Write-Host "╠═══════════════════════════════════════════════════════╣" -ForegroundColor Red
  Write-Host "║                                                     " -ForegroundColor Red
  Write-Host "║  Navegue até a pasta correta e tente novamente:" -ForegroundColor White
  Write-Host "║                                                     " -ForegroundColor Red
  Write-Host "║     cd C:\caminho\para\gestor-nfse" -ForegroundColor Green
  Write-Host "║     .\start.ps1" -ForegroundColor Green
  Write-Host "║                                                     " -ForegroundColor Red
  Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Red
  exit 1
}
$backendDir = Join-Path $RepoRoot "backend"
$frontendDir = Join-Path $RepoRoot "frontend"

# Detecta uv
$uv = if (Get-Command "uv" -ErrorAction SilentlyContinue) { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║            INICIANDO GESTOR NFSe                      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Backend
Write-Host "  🖥  Iniciando backend..." -ForegroundColor Yellow
Write-Host "       http://localhost:$BackendPort" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; & $uv run uvicorn main:app --host 127.0.0.1 --port $BackendPort" -WindowStyle Normal
Start-Sleep -Seconds 3

# Frontend
Write-Host "  🌐  Iniciando frontend..." -ForegroundColor Yellow
Write-Host "       http://localhost:$FrontendPort" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 4

# Abre navegador
Write-Host ""
Write-Host "  ✔ Servidores iniciados! Abrindo navegador..." -ForegroundColor Green
Start-Process "http://localhost:$FrontendPort"
