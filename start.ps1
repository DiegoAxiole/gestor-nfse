param(
  [int]$BackendPort = 8001,
  [int]$FrontendPort = 3000
)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
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

# Find or install uv
if (Test-Command "uv") {
  $uv = "uv"
} elseif (Test-Command "$env:USERPROFILE\.local\bin\uv.exe") {
  $uv = "$env:USERPROFILE\.local\bin\uv.exe"
} else {
  Write-Host "  uv nao encontrado. Instalando automaticamente..." -ForegroundColor Yellow
  $uvUrl = "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
  $uvZip = "$env:TEMP\uv.zip"
  $uvDir = "$env:TEMP\uv-extract"
  Invoke-WebRequest -Uri $uvUrl -OutFile $uvZip -UseBasicParsing
  if (Test-Path $uvDir) { Remove-Item $uvDir -Recurse -Force }
  Expand-Archive -Path $uvZip -DestinationPath $uvDir -Force
  Remove-Item $uvZip -Force
  $uvExe = Get-ChildItem -Path $uvDir -Recurse -Filter "uv.exe" | Select-Object -First 1
  if (-not $uvExe) { Write-Host "  ERRO: Falha ao instalar uv" -ForegroundColor Red; exit 1 }
  $binDir = "$env:USERPROFILE\.local\bin"
  if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }
  Copy-Item -Path $uvExe.FullName -Destination "$binDir\uv.exe" -Force
  Remove-Item $uvDir -Recurse -Force
  $uv = "$binDir\uv.exe"
  Write-Host "  OK uv instalado" -ForegroundColor Green
}

$script:ProgressCur = 0
$script:ProgressMax = 100

function Set-ProgressMax {
  param([int]$Max)
  $script:ProgressMax = [Math]::Max(1, $Max)
}

function Write-ProgressBar {
  param([int]$Percent, [string]$Message, [string]$SubMessage = "")
  $pct = [Math]::Min(99, [Math]::Max(0, $Percent))
  Write-Progress -Activity "Iniciando Gestor NFSe" -Status $Message -PercentComplete $pct -CurrentOperation $SubMessage
}

function Step-Progress {
  param([string]$Label)
  $script:ProgressCur++
  $pct = [Math]::Min(99, [Math]::Round(($script:ProgressCur / $script:ProgressMax) * 100))
  Write-ProgressBar -Percent $pct -Message $Label
  Write-Host ""
  Write-Host "  >> $Label" -ForegroundColor Cyan
}

function Complete-Progress {
  Write-Progress -Activity "Iniciando Gestor NFSe" -Completed
}

Write-Host ""
Write-Host "  Iniciando Gestor NFSe" -ForegroundColor White
Write-Host ""

$activeSteps = 0
if (-not (Test-Path (Join-Path $backendDir ".venv"))) { $activeSteps++ }
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) { $activeSteps++ }
if (-not (Test-Path (Join-Path $backendDir "dist\index.html"))) { $activeSteps++ }
$activeSteps++; $activeSteps++; $activeSteps++

Set-ProgressMax $activeSteps

$venvDir = Join-Path $backendDir ".venv"
if (-not (Test-Path $venvDir)) {
  Step-Progress "Instalando dependencias do backend"
  Write-Host "  Executando uv sync..." -ForegroundColor Yellow
  Push-Location $backendDir
  & $uv sync 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "  ERRO" -ForegroundColor Red; Pop-Location; exit 1 }
  Pop-Location
  Write-Host "  OK Backend configurado" -ForegroundColor Green
} else {
  Step-Progress "Verificando backend"
  Write-Host "  OK" -ForegroundColor Green
}

$nodeModulesDir = Join-Path $frontendDir "node_modules"
if (-not (Test-Path $nodeModulesDir)) {
  Step-Progress "Instalando dependencias do frontend"
  Write-Host "  Executando npm install..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm install --loglevel=warn 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "  ERRO" -ForegroundColor Red; Pop-Location; exit 1 }
  Pop-Location
  Write-Host "  OK Frontend configurado" -ForegroundColor Green
} else {
  Step-Progress "Verificando frontend"
  Write-Host "  OK" -ForegroundColor Green
}

$distIndex = Join-Path $backendDir "dist\index.html"
if (-not (Test-Path $distIndex)) {
  Step-Progress "Compilando frontend"
  Write-Host "  Executando npm run build..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm run build 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host "  ERRO" -ForegroundColor Red; Pop-Location; exit 1 }
  Pop-Location
  Write-Host "  OK Frontend compilado" -ForegroundColor Green
} else {
  Step-Progress "Verificando build"
  Write-Host "  OK" -ForegroundColor Green
}

Set-Location $RepoRoot

Step-Progress "Iniciando servidor backend"
Write-Host "  http://localhost:$BackendPort" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; & $uv run uvicorn main:app --host 127.0.0.1 --port $BackendPort" -WindowStyle Normal
Start-Sleep -Seconds 2

Step-Progress "Iniciando servidor frontend"
Write-Host "  http://localhost:$FrontendPort" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev" -WindowStyle Normal
Start-Sleep -Seconds 3

Step-Progress "Abrindo navegador"
Start-Process "http://localhost:$FrontendPort"
Start-Sleep -Milliseconds 500

Complete-Progress

Write-Host ""
Write-Host "  Servidores iniciados!" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:$BackendPort" -ForegroundColor White
Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor White
Write-Host ""
