# syntax=docker/dockerfile:1

# ---------- Etapa 1: instalar dependências (precisa de toolchain nativo p/ better-sqlite3) ----------
FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# O Chromium do sistema (instalado na etapa de runtime) é quem roda o bot — não precisamos que o
# pacote "puppeteer" baixe o próprio Chromium aqui.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# ---------- Etapa 2: imagem final, só com o necessário para rodar ----------
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    TZ=America/Sao_Paulo \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY --from=build /app /app

EXPOSE 3000

CMD ["node", "index.js"]
