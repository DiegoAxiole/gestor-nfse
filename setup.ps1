param(
  [switch]$NoNode,
  [switch]$NoPython
)

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSCommandPath
if (-not $RepoRoot) {
  Write-Host ""
  Write-Host "ERRO: Execute como .\setup.ps1"
  exit 1
}
if (-not (Test-Path (Join-Path $RepoRoot "backend\main.py"))) {
  Write-Host ""
  Write-Host "ERRO: Execute na pasta do gestor-nfse"
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

function Download-Progress {
  param($Url, $Dest, $Label)
  $total = 0
  try {
    $req = [System.Net.WebRequest]::Create($Url)
    $req.Method = "HEAD"
    $req.Timeout = 5000
    $resp = $req.GetResponse()
    $total = $resp.ContentLength
    $resp.Close()
  } catch {}
  $totalMB = if ($total -gt 0) { [Math]::Round($total / 1MB, 1) } else { "?" }
  Write-Host "  Baixando $Label ($totalMB MB)..." -ForegroundColor Yellow
  if (Test-Path $Dest) { Remove-Item $Dest -Force }
  $job = Start-Job { param($u,$d) $w=[System.Net.WebClient]::new(); $w.DownloadFile($u,$d); $w.Dispose() } -Arg $Url,$Dest
  while ($job.State -eq 'Running') {
    if (Test-Path $Dest) {
      $cur = (Get-Item $Dest).Length
      if ($total -gt 0) {
        $pct = [Math]::Min(99, [Math]::Round(($cur/$total)*100))
        $rec = [Math]::Round($cur/1MB,1)
        $totM = [Math]::Round($total/1MB,1)
        Write-Progress -Activity "Download: $Label" -Status "$pct% ($rec/$totM MB)" -PercentComplete $pct
      }
    }
    Start-Sleep -Milliseconds 300
  }
  Receive-Job $job -ErrorAction SilentlyContinue | Out-Null
  Remove-Job $job
  Write-Progress -Activity "Download: $Label" -Completed
  $arq = Get-Item $Dest
  Write-Host "  OK $([Math]::Round($arq.Length / 1MB, 1)) MB baixado" -ForegroundColor Green
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

Write-Host "Ferramentas:" -ForegroundColor Yellow
Write-Host "  Node.js: $(if ($hasNode) { 'OK' } else { 'ausente' })" -ForegroundColor $(if ($hasNode) { 'Green' } else { 'DarkYellow' })
Write-Host "  uv:      $(if ($hasUv) { 'OK' } else { 'ausente' })" -ForegroundColor $(if ($hasUv) { 'Green' } else { 'DarkYellow' })

$work = $false

# --- Node.js ---
if (-not $hasNode -and -not $NoNode) {
  $work = $true
  Section "INSTALANDO NODE.JS"
  $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
  $url = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-$arch.msi"
  $msi = "$env:TEMP\node-install.msi"
  Download-Progress $url $msi "Node.js 22.14.0"
  Write-Host "  Instalando..." -ForegroundColor Yellow
  Start-Process msiexec -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
  Remove-Item $msi -Force
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  Start-Sleep -Seconds 1
  if (Test-Cmd "node") { Write-Host "  OK Node.js $(Get-Ver "node")" -ForegroundColor Green }
}

# --- uv ---
if (-not $hasUv -and -not $NoPython) {
  $work = $true
  Section "INSTALANDO uv"
  $url = "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
  $zip = "$env:TEMP\uv.zip"
  $dir = "$env:TEMP\uv-extract"
  Download-Progress $url $zip "uv"
  Write-Host "  Extraindo..." -ForegroundColor Yellow
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $dir -Force
  Remove-Item $zip -Force
  $exe = Get-ChildItem -Path $dir -Recurse -Filter "uv.exe" | Select-Object -First 1
  $binDir = "$env:USERPROFILE\.local\bin"
  if (-not (Test-Path $binDir)) { New-Item $binDir -ItemType Directory -Force | Out-Null }
  Copy-Item $exe.FullName "$binDir\uv.exe" -Force
  Remove-Item $dir -Recurse -Force
  $env:Path = "$binDir;$env:Path"
  if (Test-Cmd "uv") { Write-Host "  OK uv $(Get-Ver "uv")" -ForegroundColor Green }

  Section "INSTALANDO PYTHON 3.12"
  $uvc = if (Test-Cmd "uv") { "uv" } else { "$binDir\uv.exe" }
  Write-Host "  Baixando Python 3.12..." -ForegroundColor Yellow
  & $uvc python install 3.12 2>&1 | Out-Null
  Write-Host "  OK" -ForegroundColor Green
}

# --- Backend ---
Section "BACKEND"
$backendDir = Join-Path $RepoRoot "backend"
$uvc = if (Test-Cmd "uv") { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }
if (-not (Test-Path (Join-Path $backendDir ".venv"))) {
  $work = $true
  Write-Host "  Instalando dependencias Python..." -ForegroundColor Yellow
  Push-Location $backendDir
  & $uvc sync 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else { Write-Host "  OK .venv existe" -ForegroundColor Green }

# --- Frontend ---
Section "FRONTEND"
$frontendDir = Join-Path $RepoRoot "frontend"
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
  $work = $true
  Write-Host "  Instalando dependencias Node..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm install --loglevel=warn 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else { Write-Host "  OK node_modules existe" -ForegroundColor Green }

# --- Build ---
Section "BUILD"
if (-not (Test-Path (Join-Path $backendDir "dist\index.html"))) {
  $work = $true
  Write-Host "  Compilando frontend..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm run build 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
} else { Write-Host "  OK build existe" -ForegroundColor Green }

Write-Host ""
if ($work) { Write-Host "SETUP CONCLUIDO!" -ForegroundColor Green } else { Write-Host "Tudo pronto!" -ForegroundColor Green }
Write-Host "Execute .\start.ps1" -ForegroundColor Yellow
