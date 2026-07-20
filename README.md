# Gaspy BOTZAP — Guia de instalação

Este guia é o **passo a passo prático** para colocar o sistema rodando no computador do
estabelecimento, com tudo funcionando: **WhatsApp**, **banco de dados** e **impressão da ordem de
serviço**.

O sistema é um atendente automático de WhatsApp + um painel web onde o dono gerencia produtos,
serviços, pedidos e ordens de serviço. Roda **no computador do próprio estabelecimento** (não é na
nuvem). Ele já vem **genérico**: no primeiro acesso ao painel, o dono personaliza nome, logo, cor,
mensagens do bot, produtos e serviços — sem editar nenhum arquivo.

> 📚 Detalhes técnicos, outras formas de instalar (Docker/npm), PIX, IA e multi-tenant estão em
> [`docs/DETALHES-TECNICOS.md`](docs/DETALHES-TECNICOS.md).

---

## O que você precisa antes de começar

- ✅ Um **computador com Windows** que possa ficar **ligado durante o expediente**.
- ✅ O **celular com o WhatsApp da loja** em mãos (para escanear o QR Code).
- ✅ Uma **impressora instalada no Windows** (para imprimir a ordem de serviço).
- ✅ **Internet** no computador (o WhatsApp precisa; o painel e a impressão funcionam mesmo offline).

> ⚠️ **Sobre o WhatsApp:** o sistema usa uma automação **não-oficial** do WhatsApp. Existe um risco
> (baixo, mas real) de o número ser bloqueado pelo WhatsApp. Recomendação: use um **chip/número
> dedicado** para a loja, e **não** dispare mensagens em massa para quem não pediu.

---

## Parte 1 — Gerar o pacote (você faz UMA vez, na SUA máquina)

Isso é feito **no seu computador** (que tem o projeto e o Node.js), não no da loja.

1. Abra o PowerShell na pasta do projeto.
2. Rode:
   ```powershell
   powershell -ExecutionPolicy Bypass -File portatil\empacotar.ps1
   ```
3. No fim, será criado o arquivo **`dist\Gaspy-BOTZAP-portatil.zip`**.

Esse `.zip` já vem com **tudo dentro** (o programa, o Node embutido e o navegador interno do bot).
A loja **não precisa instalar nada** — nem Node.js, nem Docker, nem Git.

> ⚠️ **Ainda não testamos esse pacote portátil num Windows "limpo".** Antes de ir à loja, gere o
> `.zip` e **teste numa outra máquina/pasta** seguindo a Parte 2. Se der erro, veja
> "Se algo der errado" no fim ou use o [caminho alternativo com Node.js](#caminho-alternativo-instalar-com-nodejs).

---

## Parte 2 — Instalar no computador do estabelecimento

1. **Leve o `.zip`** para o computador da loja (pendrive, Google Drive, WhatsApp Web, etc.).
2. **Descompacte** numa pasta simples, tipo `C:\Gaspy-BOTZAP`.
   (Evite deixar dentro de "Downloads" ou numa pasta de rede.)
3. Abra a pasta e dê **duplo clique em `iniciar.bat`**.
   - Se o Windows mostrar uma tela azul (SmartScreen), clique em **"Mais informações"** →
     **"Executar assim mesmo"**.
   - Uma **janela preta** vai abrir e **ficar aberta**. **NÃO FECHE** essa janela — é ela que mantém
     o bot no ar (fechar = desligar o atendimento).

---

## Parte 3 — Conectar o WhatsApp da loja

1. Na primeira vez, a janela preta mostra um **QR Code**.
2. No celular da loja, abra o WhatsApp → **⋮ (menu)** → **Aparelhos conectados** →
   **Conectar um aparelho**.
3. **Aponte a câmera para o QR Code** da janela.
4. Quando aparecer **"✅ Bot conectado!"**, o WhatsApp está funcionando.

> A conexão fica **salva** na pasta `sessions`. Nas próximas vezes que ligar, **não** precisa
> escanear de novo — desde que você não apague essa pasta.

---

## Parte 4 — Configurar o painel (senha, dados, serviços)

1. O **navegador abre sozinho** em `http://localhost:3000` (se não abrir, digite isso na barra de
   endereços).
2. No **primeiro acesso**, o painel pede para **criar uma senha** — escolha uma e guarde.
3. Na aba **⚙️ Configurações**, preencha:
   - Nome da loja, número do atendente, horário.
   - **Chave PIX** (+ nome do recebedor e cidade) — sem isso o bot não gera o código de pagamento.
4. Na aba **🧰 Cadastro de Serviços**, ajuste os serviços e preços (troca de tela, formatação, etc.).
5. Na aba **🛍️ Loja de Acessórios**, cadastre os produtos à venda (capinhas, carregadores...).

O **banco de dados é criado automaticamente** na pasta `data` — você não precisa instalar nem
configurar banco nenhum.

> 🔒 Por segurança, o painel abre **apenas no próprio computador** onde o bot roda (por isso o
> `localhost`). Ninguém na rede Wi-Fi da loja consegue acessar. Se você *precisar* abrir o painel
> em outro aparelho da loja (um tablet, por exemplo), defina `PAINEL_HOST=0.0.0.0` no `iniciar.bat`
> — mas aí use uma senha forte, porque o painel fica visível para a rede.

## Parte 5 — Testar a impressora (ordem de serviço)

A impressão usa a **impressora que já está instalada no Windows** — não precisa de nada especial.

1. Confirme que a impressora está instalada e funcionando no Windows (faça um teste de impressão
   normal do Windows antes, se for a primeira vez).
2. No painel, aba **📋 Pedidos e Agendamentos**, clique no **protocolo (📄)** de um serviço.
3. Na janela que abre, clique em **🖨️ Imprimir OS**.
4. Vai abrir a **janela de impressão do navegador** — escolha a impressora e mande imprimir.

Dicas:
- A folha da OS é formatada para papel **A4 / Carta** (impressora comum jato de tinta ou laser).
- Se a janela de impressão **não abrir**, o navegador pode estar bloqueando pop-ups — permita
  pop-ups para `localhost`.
- Deixe a impressora como **padrão** no Windows para a impressão sair mais rápido.

---

## Parte 6 — Deixar ligado sozinho (recomendado)

Para o bot voltar sozinho depois que o computador reiniciar ou faltar energia:

- Dê **duplo clique em `instalar-inicializacao.bat`** (uma vez).
- A partir daí, o Gaspy inicia junto com o Windows.
- Para desfazer: duplo clique em `desinstalar-inicializacao.bat`.

---

## ✅ Checklist final (tudo funcionando?)

Pegue **outro celular** (não o da loja) e teste:

| Teste | Como | Esperado |
|---|---|---|
| **WhatsApp** | Mande "oi" para o número da loja | O bot responde com o menu |
| **Banco** | Abra um chamado (opção 1) até o protocolo | O serviço aparece na aba "Pedidos e Agendamentos" do painel |
| **Impressora** | Abra a OS desse serviço → Imprimir OS | Sai a folha impressa |
| **PIX** | Peça um produto (opção 3) e feche | Chega o código PIX Copia e Cola |

---

## 💾 Backup dos dados

Todos os dados (pedidos, serviços, clientes, produtos) ficam na pasta **`data`**. O sistema faz uma
**cópia de segurança automática** (por padrão, 1 vez por dia) na pasta **`backups`**, guardando as
últimas 7 cópias.

Para uma cópia **fora do computador** (o mais seguro), abra o painel → aba **Configurações** →
**"⬇️ Baixar cópia de segurança agora"** e salve o arquivo num pendrive ou na nuvem. Se o computador
estragar, é só instalar de novo e colocar esse arquivo no lugar do `data/gaspy.db`.

> Dá para ajustar a frequência e quantas cópias manter no `.env` (`BACKUP_INTERVALO_HORAS`,
> `BACKUP_MANTER`).

---

## 🆘 Se algo der errado

| Problema | O que fazer |
|---|---|
| Janela preta abre e fecha na hora | Clique com o botão direito em `iniciar.bat` → "Executar como administrador". Se persistir, veja o erro rodando pelo caminho alternativo abaixo. |
| Não aparece o QR Code | Feche a janela preta e abra o `iniciar.bat` de novo. Confira se há internet. |
| "Porta 3000 em uso" | Abra o `iniciar.bat` no bloco de notas e troque `PAINEL_PORT=3000` por `3001` (e acesse `localhost:3001`). |
| WhatsApp desconectou | Reabra o `iniciar.bat`. Se pedir QR de novo, escaneie novamente. |
| A folha de impressão sai cortada | Na janela de impressão, ajuste o tamanho do papel para A4 e as margens para "padrão". |
| Painel pede senha e esqueci | Apague o arquivo `data/gaspy.db` (isso apaga os dados!) **ou** defina `PAINEL_SENHA` no `iniciar.bat`. |

---

## Caminho alternativo: instalar com Node.js

Se o pacote portátil não funcionar, dá para rodar instalando o Node.js (mais testado, porém com
mais passos):

1. Instale o **Node.js LTS**: https://nodejs.org (instalação padrão).
2. Copie a pasta do projeto para o computador (sem as pastas `node_modules`, `data` e `sessions`).
3. No PowerShell, dentro da pasta, rode:
   ```powershell
   npm install
   npm start
   ```
4. Siga as Partes 3, 4 e 5 acima (QR Code, painel, impressão).

Há ainda a instalação via **Docker** (um comando), explicada em
[`docs/DETALHES-TECNICOS.md`](docs/DETALHES-TECNICOS.md).
