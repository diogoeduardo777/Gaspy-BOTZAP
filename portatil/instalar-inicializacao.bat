@echo off
chcp 65001 >nul
rem Faz o Gaspy iniciar sozinho quando este computador ligar (cria um atalho na pasta
rem "Inicializar" do Windows apontando para o iniciar.bat).

set "ALVO=%~dp0iniciar.bat"
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Gaspy-TecCell.lnk"

powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; $s = $w.CreateShortcut('%ATALHO%'); $s.TargetPath = '%ALVO%'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

echo.
echo ✅ Pronto! O Gaspy vai iniciar automaticamente quando este computador for ligado.
echo    (Para desfazer, rode "desinstalar-inicializacao.bat".)
pause
