param(
  [int]$Port = 3000,
  [string]$ListenHost = "0.0.0.0"
)

$env:PORT = $Port
$env:HOST = $ListenHost

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Iniciando servidor frontend NFSe" -ForegroundColor Cyan
Write-Host "  http://localhost:$Port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

npx vite --port=$Port --host=$ListenHost
