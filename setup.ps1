param(
  [switch]$NoNode,
  [switch]$NoPython
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSCommandPath

# ─── helpers ──────────────────────────────────────────────────────────────

function Section($title) {
  Write-Host ""
  Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor DarkCyan
  Write-Host "║ $($title.PadRight(55))║" -ForegroundColor DarkCyan
  Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor DarkCyan
  Write-Host ""
}

function Step($message) {
  Write-Host "  ➜ $message" -ForegroundColor Yellow
}

function Ok($message) {
  Write-Host "  ✔ $message" -ForegroundColor Green
}

function Warn($message) {
  Write-Host "  ⚠ $message" -ForegroundColor DarkYellow
}

function Fail($message) {
  Write-Host "  ✘ $message" -ForegroundColor Red
  exit 1
}

function Bar($percent, $label) {
  $bar = "[" + ("█" * [math]::Floor($percent / 5)) + ("░" * (20 - [math]::Floor($percent / 5))) + "]"
  Write-Host "  $bar $($percent.ToString('0').PadLeft(3))%  $label" -ForegroundColor Cyan
}

function Test-Command($name) {
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Stop"
  try { Get-Command $name -ErrorAction Stop | Out-Null; return $true }
  catch { return $false }
  finally { $ErrorActionPreference = $oldPreference }
}

function Get-Version($exe) {
  try {
    $v = & $exe --version 2>&1
    if ($v -match "(\d+\.\d+\.\d+)") { return $Matches[1] }
    return $null
  } catch { return $null }
}

function Download-AndInstall($url, $dest, $label, $scriptBlock) {
  Step "Baixando $label..."
  Write-Host "       $url" -ForegroundColor DarkGray
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
  } catch {
    Fail "Falha ao baixar $label : $_"
  }
  Ok "$label baixado ($([math]::Round((Get-Item $dest).Length / 1MB, 1)) MB)"

  Step "Instalando $label..."
  & $scriptBlock
  Ok "$label instalado"
}

# ═══════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "████████╗ ██████╗  ██████╗ ██╗     ███████╗████████╗ ██████╗ ██████╗ ██╗   ██╗██╗██████╗ ██╗   ██╗" -ForegroundColor Green
Write-Host "╚══██╔══╝██╔═══██╗██╔═══██╗██║     ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗██║   ██║██║██╔══██╗╚██╗ ██╔╝" -ForegroundColor Green
Write-Host "   ██║   ██║   ██║██║   ██║██║     ███████╗   ██║   ██║   ██║██████╔╝██║   ██║██║██████╔╝ ╚████╔╝ " -ForegroundColor Green
Write-Host "   ██║   ██║   ██║██║   ██║██║     ╚════██║   ██║   ██║   ██║██╔══██╗╚██╗ ██╔╝██║██╔══██╗  ╚██╔╝  " -ForegroundColor Green
Write-Host "   ██║   ╚██████╔╝╚██████╔╝███████╗███████║   ██║   ╚██████╔╝██║  ██║ ╚████╔╝ ██║██████╔╝   ██║   " -ForegroundColor Green
Write-Host "   ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝  ╚═══╝  ╚═╝╚═════╝    ╚═╝   " -ForegroundColor Green
Write-Host ""
Write-Host "  Setup Automático — Gestor NFSe" -ForegroundColor White
Write-Host "  $(Split-Path -Leaf $RepoRoot)" -ForegroundColor DarkGray
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# 1. PRÉ-VERIFICAÇÃO
# ═══════════════════════════════════════════════════════════════════════════
Section "PRÉ-VERIFICAÇÃO"

Step "Verificando ferramentas instaladas..."

$hasNode = Test-Command node
$hasNpm  = Test-Command npm
$hasGit  = Test-Command git
$hasUv   = Test-Command uv

if ($hasNode) {
  $v = Get-Version node
  Ok "Node.js $v encontrado"
} else {
  Warn "Node.js não encontrado — será instalado"
}

if ($hasNpm) {
  $v = Get-Version npm
  Ok "npm $v encontrado"
} else {
  Warn "npm não encontrado — será instalado junto com Node.js"
}

if ($hasGit) {
  $v = Get-Version git
  Ok "Git $v encontrado"
} else {
  Warn "Git não encontrado (opcional)"
}

if ($hasUv) {
  $v = Get-Version uv
  Ok "uv $v encontrado"
} else {
  Warn "uv não encontrado — será instalado"
}

# ═══════════════════════════════════════════════════════════════════════════
# 2. INSTALAR Node.js
# ═══════════════════════════════════════════════════════════════════════════
if (-not $hasNode -and -not $NoNode) {
  Section "INSTALANDO NODE.JS"

  Step "Detectando arquitetura do sistema..."
  $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
  Ok "Arquitetura: $arch"

  $nodeVersion = "22.14.0"
  $nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-$arch.msi"
  $nodeMsi = "$env:TEMP\node-install.msi"

  Write-Host "  Origem: https://nodejs.org (distribuição oficial)" -ForegroundColor DarkGray
  Write-Host "  Versão: $nodeVersion (LTS)" -ForegroundColor DarkGray
  Write-Host ""

  $totalSteps = 5
  $current = 0

  $current++; Bar ($current/$totalSteps*100) "Baixando Node.js $nodeVersion..."
  try { Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing } catch {
    Fail "Falha ao baixar Node.js: $_"
  }
  Ok "Node.js baixado ($([math]::Round((Get-Item $nodeMsi).Length / 1MB, 1)) MB)"
  Write-Host "       $nodeUrl" -ForegroundColor DarkGray

  $current++; Bar ($current/$totalSteps*100) "Instalando Node.js (pode levar alguns minutos)..."
  Start-Process msiexec -ArgumentList "/i `"$nodeMsi`" /quiet /norestart" -Wait
  Remove-Item $nodeMsi -Force
  Ok "Node.js instalado"

  $current++; Bar ($current/$totalSteps*100) "Atualizando PATH da sessão..."
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")

  $current++; Bar ($current/$totalSteps*100) "Verificando instalação..."
  if (Test-Command node) {
    $v = Get-Version node
    Ok "Node.js $v funcionando"
  } else {
    Warn "Node.js instalado, mas reinicie o terminal para usar"
  }

  $current++; Bar ($current/$totalSteps*100) "Concluído"
  Write-Host ""
}

# ═══════════════════════════════════════════════════════════════════════════
# 3. INSTALAR uv (Python)
# ═══════════════════════════════════════════════════════════════════════════
if (-not $hasUv -and -not $NoPython) {
  Section "INSTALANDO uv (GERENCIADOR PYTHON)"

  Write-Host "  Origem: https://github.com/astral-sh/uv (oficial)" -ForegroundColor DarkGray
  Write-Host "  O uv baixa e gerencia a versão correta do Python automaticamente" -ForegroundColor DarkGray
  Write-Host ""

  $totalSteps = 4
  $current = 0

  $current++; Bar ($current/$totalSteps*100) "Baixando uv..."
  $uvUrl = "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
  $uvZip = "$env:TEMP\uv.zip"
  $uvDir = "$env:TEMP\uv-extract"
  try {
    Invoke-WebRequest -Uri $uvUrl -OutFile $uvZip -UseBasicParsing
  } catch {
    Fail "Falha ao baixar uv: $_"
  }
  Ok "uv baixado ($([math]::Round((Get-Item $uvZip).Length / 1MB, 1)) MB)"
  Write-Host "       $uvUrl" -ForegroundColor DarkGray

  $current++; Bar ($current/$totalSteps*100) "Extraindo..."
  if (Test-Path $uvDir) { Remove-Item $uvDir -Recurse -Force }
  Expand-Archive -Path $uvZip -DestinationPath $uvDir -Force
  Remove-Item $uvZip -Force
  $uvExe = Get-ChildItem -Path $uvDir -Recurse -Filter "uv.exe" | Select-Object -First 1
  if (-not $uvExe) { Fail "uv.exe não encontrado após extração" }

  $current++; Bar ($current/$totalSteps*100) "Instalando no PATH do usuário..."
  $binDir = "$env:USERPROFILE\.local\bin"
  if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }
  Copy-Item -Path $uvExe.FullName -Destination "$binDir\uv.exe" -Force
  Copy-Item -Path (Join-Path $uvExe.Directory "uvx.exe") -Destination "$binDir\uvx.exe" -Force
  Remove-Item $uvDir -Recurse -Force
  $env:Path = "$binDir;$env:Path"

  $current++; Bar ($current/$totalSteps*100) "Verificando..."
  if (Test-Command uv) {
    $v = Get-Version uv
    Ok "uv $v instalado em $binDir"
  } else {
    Warn "uv instalado, mas reinicie o terminal para usar"
  }
  Write-Host ""

  Section "INSTALANDO PYTHON 3.12 (VIA uv)"
  Step "uv gerencia o Python — baixando Python 3.12..."
  Write-Host "  O uv baixa o Python oficial de python.org automaticamente" -ForegroundColor DarkGray
  try { & "$binDir\uv.exe" python install 3.12 } catch {
    Fail "Falha ao instalar Python 3.12: $_"
  }
  Ok "Python 3.12 pronto via uv"
  Write-Host ""
}

# ═══════════════════════════════════════════════════════════════════════════
# 4. CONFIGURAR BACKEND
# ═══════════════════════════════════════════════════════════════════════════
Section "CONFIGURANDO BACKEND"

$backendDir = Join-Path $RepoRoot "backend"
Set-Location $backendDir

# Descobrir uv
$uvCmd = if (Test-Command uv) { "uv" } else { "$env:USERPROFILE\.local\bin\uv.exe" }

Step "Instalando dependências Python..."
Write-Host "  Comando: $uvCmd sync" -ForegroundColor DarkGray
Write-Host "  Dependências:" -ForegroundColor DarkGray
Write-Host "    • fastapi — Framework web" -ForegroundColor DarkGray
Write-Host "    • uvicorn — Servidor ASGI" -ForegroundColor DarkGray
Write-Host "    • pythonnet — Integração .NET (Unimake)" -ForegroundColor DarkGray
Write-Host "    • cryptography — Manipulação de certificados" -ForegroundColor DarkGray
Write-Host ""
try {
  & $uvCmd sync 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
} catch {
  Fail "Falha ao instalar dependências: $_"
}
Ok "Dependências do backend instaladas"

Step "Verificando config.toml..."
$configFile = Join-Path $backendDir "config.toml"
$configExample = Join-Path $backendDir "config.toml.example"
if (-not (Test-Path $configFile)) {
  if (Test-Path $configExample) {
    Copy-Item $configExample $configFile
    Warn "config.toml criado a partir do template"
    Write-Host "       Edite o arquivo com seus dados (CNPJ, certificado, ambiente)" -ForegroundColor DarkYellow
  }
} else {
  Ok "config.toml já existe"
}

Set-Location $RepoRoot

# ═══════════════════════════════════════════════════════════════════════════
# 5. CONFIGURAR FRONTEND
# ═══════════════════════════════════════════════════════════════════════════
Section "CONFIGURANDO FRONTEND"

$frontendDir = Join-Path $RepoRoot "frontend"
Set-Location $frontendDir

Step "Instalando dependências Node.js..."
Write-Host "  Comando: npm install" -ForegroundColor DarkGray
Write-Host "  Dependências principais:" -ForegroundColor DarkGray
Write-Host "    • react + react-dom — UI" -ForegroundColor DarkGray
Write-Host "    • vite — Bundler e dev server" -ForegroundColor DarkGray
Write-Host "    • tailwindcss — Estilos" -ForegroundColor DarkGray
Write-Host "    • lucide-react — Ícones" -ForegroundColor DarkGray
Write-Host "    • node-forge — Extração de certificados" -ForegroundColor DarkGray
Write-Host ""

try {
  npm install --loglevel=warn 2>&1 | ForEach-Object {
    if ($_ -match "error|ERR|fail") { Write-Host "    $_" -ForegroundColor Red }
    elseif ($_ -match "warn|WARN") { Write-Host "    $_" -ForegroundColor DarkYellow }
  }
} catch {
  Fail "Falha ao instalar dependências do frontend: $_"
}
Ok "Dependências do frontend instaladas"

Set-Location $RepoRoot

# ═══════════════════════════════════════════════════════════════════════════
# 6. BUILD DO FRONTEND
# ═══════════════════════════════════════════════════════════════════════════
Section "BUILD DO FRONTEND"

Set-Location $frontendDir
Step "Compilando frontend para produção..."
Write-Host "  Saída: backend/dist/" -ForegroundColor DarkGray
Write-Host ""

try {
  npm run build 2>&1 | ForEach-Object {
    if ($_ -match "✓ built") { Write-Host "    $_" -ForegroundColor Green }
    elseif ($_ -match "error|ERR") { Write-Host "    $_" -ForegroundColor Red }
    else { Write-Host "    $_" -ForegroundColor DarkGray }
  }
} catch {
  Fail "Falha ao compilar frontend: $_"
}
Ok "Frontend compilado"

Set-Location $RepoRoot

# ═══════════════════════════════════════════════════════════════════════════
# RESUMO FINAL
# ═══════════════════════════════════════════════════════════════════════════
Section "✅ SETUP CONCLUÍDO"

Write-Host "  Tudo pronto! Para iniciar o projeto:" -ForegroundColor White
Write-Host ""
Write-Host "  ┌────────────────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "  │                                                        │" -ForegroundColor Cyan
Write-Host "  │  🖥  BACKEND" -ForegroundColor Yellow
Write-Host "  │     cd backend" -ForegroundColor White
Write-Host "  │     uv run uvicorn main:app --host 127.0.0.1 --port 8001" -ForegroundColor White
Write-Host "  │                                                        │" -ForegroundColor Cyan
Write-Host "  │     http://localhost:8001/docs    (API Swagger)" -ForegroundColor Green
Write-Host "  │                                                        │" -ForegroundColor Cyan
Write-Host "  │  🌐  FRONTEND (dev — outro terminal)" -ForegroundColor Yellow
Write-Host "  │     cd frontend" -ForegroundColor White
Write-Host "  │     npm run dev" -ForegroundColor White
Write-Host "  │                                                        │" -ForegroundColor Cyan
Write-Host "  │     http://localhost:3000         (App)" -ForegroundColor Green
Write-Host "  │                                                        │" -ForegroundColor Cyan
Write-Host "  └────────────────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $configFile)) {
  Warn "Lembrete: edite backend/config.toml com seus dados antes de iniciar"
  Write-Host ""
}
