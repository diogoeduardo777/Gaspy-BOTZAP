# Instala e sobe o Gaspy BOTZAP num comando só, sem precisar de Node.js ou Git instalados.
# Só é necessário ter o Docker Desktop instalado (https://www.docker.com/products/docker-desktop/).
#
# Uso (PowerShell):
#   irm https://raw.githubusercontent.com/diogoeduardo777/Gaspy-BOTZAP/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$RepoZip = "https://github.com/diogoeduardo777/Gaspy-BOTZAP/archive/refs/heads/main.zip"
$DestDir = "Gaspy-BOTZAP"

Write-Host "Verificando se o Docker está instalado..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker não encontrado."
    Write-Host "Instale o Docker Desktop antes de continuar: https://www.docker.com/products/docker-desktop/"
    exit 1
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "O plugin 'docker compose' não foi encontrado (Docker Desktop desatualizado?)."
    Write-Host "Atualize o Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
}

if (Test-Path $DestDir) {
    Write-Host "Pasta '$DestDir' já existe, usando ela (não baixei de novo)."
} else {
    Write-Host "Baixando o projeto (sem precisar de Git)..."
    Invoke-WebRequest -Uri $RepoZip -OutFile gaspy-botzap.zip
    Expand-Archive -Path gaspy-botzap.zip -DestinationPath . -Force
    Rename-Item -Path "Gaspy-BOTZAP-main" -NewName $DestDir
    Remove-Item gaspy-botzap.zip
}

Set-Location $DestDir

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Criei o arquivo .env a partir do modelo (.env.example)."
    Write-Host "Edite-o depois para configurar CLIENT_ID, PAINEL_SENHA, chave PIX etc."
}

Write-Host "Construindo a imagem e iniciando o sistema (isso pode demorar alguns minutos na primeira vez)..."
docker compose up -d --build

$envContent = Get-Content .env | Where-Object { $_ -match '^PAINEL_PORT=' }
$porta = if ($envContent) { ($envContent -split '=')[1] } else { "3000" }
$caminhoCompleto = (Get-Location).Path

Write-Host ""
Write-Host "Pronto! O bot e o painel estão rodando."
Write-Host ""
Write-Host "Pasta do projeto: $caminhoCompleto"
Write-Host "(os próximos comandos precisam ser rodados de dentro dela: cd `"$caminhoCompleto`")"
Write-Host ""
Write-Host "Para ver o QR Code do WhatsApp (escaneie com o celular do estabelecimento):"
Write-Host "  docker compose logs -f"
Write-Host ""
Write-Host "Painel administrativo: http://localhost:$porta"
Write-Host ""
Write-Host "Para parar:            docker compose stop"
Write-Host "Para iniciar de novo:  docker compose start"
Write-Host "Para atualizar depois: docker compose up -d --build"
