param(
  [switch]$NoNode,
  [switch]$NoPython
)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$RepoRoot = Split-Path -Parent $PSCommandPath
if (-not $RepoRoot -or -not (Test-Path (Join-Path $RepoRoot "backend\main.py"))) {
  Write-Host ""
  Write-Host "ERRO: Execute .\setup.ps1 na pasta raiz do gestor-nfse"
  exit 1
}

function Test-Cmd {
  param($Name)
  try { Get-Command $Name -ErrorAction Stop | Out-Null; return $true }
  catch { return $false }
}

function Get-Ver {
  param($Exe)
  try { $v = & $Exe --version 2>&1; if ($v -match "(\d+\.\d+\.\d+)") { return $Matches[1] } } catch {}
}

function Download-File {
  param($Url, $Dest, $Label)
  try {
    $req = [System.Net.WebRequest]::Create($Url)
    $req.Method = "HEAD"
    $req.Timeout = 5000
    $resp = $req.GetResponse()
    $total = $resp.ContentLength
    $resp.Close()
  } catch { $total = 0 }
  $totalMB = if ($total -gt 0) { [Math]::Round($total / 1MB, 1) } else { "?" }
  Write-Host "  Baixando $Label ($totalMB MB)..." -ForegroundColor Yellow
  try {
    & "curl.exe" -# -L -o "$Dest" "$Url" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "curl exit code $LASTEXITCODE" }
    $arq = Get-Item $Dest
    Write-Host "  OK $([Math]::Round($arq.Length / 1MB, 1)) MB baixado" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "  ERRO download: $_" -ForegroundColor Red
    return $false
  }
}

function Section {
  param($T)
  Write-Host ""
  Write-Host "-- $T --" -ForegroundColor DarkCyan
}

Write-Host ""
Write-Host "SETUP - GESTOR NFSe" -ForegroundColor White
Write-Host ""

$hasNode = Test-Cmd "node"
$hasUv = Test-Cmd "uv"
$hasPython = $false
if ($hasUv) {
  $pv = & uv python list 2>$null
  if ($pv -match "3\.12") { $hasPython = $true }
}

Write-Host "Ferramentas:" -ForegroundColor Yellow
Write-Host "  Node.js: $(if ($hasNode) { 'OK' } else { 'ausente' })" -ForegroundColor $(if ($hasNode) { 'Green' } else { 'DarkYellow' })
Write-Host "  uv:      $(if ($hasUv) { 'OK' } else { 'ausente' })" -ForegroundColor $(if ($hasUv) { 'Green' } else { 'DarkYellow' })
Write-Host "  Python:  $(if ($hasPython) { 'OK' } else { 'ausente' })" -ForegroundColor $(if ($hasPython) { 'Green' } else { 'DarkYellow' })

$backendDir = Join-Path $RepoRoot "backend"
$frontendDir = Join-Path $RepoRoot "frontend"

# --- Node.js ---
if (-not $hasNode -and -not $NoNode) {
  Section "INSTALANDO NODE.JS"
  $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
  $url = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-$arch.msi"
  $msi = "$env:TEMP\node-install.msi"
  if (Download-File $url $msi "Node.js 22.14.0") {
    Write-Host "  Instalando..." -ForegroundColor Yellow
    Start-Process msiexec -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
    Remove-Item $msi -Force
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    for ($i = 0; $i -lt 30; $i++) {
      if (Test-Cmd "node") { break }
      Start-Sleep -Seconds 1
    }
    if (Test-Cmd "node") { Write-Host "  OK Node.js $(Get-Ver "node")" -ForegroundColor Green }
    else { Write-Host "  ERRO: Node.js nao instalado" -ForegroundColor Red }
  }
}

# --- uv ---
if (-not $hasUv -and -not $NoPython) {
  Section "INSTALANDO uv"
  $url = "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
  $zip = "$env:TEMP\uv.zip"
  $dir = "$env:TEMP\uv-extract"
  if (Download-File $url $zip "uv") {
    Write-Host "  Extraindo..." -ForegroundColor Yellow
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $dir
    Remove-Item $zip -Force
    $exe = Get-ChildItem -Path $dir -Recurse -Filter "uv.exe" | Select-Object -First 1
    $binDir = "$env:USERPROFILE\.local\bin"
    if (-not (Test-Path $binDir)) { New-Item $binDir -ItemType Directory -Force | Out-Null }
    Copy-Item $exe.FullName "$binDir\uv.exe" -Force
    Remove-Item $dir -Recurse -Force
    $env:Path = "$binDir;$env:Path"
    if (Test-Cmd "uv") { Write-Host "  OK uv $(Get-Ver "uv")" -ForegroundColor Green }
    else { Write-Host "  ERRO: uv nao instalado" -ForegroundColor Red }
  }
}

# --- Python ---
if (-not $hasPython -and -not $NoPython) {
  Section "INSTALANDO PYTHON 3.12"
  $uvc = if (Test-Cmd "uv") { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }
  Write-Host "  Instalando Python 3.12..." -ForegroundColor Yellow
  & $uvc python install 3.12
  Write-Host "  OK Python 3.12" -ForegroundColor Green
}

# --- Backend ---
Section "BACKEND"
$uvc = if (Test-Cmd "uv") { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }
if (-not (Test-Path (Join-Path $backendDir ".venv"))) {
  Write-Host "  Criando .venv e instalando dependencias..." -ForegroundColor Yellow
  Push-Location $backendDir
  & $uvc sync
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else { Write-Host "  OK .venv existe" -ForegroundColor Green }

# --- Frontend ---
Section "FRONTEND"
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
  Write-Host "  Instalando dependencias Node..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm install --no-progress
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else { Write-Host "  OK node_modules existe" -ForegroundColor Green }

# --- Build ---
Section "BUILD"
if (-not (Test-Path (Join-Path $backendDir "dist\index.html"))) {
  Write-Host "  Compilando frontend..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm run build
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else { Write-Host "  OK build existe" -ForegroundColor Green }

Write-Host ""
Write-Host "SETUP CONCLUIDO!" -ForegroundColor Green
Write-Host "Execute .\start.ps1" -ForegroundColor Yellow
