param(
  [switch]$NoNode,
  [switch]$NoPython
)

Set-ExecutionPolicy Bypass -Scope Process -Force

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSCommandPath
if (-not $RepoRoot) {
  Write-Host ""
  Write-Host "ERRO: Execute o script como arquivo .ps1"
  Write-Host "No PowerShell, navegue ate a pasta do projeto"
  Write-Host "e digite: .\setup.ps1"
  exit 1
}
if (-not (Test-Path (Join-Path $RepoRoot "backend\main.py"))) {
  Write-Host ""
  Write-Host "ERRO: Script fora da pasta do projeto"
  Write-Host "Navegue ate a pasta do gestor-nfse e tente:"
  Write-Host "  .\setup.ps1"
  exit 1
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
  Write-Progress -Activity "Setup - Gestor NFSe" -Status $Message -PercentComplete $pct -CurrentOperation $SubMessage
}

function Step-Progress {
  param([string]$Label)
  $script:ProgressCur++
  $pct = [Math]::Min(99, [Math]::Round(($script:ProgressCur / $script:ProgressMax) * 100))
  $remaining = $script:ProgressMax - $script:ProgressCur
  Write-ProgressBar -Percent $pct -Message $Label -SubMessage "Faltam $remaining etapa(s)..."
  Write-Host ""
  Write-Host "  >> $Label" -ForegroundColor Cyan
}

function Complete-Progress {
  Write-Progress -Activity "Setup - Gestor NFSe" -Completed
}

function Section {
  param([string]$Title)
  Write-Host ""
  Write-Host ("-" * 50) -ForegroundColor DarkCyan
  Write-Host "  $Title" -ForegroundColor DarkCyan
  Write-Host ("-" * 50) -ForegroundColor DarkCyan
}

function Test-Command {
  param([string]$Name)
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Stop"
  try { Get-Command $Name -ErrorAction Stop | Out-Null; return $true }
  catch { return $false }
  finally { $ErrorActionPreference = $old }
}

function Get-Version {
  param([string]$Exe)
  try {
    $v = & $Exe --version 2>&1
    if ($v -match "(\d+\.\d+\.\d+)") { return $Matches[1] }
    return $null
  } catch { return $null }
}

Write-Host ""
Write-Host "  Setup - Gestor NFSe" -ForegroundColor White
Write-Host "  Tudo automatico. Nenhuma acao necessaria." -ForegroundColor DarkGray
Write-Host ""

Section "PRE-VERIFICACAO"

$hasUv = Test-Command "uv"
$hasNode = Test-Command "node"

Write-Host "  -> Verificando ferramentas instaladas..." -ForegroundColor Yellow
Write-Host "     Node.js:  $(if ($hasNode) { 'OK' } else { '--' })" -ForegroundColor $(if ($hasNode) { 'Green' } else { 'DarkYellow' })
Write-Host "     uv:       $(if ($hasUv) { 'OK' } else { '--' })" -ForegroundColor $(if ($hasUv) { 'Green' } else { 'DarkYellow' })
Write-Host ""

$activeSteps = 0
if (-not $hasNode -and -not $NoNode) { $activeSteps++ }
if (-not $hasUv -and -not $NoPython) { $activeSteps++; $activeSteps++ }
if (-not (Test-Path (Join-Path $RepoRoot "backend\.venv"))) { $activeSteps++ }
if (-not (Test-Path (Join-Path $RepoRoot "frontend\node_modules"))) { $activeSteps++ }
if (-not (Test-Path (Join-Path $RepoRoot "backend\dist\index.html"))) { $activeSteps++ }

if ($activeSteps -eq 0) {
  Write-Host "  Tudo ja configurado!" -ForegroundColor Green
  Write-Host "  Execute .\start.ps1 para iniciar." -ForegroundColor Green
  exit 0
}

Set-ProgressMax $activeSteps

if (-not $hasNode -and -not $NoNode) {
  Section "INSTALANDO NODE.JS"

  $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
  $nodeVersion = "22.14.0"
  $nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-$arch.msi"
  $nodeMsi = "$env:TEMP\node-install.msi"
  $nodeSize = "~55 MB"

  Step-Progress "Instalando Node.js $nodeVersion"
  Write-Host "  Tamanho: $nodeSize" -ForegroundColor DarkGray

  Write-Host "  Baixando..." -ForegroundColor Yellow
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
  Write-Host "  OK Download concluido" -ForegroundColor Green

  Write-Host "  Instalando... (pode levar ate 2 minutos)" -ForegroundColor Yellow
  $job = Start-Job -ScriptBlock { param($m) Start-Process msiexec -ArgumentList "/i `"$m`" /quiet /norestart" -Wait -NoNewWindow } -ArgumentList $nodeMsi
  while ($job.State -eq 'Running') {
    Write-Host "`r  Instalando Node.js..." -NoNewline
    Start-Sleep -Milliseconds 1000
  }
  Receive-Job $job -Wait -ErrorAction SilentlyContinue | Out-Null
  Remove-Job $job -Force
  Remove-Item $nodeMsi -Force
  Write-Host "`r  Node.js instalado com sucesso      " -ForegroundColor Green

  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  Start-Sleep -Seconds 1
  if (Test-Command "node") { Write-Host "  OK Node.js $(Get-Version "node") funcionando" -ForegroundColor Green }
  Write-Host ""
}

if (-not $hasUv -and -not $NoPython) {
  Section "INSTALANDO uv"

  $uvUrl = "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
  $uvZip = "$env:TEMP\uv.zip"
  $uvDir = "$env:TEMP\uv-extract"

  Step-Progress "Instalando uv (gerenciador Python)"

  Write-Host "  Baixando uv..." -ForegroundColor Yellow
  Invoke-WebRequest -Uri $uvUrl -OutFile $uvZip -UseBasicParsing
  Write-Host "  OK Download concluido" -ForegroundColor Green

  Write-Host "  Extraindo..." -ForegroundColor Yellow
  if (Test-Path $uvDir) { Remove-Item $uvDir -Recurse -Force }
  Expand-Archive -Path $uvZip -DestinationPath $uvDir -Force
  Remove-Item $uvZip -Force
  $uvExe = Get-ChildItem -Path $uvDir -Recurse -Filter "uv.exe" | Select-Object -First 1
  if (-not $uvExe) { Write-Host "  ERRO: uv.exe nao encontrado" -ForegroundColor Red; exit 1 }
  $binDir = "$env:USERPROFILE\.local\bin"
  if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }
  Copy-Item -Path $uvExe.FullName -Destination "$binDir\uv.exe" -Force
  Remove-Item $uvDir -Recurse -Force
  $env:Path = "$binDir;$env:Path"
  if (Test-Command "uv") { Write-Host "  OK uv $(Get-Version "uv") instalado" -ForegroundColor Green }
  Write-Host ""

  Section "INSTALANDO PYTHON 3.12"
  Step-Progress "Instalando Python 3.12 via uv"
  Write-Host "  (pode levar alguns minutos, baixando ~30 MB)" -ForegroundColor Yellow
  try {
    & "$binDir\uv.exe" python install 3.12 2>&1 | ForEach-Object {
      if ($_ -match "(\d+\.?\d*)%") {
        Write-Host "`r  Progresso: $_" -NoNewline -ForegroundColor DarkGray
      }
    }
  } catch {
    Write-Host "`n  ERRO: $_" -ForegroundColor Red
    exit 1
  }
  Write-Host "`r  OK Python 3.12 pronto                   " -ForegroundColor Green
  Write-Host ""
}

Section "CONFIGURANDO BACKEND"

$backendDir = Join-Path $RepoRoot "backend"
$venvDir = Join-Path $backendDir ".venv"
$uvCmd = if (Test-Command "uv") { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }

if (Test-Path $venvDir) {
  Write-Host "  -> Backend ja configurado" -ForegroundColor Green
} else {
  Step-Progress "Instalando dependencias Python"
  Push-Location $backendDir
  Write-Host "  Comando: uv sync" -ForegroundColor DarkGray
  try {
    & $uvCmd sync 2>&1 | ForEach-Object {
      if ($_ -match "error|ERRO") { Write-Host "    $_" -ForegroundColor Red }
      elseif ($_ -match "Resolved|Prepared|Installed|Downloaded") { Write-Host "    $_" -ForegroundColor Green }
      else { Write-Host "    $_" -ForegroundColor DarkGray }
    }
  } catch { Write-Host "  ERRO: $_" -ForegroundColor Red; Pop-Location; exit 1 }
  Pop-Location
  Write-Host "  OK Dependencias instaladas" -ForegroundColor Green
}

$configFile = Join-Path $backendDir "config.toml"
if (Test-Path $configFile) { Write-Host "  -> config.toml encontrado (opcional)" -ForegroundColor Green }
Write-Host ""

Section "CONFIGURANDO FRONTEND"

$frontendDir = Join-Path $RepoRoot "frontend"
$nodeModulesDir = Join-Path $frontendDir "node_modules"

if (Test-Path $nodeModulesDir) {
  Write-Host "  -> Frontend ja configurado" -ForegroundColor Green
} else {
  Step-Progress "Instalando dependencias Node.js"
  Push-Location $frontendDir
  Write-Host "  Comando: npm install" -ForegroundColor DarkGray
  try {
    npm install --loglevel=warn 2>&1 | ForEach-Object {
      if ($_ -match "error|ERR|fail") { Write-Host "    $_" -ForegroundColor Red }
      elseif ($_ -match "added|packages") { Write-Host "    $_" -ForegroundColor Green }
      else { Write-Host "    $_" -ForegroundColor DarkGray }
    }
  } catch { Write-Host "  ERRO: $_" -ForegroundColor Red; Pop-Location; exit 1 }
  Pop-Location
  Write-Host "  OK Dependencias instaladas" -ForegroundColor Green
}
Write-Host ""

Section "COMPILANDO FRONTEND"

$distIndex = Join-Path $backendDir "dist\index.html"

if (Test-Path $distIndex) {
  Write-Host "  -> Frontend ja compilado" -ForegroundColor Green
} else {
  Step-Progress "Compilando frontend para producao"
  Push-Location $frontendDir
  Write-Host "  Comando: npm run build" -ForegroundColor DarkGray
  Write-Host "  Saida: backend/dist/" -ForegroundColor DarkGray
  try {
    npm run build 2>&1 | ForEach-Object {
      if ($_ -match "error|ERR") { Write-Host "    $_" -ForegroundColor Red }
      elseif ($_ -match "built in") { Write-Host "    $_" -ForegroundColor Green }
      elseif ($_ -match "\d+ modules") { Write-Host "    $_" -ForegroundColor Green }
      else { Write-Host "    $_" -ForegroundColor DarkGray }
    }
  } catch { Write-Host "  ERRO: $_" -ForegroundColor Red; Pop-Location; exit 1 }
  Pop-Location
  Write-Host "  OK Frontend compilado" -ForegroundColor Green
}
Write-Host ""

Complete-Progress

Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "    SETUP CONCLUIDO COM SUCESSO!" -ForegroundColor White
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Para iniciar: .\start.ps1" -ForegroundColor Yellow
Write-Host ""
