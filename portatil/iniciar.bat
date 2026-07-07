@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem === Configuração básica. A SENHA do painel é criada no primeiro acesso, pela própria tela. ===
set "CLIENT_ID=teccell"
set "DATA_PATH=.\data"
set "SESSION_PATH=.\sessions"
set "PAINEL_PORT=3000"
set "PUPPETEER_CACHE_DIR=%~dp0.chromium-portatil"

echo ================================================
echo   Gaspy BOTZAP - TecCell
echo   Iniciando... NAO FECHE esta janela.
echo   Painel: http://localhost:%PAINEL_PORT%
echo ================================================
echo.

rem Abre o painel no navegador depois de alguns segundos (em uma janela separada).
start "" cmd /c "timeout /t 6 >nul & start http://localhost:%PAINEL_PORT%"

rem Roda o bot. Na primeira vez, o QR Code do WhatsApp aparece aqui nesta janela.
"%~dp0runtime\node.exe" index.js

echo.
echo O bot foi encerrado. Pressione uma tecla para fechar.
pause >nul
