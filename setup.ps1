param(
  [switch]$NoNode,
  [switch]$NoPython
)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

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
Write-Host "SETUP - GESTOR NFSe" -ForegroundColor White
Write-Host ""

$hasUv = Test-Command "uv"
$hasNode = Test-Command "node"

Write-Host "Verificando ferramentas..." -ForegroundColor Yellow
Write-Host "  Node.js: $(if ($hasNode) { 'OK' } else { 'ausente' })" -ForegroundColor $(if ($hasNode) { 'Green' } else { 'DarkYellow' })
Write-Host "  uv:      $(if ($hasUv) { 'OK' } else { 'ausente' })" -ForegroundColor $(if ($hasUv) { 'Green' } else { 'DarkYellow' })
Write-Host ""

$hasWork = $false

# Instalar Node.js
if (-not $hasNode -and -not $NoNode) {
  $hasWork = $true
  Write-Host "INSTALANDO NODE.JS" -ForegroundColor White
  $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
  $nodeUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-$arch.msi"
  $nodeMsi = "$env:TEMP\node-install.msi"
  Write-Host "  Baixando..." -ForegroundColor Yellow
  (New-Object System.Net.WebClient).DownloadFile($nodeUrl, $nodeMsi)
  Write-Host "  OK" -ForegroundColor Green
  Write-Host "  Instalando..." -ForegroundColor Yellow
  Start-Process msiexec -ArgumentList "/i `"$nodeMsi`" /quiet /norestart" -Wait
  Remove-Item $nodeMsi -Force
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  if (Test-Command "node") { Write-Host "  OK Node.js $(Get-Version "node")" -ForegroundColor Green }
  Write-Host ""
}

# Instalar uv
if (-not $hasUv -and -not $NoPython) {
  $hasWork = $true
  Write-Host "INSTALANDO uv" -ForegroundColor White
  $uvUrl = "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
  $uvZip = "$env:TEMP\uv.zip"
  $uvDir = "$env:TEMP\uv-extract"
  Write-Host "  Baixando..." -ForegroundColor Yellow
  (New-Object System.Net.WebClient).DownloadFile($uvUrl, $uvZip)
  Write-Host "  OK" -ForegroundColor Green
  Write-Host "  Extraindo..." -ForegroundColor Yellow
  if (Test-Path $uvDir) { Remove-Item $uvDir -Recurse -Force }
  Expand-Archive -Path $uvZip -DestinationPath $uvDir -Force
  Remove-Item $uvZip -Force
  $uvExe = Get-ChildItem -Path $uvDir -Recurse -Filter "uv.exe" | Select-Object -First 1
  $binDir = "$env:USERPROFILE\.local\bin"
  if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }
  Copy-Item -Path $uvExe.FullName -Destination "$binDir\uv.exe" -Force
  Remove-Item $uvDir -Recurse -Force
  $env:Path = "$binDir;$env:Path"
  if (Test-Command "uv") { Write-Host "  OK uv $(Get-Version "uv")" -ForegroundColor Green }
  Write-Host ""

  Write-Host "INSTALANDO PYTHON" -ForegroundColor White
  $uvc = if (Test-Command "uv") { "uv" } else { "$binDir\uv.exe" }
  Write-Host "  Baixando Python 3.12..." -ForegroundColor Yellow
  & $uvc python install 3.12 2>&1 | Out-Null
  Write-Host "  OK Python 3.12" -ForegroundColor Green
  Write-Host ""
}

# Backend
Write-Host "CONFIGURANDO BACKEND" -ForegroundColor White
$backendDir = Join-Path $RepoRoot "backend"
$uvc = if (Test-Command "uv") { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }
if (-not (Test-Path (Join-Path $backendDir ".venv"))) {
  $hasWork = $true
  Write-Host "  Instalando dependencias..." -ForegroundColor Yellow
  Push-Location $backendDir
  & $uvc sync 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else {
  Write-Host "  Ja configurado" -ForegroundColor Green
}
Write-Host ""

# Frontend
Write-Host "CONFIGURANDO FRONTEND" -ForegroundColor White
$frontendDir = Join-Path $RepoRoot "frontend"
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
  $hasWork = $true
  Write-Host "  Instalando dependencias..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm install --loglevel=warn 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else {
  Write-Host "  Ja configurado" -ForegroundColor Green
}
Write-Host ""

# Build
Write-Host "COMPILANDO FRONTEND" -ForegroundColor White
if (-not (Test-Path (Join-Path $backendDir "dist\index.html"))) {
  $hasWork = $true
  Write-Host "  Compilando..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm run build 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else {
  Write-Host "  Ja compilado" -ForegroundColor Green
}
Write-Host ""

if (-not $hasWork) {
  Write-Host "Tudo ja configurado!" -ForegroundColor Green
  Write-Host "Execute .\start.ps1" -ForegroundColor Yellow
} else {
  Write-Host "SETUP CONCLUIDO!" -ForegroundColor Green
  Write-Host "Execute .\start.ps1" -ForegroundColor Yellow
}
