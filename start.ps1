param(
  [int]$BackendPort = 8001,
  [int]$FrontendPort = 3000
)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$RepoRoot = Split-Path -Parent $PSCommandPath
if (-not $RepoRoot) {
  Write-Host ""
  Write-Host "ERRO: Execute o script como arquivo .ps1"
  Write-Host "No PowerShell, navegue ate a pasta do projeto"
  Write-Host "e digite: .\start.ps1"
  exit 1
}
if (-not (Test-Path (Join-Path $RepoRoot "backend\main.py"))) {
  Write-Host ""
  Write-Host "ERRO: Script fora da pasta do projeto"
  Write-Host "Navegue ate a pasta do gestor-nfse e tente:"
  Write-Host "  .\start.ps1"
  exit 1
}

function Test-Command {
  param([string]$Name)
  try { Get-Command $Name -ErrorAction Stop | Out-Null; return $true }
  catch { return $false }
}

$backendDir = Join-Path $RepoRoot "backend"
$frontendDir = Join-Path $RepoRoot "frontend"

# Encontrar ou instalar uv
if (Test-Command "uv") {
  $uv = "uv"
} elseif (Test-Command "$env:USERPROFILE\.local\bin\uv.exe") {
  $uv = "$env:USERPROFILE\.local\bin\uv.exe"
} else {
  Write-Host "uv nao encontrado. Instalando..." -ForegroundColor Yellow
  $uvZip = "$env:TEMP\uv.zip"
  $uvDir = "$env:TEMP\uv-extract"
  (New-Object System.Net.WebClient).DownloadFile("https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip", $uvZip)
  if (Test-Path $uvDir) { Remove-Item $uvDir -Recurse -Force }
  Expand-Archive -Path $uvZip -DestinationPath $uvDir -Force
  Remove-Item $uvZip -Force
  $uvExe = Get-ChildItem -Path $uvDir -Recurse -Filter "uv.exe" | Select-Object -First 1
  $binDir = "$env:USERPROFILE\.local\bin"
  if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }
  Copy-Item -Path $uvExe.FullName -Destination "$binDir\uv.exe" -Force
  Remove-Item $uvDir -Recurse -Force
  $uv = "$binDir\uv.exe"
  Write-Host "  OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "INICIANDO GESTOR NFSe" -ForegroundColor White
Write-Host ""

# Backend
if (-not (Test-Path (Join-Path $backendDir ".venv"))) {
  Write-Host "Instalando dependencias do backend..." -ForegroundColor Yellow
  Push-Location $backendDir
  & $uv sync 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
}

# Frontend
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
  Write-Host "Instalando dependencias do frontend..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm install --loglevel=warn 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
}

# Build
if (-not (Test-Path (Join-Path $backendDir "dist\index.html"))) {
  Write-Host "Compilando frontend..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm run build 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
}

Set-Location $RepoRoot

Write-Host "Iniciando servidores..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; & $uv run uvicorn main:app --host 127.0.0.1 --port $BackendPort" -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 3
Start-Process "http://localhost:$FrontendPort"

Write-Host ""
Write-Host "SERVIDORES INICIADOS!" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor White
Write-Host ""
