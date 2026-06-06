$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n[DEV] Iniciando servidor..." -ForegroundColor Cyan

# Mata processos antigos nas portas 8001
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    $ports = netstat -ano | Select-String "8001"
    if ($ports -match $_.Id) { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}
Start-Sleep 1

# Frontend watch (recompila automaticamente ao salvar)
$feJob = Start-Job -Name "NFSe-Watch" -ScriptBlock {
    param($dir) Set-Location $dir; npm run build -- --watch
} -ArgumentList (Join-Path $root "frontend")
Write-Host "  Frontend watch iniciado (recompila automaticamente)" -ForegroundColor DarkYellow

# Backend (tsx watch + serve frontend buildado)
$beJob = Start-Job -Name "NFSe-Backend" -ScriptBlock {
    param($dir)
    Set-Location $dir
    npx tsx src/index.ts
} -ArgumentList (Join-Path $root "backend")

# Aguarda backend iniciar
Write-Host "  BACKEND  aguardando..." -NoNewline
Start-Sleep 3
$ok = $false
for ($i = 0; $i -lt 10; $i++) {
    try { $r = Invoke-RestMethod -Uri "http://localhost:8001/health" -ErrorAction Stop; $ok = $true; break } catch { Start-Sleep 1 }
}
if ($ok) { Write-Host " OK ($($r.version))" -ForegroundColor Green } else { Write-Host " FALHOU" -ForegroundColor Red }

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "       GESTOR NFSe - SERVIDOR UNICO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ACESSAR: http://localhost:8001" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
Write-Host "  Para parar:" -ForegroundColor Yellow
Write-Host "    Stop-Job NFSe-Backend, NFSe-Watch | Remove-Job" -ForegroundColor DarkYellow
Write-Host "  Ou feche este terminal." -ForegroundColor Yellow
Write-Host ""

Start-Process "http://localhost:8001"
