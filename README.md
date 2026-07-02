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
  estabelecimento de exemplo a partir de `clients/exemplo.json`.

## Instalação

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
computador do próprio estabelecimento. Para colocar a TecCell no ar num computador novo:

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

Na aba **Cardápio**, cadastre os acessórios da loja de vendas (capinhas, carregadores, fones...),
com preço e, se quiser controlar quantidade, o campo **Estoque** — deixe em branco para não
controlar estoque daquele item. Itens com estoque `0` somem automaticamente da lista que o cliente
vê no WhatsApp.

Teste no WhatsApp da loja: mande "oi", escolha **1** (Solicitar manutenção) e siga o fluxo — ele vai
gerar um protocolo (ex: `#0001`). Depois escolha **2** (Consultar status) e informe o protocolo ou
o nome para ver o status atual. Na aba **Serviços** do painel, você consegue mudar o status
(Em análise → Em manutenção → Aguardando peça → Concluído) e definir uma previsão de entrega — a
próxima consulta do cliente já reflete a mudança.

### 7. Deixar rodando 24h

Veja a seção [Deploy](#deploy--por-que-não-uma-paas-gratuita-renderrailwayheroku) mais abaixo — o
recomendado é usar o [PM2](https://pm2.keymetrics.io/) para reiniciar sozinho em caso de queda de
energia ou reinício do computador.

## Usando o painel

- **Cardápio**: adicionar, editar preço/disponibilidade/estoque e excluir itens (serve tanto para
  cardápio de comida/serviços quanto para produtos de loja). As mudanças valem imediatamente para o
  bot, sem precisar reiniciar. Itens com estoque `0` somem da lista que o cliente vê. O **nome
  dessa seção é personalizável por estabelecimento** — configure em Configurações → "Nome da seção
  de itens" (ex: `🍽️ Cardápio` para um restaurante/salão, `🛍️ Loja de Acessórios` para uma
  assistência técnica, `📦 Produtos` para qualquer outro tipo de loja). O texto escolhido aparece
  tanto na aba do painel quanto nas mensagens que o cliente recebe no WhatsApp.
- **Pedidos**: ver todos os pedidos recebidos (cardápio ou agendamento) e marcar como
  `pago`/`concluido`/`cancelado` conforme o pagamento é confirmado manualmente.
- **Serviços**: para fluxos de manutenção/assistência técnica — ver todas as solicitações com
  protocolo, cliente, aparelho e serviço, e atualizar o status (`Em análise` → `Em manutenção` →
  `Aguardando peça` → `Concluído`) e a previsão de entrega. O cliente vê a mudança na próxima vez
  que consultar o status pelo WhatsApp.
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

- **Um computador ou mini-PC próprio, sempre ligado** (a opção realmente gratuita), rodando
  `npm start` com um gerenciador de processos como [PM2](https://pm2.keymetrics.io/) para reiniciar
  automaticamente em caso de queda:
  ```
  npm install -g pm2
  pm2 start index.js --name gaspy-botzap
  pm2 save
  pm2 startup
  ```
- Alternativa de baixo custo (não gratuita, mas muito barata) se não houver uma máquina disponível:
  uma VPS simples (ex: ~R$20-30/mês) com disco persistente, rodando da mesma forma com PM2.

## Estrutura do projeto

```
index.js                    # ponto de entrada: sobe o bot + o painel
src/bot/                    # cliente WhatsApp e roteamento de mensagens
src/flows/                  # máquina de estados do Plano Básico (menus, pedido/cardápio, manutenção, status)
src/ai/                     # atendimento com IA do Plano Profissional (Groq)
src/pix/                    # geração do PIX Copia e Cola (BR Code)
src/database/               # conexão SQLite, schema e repositórios
painel/                     # painel web (Express + HTML/CSS/JS puro)
clients/exemplo.json        # dado inicial (salão) usado só no primeiro seed do banco
clients/teccell.json        # dado inicial (assistência técnica) usado só no primeiro seed do banco
data/gaspy.db               # banco SQLite (criado automaticamente)
```

## Scripts

- `npm start` — inicia o bot e o painel.
- `npm run dev` — mesmo que `start`, com reinício automático (nodemon) ao editar arquivos.
- `npm run seed` — roda o seed manualmente (normalmente automático na primeira execução).
- `node ver-agendamentos.js` — lista no terminal os agendamentos/pedidos registrados.

## Expansão para múltiplos estabelecimentos (multi-tenant)

A base já está pronta para isso: todas as tabelas (`cardapio_itens`, `pedidos`,
`servicos_agendados`, `sessoes`, `mensagens_log`) são segmentadas por `estabelecimento_id`. Para
atender mais de um estabelecimento, hoje é necessário rodar um processo Node por estabelecimento
(cada `whatsapp-web.js` só controla um número de WhatsApp), cada um com seu próprio `CLIENT_ID` e
`SESSION_PATH` no `.env`. Um painel central único e um "gerenciador" de múltiplos processos ficam
como próxima evolução natural.

### Criando uma nova loja/estabelecimento

Cada estabelecimento tem um arquivo `clients/<client_id>.json` (ex: `clients/teccell.json`) usado
**apenas na primeira execução**, para semear o banco daquela instalação. Para uma nova loja:

1. Copie um dos arquivos existentes (`clients/exemplo.json` para fluxo de menu com agendamento,
   `clients/teccell.json` para fluxo de manutenção com protocolo) como `clients/<novo_id>.json`.
2. Ajuste `nome_empresa`, `saudacao`, `menu_principal` (as ações disponíveis são: `mensagem`,
   `submenu`, `coletar_dados`, `cardapio`, `manutencao`, `consultar_status` e `transferir`) e o
   `rotulo_catalogo` (o nome que a seção de itens vai ter para esse tipo de negócio).
3. No `.env` daquela instalação, defina `CLIENT_ID=<novo_id>`.
4. Rode `npm start` — o restante (chave PIX, produtos/cardápio, horários) é configurado depois
   direto pelo painel, sem precisar editar o JSON de novo.
