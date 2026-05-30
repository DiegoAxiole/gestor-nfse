param()

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSCommandPath
if (-not $RepoRoot -or -not (Test-Path (Join-Path $RepoRoot "backend\main.py"))) {
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
  $wc = New-Object System.Net.WebClient
  Register-ObjectEvent $wc DownloadProgressChanged -Action {
    $pct = $EventArgs.ProgressPercentage
    $rec = [Math]::Round($EventArgs.BytesReceived / 1MB, 1)
    $tot = if ($EventArgs.TotalBytesToReceive -gt 0) { [Math]::Round($EventArgs.TotalBytesToReceive / 1MB, 1) } else { "?" }
    Write-Progress -Activity "Download: $Label" -Status "$pct% - $rec de $tot MB" -PercentComplete $pct
  } | Out-Null
  $wc.DownloadFileAsync($Url, $Dest)
  while ($wc.IsBusy) { Start-Sleep -Milliseconds 200 }
  $wc.Dispose()
  Write-Progress -Activity "Download: $Label" -Completed
  $arq = Get-Item $Dest
  Write-Host "  OK $([Math]::Round($arq.Length / 1MB, 1)) MB baixado" -ForegroundColor Green
}

function Until-Open {
  param($Url, $Label)
  Write-Host "  Aguardando $Label..." -ForegroundColor Yellow
  do {
    try {
      $r = [System.Net.HttpWebRequest]::Create($Url)
      $r.Timeout = 1000
      $resp = $r.GetResponse()
      $resp.Close()
      break
    } catch { Start-Sleep -Seconds 1 }
  } while ($true)
  Write-Host "  OK $Label" -ForegroundColor Green
}

Write-Host ""
Write-Host "INICIANDO GESTOR NFSe" -ForegroundColor White
Write-Host ""

$backendDir = Join-Path $RepoRoot "backend"
$frontendDir = Join-Path $RepoRoot "frontend"
$hasUv = Test-Cmd "uv"
$needsSetup = $false

# --- Install uv if missing ---
if (-not $hasUv) {
  Write-Host "-- INSTALANDO uv --" -ForegroundColor DarkCyan
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
  $hasUv = $true
  Write-Host "  OK uv $(Get-Ver "uv")" -ForegroundColor Green
}

$uvc = if (Test-Cmd "uv") { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }

# --- Check deps ---
if (-not (Test-Path (Join-Path $backendDir ".venv"))) {
  Write-Host "-- BACKEND: Dependencias --" -ForegroundColor DarkCyan
  Write-Host "  Instalando Python..." -ForegroundColor Yellow
  Push-Location $backendDir
  & $uvc sync 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
}
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
  Write-Host "-- FRONTEND: Dependencias --" -ForegroundColor DarkCyan
  Write-Host "  Instalando dependencias..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm install --loglevel=warn 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK" -ForegroundColor Green
}
if (-not (Test-Path (Join-Path $backendDir "dist\index.html"))) {
  Write-Host "-- BUILD --" -ForegroundColor DarkCyan
  Write-Host "  Compilando frontend..." -ForegroundColor Yellow
  Push-Location $frontendDir
  npm run build 2>&1 | Out-Null
  Pop-Location
  Write-Host "  OK compilado" -ForegroundColor Green
}

# --- Start servers ---
Write-Host ""
Write-Host "Iniciando servidores..." -ForegroundColor Yellow

$backendLog = Join-Path $RepoRoot "backend.log"
$frontendLog = Join-Path $RepoRoot "frontend.log"

$pBackend = Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; & $uvc run uvicorn main:app --host 127.0.0.1 --port 8001 | Tee-Object '$backendLog'"

$pFrontend = Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm run dev | Tee-Object '$frontendLog'"

Until-Open "http://127.0.0.1:8001" "backend"
Until-Open "http://127.0.0.1:3000" "frontend"

Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "SERVIDORES INICIADOS!" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:8001" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Logs:" -ForegroundColor DarkGray
Write-Host "  backend.log" -ForegroundColor DarkGray
Write-Host "  frontend.log" -ForegroundColor DarkGray
