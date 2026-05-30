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
  Write-Host "║  Não cole os comandos no terminal." -ForegroundColor White
  Write-Host "║  No PowerShell, navegue até a pasta do projeto" -ForegroundColor White
  Write-Host "║  e digite: .\start.ps1" -ForegroundColor Green
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
  Write-Host "║  Navegue até a pasta do gestor-nfse e tente:" -ForegroundColor White
  Write-Host "║                                                     " -ForegroundColor Red
  Write-Host "║     .\start.ps1" -ForegroundColor Green
  Write-Host "║                                                     " -ForegroundColor Red
  Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Red
  exit 1
}
$backendDir = Join-Path $RepoRoot "backend"
$frontendDir = Join-Path $RepoRoot "frontend"

# Detecta uv
$uv = if (Get-Command "uv" -ErrorAction SilentlyContinue) { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }

function Ok($msg) { Write-Host "  ✔ $msg" -ForegroundColor Green }
function Step($msg) { Write-Host "  → $msg" -ForegroundColor DarkCyan }

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║            INICIANDO GESTOR NFSe                      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Verifica / instala dependências faltantes ──────────────────────────

$venvDir = Join-Path $backendDir ".venv"
if (-not (Test-Path $venvDir)) {
  Step "Backend não configurado — instalando dependências Python..."
  Set-Location $backendDir
  & $uv sync 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "  ✖ Falha no uv sync" -ForegroundColor Red; exit 1 }
  Ok "Dependências do backend instaladas"
}

$nodeModulesDir = Join-Path $frontendDir "node_modules"
if (-not (Test-Path $nodeModulesDir)) {
  Step "Frontend não configurado — instalando dependências Node..."
  Set-Location $frontendDir
  npm install --loglevel=warn 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "  ✖ Falha no npm install" -ForegroundColor Red; exit 1 }
  Ok "Dependências do frontend instaladas"
}

$distIndex = Join-Path $backendDir "dist\index.html"
if (-not (Test-Path $distIndex)) {
  Step "Build não encontrado — compilando frontend..."
  Set-Location $frontendDir
  npm run build 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "  ✖ Falha no npm run build" -ForegroundColor Red; exit 1 }
  Ok "Frontend compilado"
}

Set-Location $RepoRoot

# ─── Inicia servidores ──────────────────────────────────────────────────

Write-Host ""
Write-Host "  🖥  Iniciando backend..." -ForegroundColor Yellow
Write-Host "       http://localhost:$BackendPort" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; & $uv run uvicorn main:app --host 127.0.0.1 --port $BackendPort" -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host "  🌐  Iniciando frontend..." -ForegroundColor Yellow
Write-Host "       http://localhost:$FrontendPort" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "  ✔ Servidores iniciados! Abrindo navegador..." -ForegroundColor Green
Start-Process "http://localhost:$FrontendPort"
