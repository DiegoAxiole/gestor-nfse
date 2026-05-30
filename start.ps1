param(
  [int]$BackendPort = 8001,
  [int]$FrontendPort = 3000
)

$RepoRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║            INICIANDO GESTOR NFSe                      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Backend ──────────────────────────────────────────────────────────────
$backendDir = Join-Path $RepoRoot "backend"
$backendLog = Join-Path $RepoRoot "backend.log"

Write-Host "  🖥  Backend  → http://localhost:$BackendPort" -ForegroundColor Yellow
Write-Host "  📘  API Docs → http://localhost:$BackendPort/docs" -ForegroundColor Green
Write-Host ""

$backendJob = Start-Job -Name "NFSe-Backend" -ScriptBlock {
  param($dir, $port, $log)
  Set-Location $dir
  $uv = if (Get-Command "uv" -ErrorAction SilentlyContinue) { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }
  & $uv run uvicorn main:app --host 127.0.0.1 --port $port 2>&1 | Out-File -FilePath $log -Encoding utf8
} -ArgumentList $backendDir, $BackendPort, $backendLog

Start-Sleep -Seconds 3

# Verifica se o backend subiu
$check = $null
try { $check = Invoke-WebRequest -Uri "http://localhost:$BackendPort/health" -UseBasicParsing -TimeoutSec 2 } catch {}
if ($check -and $check.StatusCode -eq 200) {
  Write-Host "  ✔ Backend online" -ForegroundColor Green
} else {
  Write-Host "  ⚠ Backend pode levar alguns segundos para iniciar..." -ForegroundColor DarkYellow
}

Write-Host ""

# ─── Frontend ─────────────────────────────────────────────────────────────
$frontendDir = Join-Path $RepoRoot "frontend"

Write-Host "  🌐 Frontend → http://localhost:$FrontendPort" -ForegroundColor Yellow
Write-Host ""

$frontendJob = Start-Job -Name "NFSe-Frontend" -ScriptBlock {
  param($dir, $port)
  Set-Location $dir
  npm run dev -- --port $port 2>&1
} -ArgumentList $frontendDir, $FrontendPort

Start-Sleep -Seconds 2

Write-Host "  ✔ Frontend iniciando..." -ForegroundColor Green
Write-Host ""

# ─── Resumo ───────────────────────────────────────────────────────────────
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SERVIDORES ATIVOS                                    ║" -ForegroundColor Cyan
Write-Host "╠═══════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║                                                     " -ForegroundColor Cyan
Write-Host "║  🖥  Backend API  → http://localhost:$BackendPort   " -ForegroundColor White
Write-Host "║  📘  Swagger Docs → http://localhost:$BackendPort/docs" -ForegroundColor White
Write-Host "║  🌐  Frontend App → http://localhost:$FrontendPort   " -ForegroundColor White
Write-Host "║                                                     " -ForegroundColor Cyan
Write-Host "║  Para parar os servidores:" -ForegroundColor DarkYellow
Write-Host "║    Stop-Job -Name NFSe-Backend, NFSe-Frontend       " -ForegroundColor DarkYellow
Write-Host "║                                                     " -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 2
Start-Process "http://localhost:$FrontendPort"
