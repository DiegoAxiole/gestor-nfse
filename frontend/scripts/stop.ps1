param(
  [int]$Port = 3000
)

$process = netstat -ano | Select-String ":$Port\s.*LISTENING"

if (-not $process) {
  Write-Host "Nenhum processo rodando na porta $Port" -ForegroundColor Yellow
  exit 0
}

$processId = $process.Line -replace '.*\s+(\d+)$', '$1'

try {
  $proc = Get-Process -Id $processId -ErrorAction Stop
  Stop-Process -Id $processId -Force
  Write-Host "Servidor na porta $Port (PID $processId) foi encerrado" -ForegroundColor Green
} catch {
  Write-Host ("Erro ao encerrar processo na porta " + $Port + ": " + $_) -ForegroundColor Red
}
