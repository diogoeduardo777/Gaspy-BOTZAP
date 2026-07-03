#!/usr/bin/env bash
# Instala e sobe o Gaspy BOTZAP num comando só, sem precisar de Node.js ou Git instalados.
# Só é necessário ter o Docker instalado (https://docs.docker.com/get-docker/).
#
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/diogoeduardo777/Gaspy-BOTZAP/main/install.sh | bash
set -euo pipefail

REPO_TARBALL="https://github.com/diogoeduardo777/Gaspy-BOTZAP/archive/refs/heads/main.tar.gz"
DEST_DIR="Gaspy-BOTZAP"

echo "🔎 Verificando se o Docker está instalado..."
if ! command -v docker &> /dev/null; then
  echo "❌ Docker não encontrado."
  echo "   Instale o Docker antes de continuar: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "❌ O plugin 'docker compose' não foi encontrado (versão do Docker muito antiga?)."
  echo "   Atualize o Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

if [ -d "$DEST_DIR" ]; then
  echo "📁 Pasta '$DEST_DIR' já existe, usando ela (não baixei de novo)."
else
  echo "⬇️  Baixando o projeto (sem precisar de Git)..."
  curl -fsSL "$REPO_TARBALL" -o gaspy-botzap.tar.gz
  mkdir -p "$DEST_DIR"
  tar -xzf gaspy-botzap.tar.gz -C "$DEST_DIR" --strip-components=1
  rm gaspy-botzap.tar.gz
fi

cd "$DEST_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 Criei o arquivo .env a partir do modelo (.env.example)."
  echo "   Edite-o depois para configurar CLIENT_ID, PAINEL_SENHA, chave PIX etc."
fi

echo "🐳 Construindo a imagem e iniciando o sistema (isso pode demorar alguns minutos na primeira vez)..."
docker compose up -d --build

PORTA=$(grep -E '^PAINEL_PORT=' .env | cut -d '=' -f2)
PORTA=${PORTA:-3000}
CAMINHO_COMPLETO=$(pwd)

echo ""
echo "✅ Pronto! O bot e o painel estão rodando."
echo ""
echo "📂 Pasta do projeto: $CAMINHO_COMPLETO"
echo "   (os próximos comandos precisam ser rodados de dentro dela: cd \"$CAMINHO_COMPLETO\")"
echo ""
echo "📱 Para ver o QR Code do WhatsApp (escaneie com o celular do estabelecimento):"
echo "   docker compose logs -f"
echo ""
echo "🖥️  Painel administrativo: http://localhost:${PORTA}"
echo ""
echo "Para parar:            docker compose stop"
echo "Para iniciar de novo:  docker compose start"
echo "Para atualizar depois: docker compose up -d --build"
