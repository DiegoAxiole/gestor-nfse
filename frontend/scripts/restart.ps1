param(
  [int]$Port = 3000
)

& "$PSScriptRoot\stop.ps1" -Port $Port
& "$PSScriptRoot\start.ps1" -Port $Port
