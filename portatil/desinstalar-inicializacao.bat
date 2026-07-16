@echo off
chcp 65001 >nul
rem Remove a inicializacao automatica do Gaspy (apaga o atalho da pasta "Inicializar").

set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Gaspy-TecCell.lnk"
if exist "%ATALHO%" (
  del "%ATALHO%"
  echo Inicializacao automatica removida.
) else (
  echo Nao havia inicializacao automatica configurada.
)
pause
