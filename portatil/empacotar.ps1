# empacotar.ps1 — monta o pacote PORTÁTIL (Windows x64) do Gaspy BOTZAP.
#
# Rode este script UMA vez NA SUA máquina (que tem Node.js instalado) para gerar um .zip
# que você envia para a loja. Na loja, o cliente só descompacta e dá duplo clique em
# "iniciar.bat" — não precisa instalar Node.js nem Docker.
#
# Uso (PowerShell, dentro da pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File portatil\empacotar.ps1

$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot   # a pasta portatil/ fica dentro do projeto
$nomePacote = 'Gaspy-BOTZAP-portatil'
$saida = Join-Path $raiz 'dist'
$destino = Join-Path $saida $nomePacote
$cacheChromium = Join-Path $raiz '.chromium-portatil'

Write-Host '==> Verificando Node.js...'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host 'Node.js não encontrado. Instale em https://nodejs.org e rode este script de novo.'
  exit 1
}
$nodeExe = $node.Source
Write-Host "    Node encontrado em: $nodeExe"

Write-Host '==> Instalando dependências de produção + baixando o Chromium para dentro do pacote...'
$env:PUPPETEER_CACHE_DIR = $cacheChromium
Push-Location $raiz
npm ci --omit=dev
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host 'Falha no npm ci.'; exit 1 }
Pop-Location

if (-not (Test-Path $cacheChromium)) {
  Write-Host 'AVISO: o Chromium não foi baixado automaticamente. Tentando baixar explicitamente...'
  Push-Location $raiz
  npx --yes puppeteer browsers install chrome
  Pop-Location
}

Write-Host '==> Preparando a pasta do pacote...'
if (Test-Path $destino) { Remove-Item $destino -Recurse -Force }
New-Item -ItemType Directory -Force -Path $destino | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $destino 'runtime') | Out-Null

# Arquivos do projeto (sem estado/execução: data/, sessions/, .git, .env ficam de fora).
$itens = @('index.js', 'package.json', 'package-lock.json', 'src', 'painel', 'clients')
foreach ($item in $itens) {
  Copy-Item (Join-Path $raiz $item) (Join-Path $destino $item) -Recurse -Force
}

Write-Host '==> Copiando node_modules e o Chromium (isso demora um pouco)...'
Copy-Item (Join-Path $raiz 'node_modules') (Join-Path $destino 'node_modules') -Recurse -Force
Copy-Item $cacheChromium (Join-Path $destino '.chromium-portatil') -Recurse -Force

# node.exe da sua máquina — mesma versão que compilou os módulos nativos (garante compatibilidade).
Copy-Item $nodeExe (Join-Path $destino 'runtime\node.exe') -Force

# Scripts que o cliente vai usar (ficam na raiz do pacote).
Copy-Item (Join-Path $PSScriptRoot 'iniciar.bat') (Join-Path $destino 'iniciar.bat') -Force
Copy-Item (Join-Path $PSScriptRoot 'instalar-inicializacao.bat') (Join-Path $destino 'instalar-inicializacao.bat') -Force
Copy-Item (Join-Path $PSScriptRoot 'desinstalar-inicializacao.bat') (Join-Path $destino 'desinstalar-inicializacao.bat') -Force
Copy-Item (Join-Path $PSScriptRoot 'LEIA-ME.txt') (Join-Path $destino 'LEIA-ME.txt') -Force

Write-Host '==> Compactando o pacote (.zip)...'
$zip = Join-Path $saida ($nomePacote + '.zip')
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $destino -DestinationPath $zip

Write-Host ''
Write-Host "✅ Pronto! Pacote gerado em: $zip"
Write-Host 'Envie esse .zip para a loja. Lá: descompactar e dar duplo clique em "iniciar.bat".'
