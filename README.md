# Gaspy BOTZAP

Sistema de autoatendimento via WhatsApp para estabelecimentos, com dois planos:

- **Básico**: menu por mensagens pré-configuradas, cardápio dinâmico (editável no painel) e
  pagamento via PIX Copia e Cola.
- **Profissional**: atendimento conversacional com IA (Groq, gratuito), que responde dúvidas,
  sugere itens do cardápio e fecha pedidos com PIX automaticamente.

Todo o sistema roda com tecnologias gratuitas: [whatsapp-web.js](https://wwebjs.dev/) (automação
do WhatsApp Web, sem custo por conversa), SQLite (banco embutido, sem servidor) e a API gratuita da
[Groq](https://console.groq.com/) para o plano com IA.

## Como funciona

- Um único processo Node.js roda o bot do WhatsApp **e** o painel administrativo web.
- Os dados (cardápio/produtos, configurações, pedidos, serviços agendados com protocolo, sessões de
  conversa, logs) ficam em `data/gaspy.db` (SQLite).
- Na primeira execução, se o banco estiver vazio, o sistema semeia automaticamente um
  estabelecimento a partir de `clients/<CLIENT_ID>.json` (padrão: `clients/teccell.json`).

## Instalação rápida com Docker (recomendado)

Essa é a forma mais simples de instalar: **não precisa instalar Node.js nem Git**, só o Docker.
Um único comando baixa o projeto, monta tudo e já deixa rodando.

**O que você precisa ter instalado antes:** [Docker](https://docs.docker.com/get-docker/) (no
Windows, isso é o "Docker Desktop"). É a única instalação manual necessária — depois disso, todo
o resto é automático, inclusive para futuras lojas nesse mesmo computador.

### Linux / macOS

```bash
curl -fsSL https://raw.githubusercontent.com/diogoeduardo777/Gaspy-BOTZAP/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/diogoeduardo777/Gaspy-BOTZAP/main/install.ps1 | iex
```

Esses comandos baixam o projeto (sem precisar de Git), criam o `.env` a partir do modelo, e sobem
o sistema com `docker compose`. Ao final, o terminal mostra a pasta onde o projeto foi instalado e
os próximos passos.

Se preferir revisar o script antes de rodar (recomendável sempre que for colar um comando de
instalação de alguém na internet — inclusive o nosso), abra
[`install.sh`](install.sh) ou [`install.ps1`](install.ps1) e veja o que ele faz: só baixa o
código-fonte do próprio repositório e chama `docker compose`.

### Depois de instalar

1. Edite o `.env` criado na pasta do projeto — no mínimo, defina uma `PAINEL_SENHA` própria e
   (se for usar) a `GROQ_API_KEY`. Depois de editar, aplique com:
   ```
   docker compose up -d --build
   ```
2. Veja o QR Code do WhatsApp:
   ```
   docker compose logs -f
   ```
   Escaneie com o celular do estabelecimento (Aparelhos conectados → Conectar um aparelho).
3. Acesse o painel em `http://localhost:3000` (ou na porta que você definiu em `PAINEL_PORT`).

Comandos úteis do dia a dia:

| Ação | Comando |
|---|---|
| Ver logs / QR Code | `docker compose logs -f` |
| Parar | `docker compose stop` |
| Iniciar de novo | `docker compose start` |
| Atualizar para uma versão nova do código | `docker compose up -d --build` |

A sessão do WhatsApp e o banco de dados ficam salvos nas pastas `sessions/` e `data/` **fora** do
container (graças aos volumes do `docker-compose.yml`), então reiniciar ou atualizar o container
não apaga nada nem pede escanear o QR Code de novo.

> ⚠️ Não testamos o build Docker numa máquina com Docker instalado durante o desenvolvimento desta
> automação (só revisamos cuidadosamente o `Dockerfile`/`docker-compose.yml`). Rode uma vez num
> ambiente de teste antes de confiar 100% nela para a loja.

## Instalação manual (sem Docker)

Alternativa para quem já tem Node.js instalado ou quer rodar em modo de desenvolvimento
(`npm run dev`, com reinício automático ao editar arquivos).

1. Instale as dependências:
   ```
   npm install
   ```
2. Copie o arquivo de variáveis de ambiente e ajuste os valores:
   ```
   copy .env.example .env
   ```
   No mínimo, defina uma `PAINEL_SENHA` própria. Se for usar o Plano Profissional, defina também
   `GROQ_API_KEY` (chave gratuita em https://console.groq.com/keys).
3. Rode o sistema:
   ```
   npm start
   ```
4. Escaneie o QR Code exibido no terminal com o WhatsApp do estabelecimento (Aparelhos
   conectados → Conectar um aparelho).
5. Acesse o painel em `http://localhost:3000` e informe a `PAINEL_SENHA` configurada.

Nas próximas vezes, `npm start` reconecta a sessão salva em `sessions/` sem precisar escanear o QR
de novo — desde que a pasta não seja apagada.

## Guia rápido: instalar em um novo computador (ex: loja TecCell)

Cada estabelecimento roda seu **próprio processo**, com seu **próprio número de WhatsApp**, no
computador do próprio estabelecimento.

**Caminho mais simples:** rode o comando da seção [Instalação rápida com Docker](#instalação-rápida-com-docker-recomendado)
no computador da loja — ele já baixa o projeto e sobe tudo sozinho, sem precisar instalar Node.js
ou Git. Só depois disso, ajuste o `.env` (`CLIENT_ID=teccell`, `PAINEL_SENHA`) e rode
`docker compose up -d --build` de novo para aplicar.

O passo a passo abaixo é a via manual (sem Docker), para quem preferir ou não puder instalar Docker
no computador da loja:

### 1. Levar os arquivos do projeto para o computador da loja

Opção mais simples, via Git (recomendado se o computador tiver acesso à internet):
```
git clone https://github.com/diogoeduardo777/Gaspy-BOTZAP.git
cd Gaspy-BOTZAP
```
Se o repositório for privado, será pedido login do GitHub na hora do clone.

Alternativa sem Git: copie a pasta do projeto para um pendrive **sem** as pastas `node_modules/`,
`sessions/` e `data/` (elas são recriadas automaticamente), leve até o computador da loja e cole em
um local como `C:\Gaspy-BOTZAP`.

### 2. Instalar o Node.js

Baixe e instale a versão LTS em https://nodejs.org (marque a opção padrão de instalação). Não é
necessário instalar o Chrome separadamente — o próprio `npm install` baixa um Chromium para o bot
usar.

### 3. Instalar as dependências do projeto

Abra o terminal (PowerShell) dentro da pasta do projeto e rode:
```
npm install
```

### 4. Configurar o `.env` para a TecCell

```
copy .env.example .env
```
Abra o `.env` num editor de texto e ajuste:
```
CLIENT_ID=teccell
PAINEL_SENHA=escolha-uma-senha-seguranca
```
Deixe `GROQ_API_KEY` em branco por enquanto (a TecCell começa no Plano Básico, sem IA — dá para
ativar depois pelo painel, bastando preencher essa chave e trocar o plano).

### 5. Rodar e conectar o WhatsApp da loja

```
npm start
```
Na primeira execução, o sistema cria o banco `data/gaspy.db` e semeia automaticamente o
estabelecimento "TecCell" a partir de `clients/teccell.json` (menu com as 4 opções: Solicitar
manutenção, Consultar status, Loja de acessórios, Falar com atendente).

Escaneie o QR Code exibido no terminal com o **WhatsApp da loja** (Aparelhos conectados → Conectar
um aparelho).

### 6. Ajustar os dados reais pelo painel

Acesse `http://localhost:3000`, informe a `PAINEL_SENHA` e ajuste na aba **Configurações**:
- Número do atendente, horário de atendimento, chave PIX (+ nome do recebedor e cidade).

Na aba **🍽️ Loja de Acessórios**, cadastre os acessórios da loja de vendas (capinhas, carregadores,
fones...), com preço e, se quiser controlar quantidade, o campo **Estoque** — deixe em branco para
não controlar estoque daquele item. Itens com estoque `0` somem automaticamente da lista que o
cliente vê no WhatsApp.

Na aba **🧰 Cadastro de Serviços**, já vêm 6 serviços de exemplo (Diagnóstico, Troca de tela, Troca
de bateria, Formatação, Upgrade de SSD, Limpeza interna) com preços de referência — edite os preços
reais ou adicione/remova serviços. É essa lista que o cliente vê ao escolher "Solicitar manutenção".

Teste no WhatsApp da loja: mande "oi", escolha **1** (Solicitar manutenção) e siga o fluxo — ele
mostra a lista de serviços cadastrados com preço e gera um protocolo (ex: `#0001`). Depois escolha
**2** (Consultar status) e informe o protocolo ou o nome para ver o status atual. Na aba
**📋 Pedidos e Agendamentos** do painel, você consegue mudar o status (Em análise → Em manutenção →
Aguardando peça → Concluído) e definir uma previsão de entrega — a próxima consulta do cliente já
reflete a mudança.

### 7. Deixar rodando 24h

Se instalou via Docker, isso já está resolvido: `restart: unless-stopped` no `docker-compose.yml`
faz o container voltar sozinho depois de uma queda de energia ou reinício do computador (mesmo que
o Docker Desktop precise abrir automaticamente ao ligar o Windows, o que ele já faz por padrão).

Se instalou pela via manual (sem Docker), veja a seção
[Deploy](#deploy--por-que-não-uma-paas-gratuita-renderrailwayheroku) mais abaixo — o recomendado é
usar o [PM2](https://pm2.keymetrics.io/) para reiniciar sozinho.

## Usando o painel

- **Produtos/Acessórios** (aba com nome personalizável): adicionar, editar preço/disponibilidade/
  estoque e excluir itens à venda. As mudanças valem imediatamente para o bot, sem precisar
  reiniciar. Itens com estoque `0` somem da lista que o cliente vê. O **nome dessa seção é
  personalizável por estabelecimento** — configure em Configurações → "Nome da seção de itens" (ex:
  `🍽️ Cardápio` para um restaurante/salão, `🛍️ Loja de Acessórios` para uma assistência técnica,
  `📦 Produtos` para qualquer outro tipo de loja). O texto escolhido aparece tanto na aba do painel
  quanto nas mensagens que o cliente recebe no WhatsApp.
- **🧰 Cadastro de Serviços**: os tipos de serviço que o estabelecimento oferece (ex: troca de tela,
  formatação), cada um com nome, descrição opcional e preço opcional. É essa lista que aparece para
  o cliente escolher ao "Solicitar manutenção" pelo WhatsApp.
- **📋 Pedidos e Agendamentos**: uma lista só, mais recente primeiro, com tudo que os clientes
  pediram pelo WhatsApp — compras de produtos e solicitações de manutenção — cada linha marcada como
  🛍️ Produto ou 🔧 Serviço. Atualize o status conforme o andamento
  (produtos: `Pendente`/`Pago`/`Cancelado`/`Concluído`; serviços: `Em análise`/`Em manutenção`/
  `Aguardando peça`/`Concluído`) — o cliente vê a mudança na próxima consulta pelo WhatsApp.
- **Configurações**: dados do estabelecimento, chave PIX (e nome/cidade do recebedor, exigidos
  pelo padrão do PIX Copia e Cola) e o plano (`basico` ou `profissional`).

## Sobre o pagamento via PIX

O sistema gera o código "PIX Copia e Cola" localmente (sem gateway, sem taxa, sem cadastro em
PSP), a partir da chave PIX cadastrada no painel. A confirmação do pagamento é **manual**: o
cliente paga e envia o comprovante, e o dono marca o pedido como `pago` no painel. Isso mantém o
sistema 100% gratuito. Se no futuro for necessário confirmar pagamentos automaticamente, dá para
integrar um PSP com webhook (ex: Mercado Pago, Efí) sem mudar o restante do fluxo.

## Sobre o Plano Profissional (IA)

Usa a API gratuita da Groq (compatível com o formato OpenAI), com o modelo `llama-3.3-70b-versatile`
por padrão (configurável via `GROQ_MODEL`). O modelo recebe o cardápio atualizado a cada mensagem
e pode registrar um pedido chamando uma ferramenta interna — o código do PIX nunca passa pela IA,
é sempre gerado e enviado literalmente pelo backend, para não haver risco de o código ser
reescrito/corrompido pelo modelo.

## Deploy — por que não uma PaaS gratuita (Render/Railway/Heroku)?

O `whatsapp-web.js` depende de duas coisas que planos gratuitos de PaaS normalmente não garantem:

1. **Um processo Chromium sempre ativo** — planos free costumam hibernar o serviço após
   inatividade, o que derruba a conexão do WhatsApp.
2. **Disco persistente** para a pasta `sessions/` — sem isso, a cada novo deploy/restart o
   WhatsApp pede para escanear o QR Code de novo.

Por isso, para rodar 24 horas de verdade e de graça, a recomendação é:

- **Um computador ou mini-PC próprio, sempre ligado** (a opção realmente gratuita). Instalando via
  [Docker](#instalação-rápida-com-docker-recomendado), o próprio `restart: unless-stopped` do
  `docker-compose.yml` já cuida de reiniciar sozinho — não precisa de PM2. Se instalar pela via
  manual (sem Docker), use o [PM2](https://pm2.keymetrics.io/):
  ```
  npm install -g pm2
  pm2 start index.js --name gaspy-botzap
  pm2 save
  pm2 startup
  ```
- Alternativa de baixo custo (não gratuita, mas muito barata) se não houver uma máquina disponível:
  uma VPS simples (ex: ~R$20-30/mês) com disco persistente, rodando com Docker ou PM2 da mesma
  forma.

## Estrutura do projeto

```
index.js                    # ponto de entrada: sobe o bot + o painel
src/bot/                    # cliente WhatsApp e roteamento de mensagens
src/flows/                  # máquina de estados do Plano Básico (menus, pedido/cardápio, manutenção, status)
src/ai/                     # atendimento com IA do Plano Profissional (Groq)
src/pix/                    # geração do PIX Copia e Cola (BR Code)
src/database/               # conexão SQLite, schema e repositórios
painel/                     # painel web (Express + HTML/CSS/JS puro)
clients/exemplo.json        # modelo (salão/comida) — não é mais o padrão, fica de referência
clients/teccell.json        # dado inicial padrão (assistência técnica), usado no primeiro seed
data/gaspy.db               # banco SQLite (criado automaticamente)
Dockerfile                  # imagem do bot+painel (build em 2 etapas, Chromium do sistema)
docker-compose.yml          # sobe o container com volumes persistentes (sessions/, data/)
.dockerignore               # o que não entra na imagem (node_modules, .env, etc.)
install.sh / install.ps1    # instalação em um comando (Linux/Mac e Windows), sem Node.js/Git
```

## Scripts

- `npm start` — inicia o bot e o painel.
- `npm run dev` — mesmo que `start`, com reinício automático (nodemon) ao editar arquivos.
- `npm run seed` — roda o seed manualmente (normalmente automático na primeira execução).
- `node ver-agendamentos.js` — lista no terminal os agendamentos/pedidos registrados.

## Expansão para múltiplos estabelecimentos (multi-tenant)

A base já está pronta para isso: todas as tabelas (`cardapio_itens`, `pedidos`,
`servicos_agendados`, `servicos_catalogo`, `sessoes`, `mensagens_log`) são segmentadas por
`estabelecimento_id`. Para atender mais de um estabelecimento, hoje é necessário rodar um processo Node por estabelecimento
(cada `whatsapp-web.js` só controla um número de WhatsApp), cada um com seu próprio `CLIENT_ID` e
`SESSION_PATH` no `.env`. Um painel central único e um "gerenciador" de múltiplos processos ficam
como próxima evolução natural.

### Criando uma nova loja/estabelecimento

Cada estabelecimento tem um arquivo `clients/<client_id>.json` (ex: `clients/teccell.json`) usado
**apenas na primeira execução**, para semear o banco daquela instalação. Para uma nova loja:

1. Copie um dos arquivos existentes (`clients/exemplo.json` para fluxo de menu com agendamento tipo
   salão, `clients/teccell.json` para fluxo de manutenção com protocolo tipo assistência técnica)
   como `clients/<novo_id>.json`.
2. Ajuste `nome_empresa`, `saudacao`, `menu_principal` (as ações disponíveis são: `mensagem`,
   `submenu`, `coletar_dados`, `cardapio`, `manutencao`, `consultar_status` e `transferir`), o
   `rotulo_catalogo` (o nome que a seção de produtos vai ter para esse tipo de negócio) e, se for
   usar o fluxo de manutenção, o array `servicos_catalogo` (lista de `{ nome, descricao, preco }`
   com os tipos de serviço já cadastrados de cara).
3. No `.env` daquela instalação, defina `CLIENT_ID=<novo_id>`.
4. Rode `npm start` — o restante (chave PIX, produtos, serviços, horários) é configurado depois
   direto pelo painel, sem precisar editar o JSON de novo.
