@echo off
title Atlas PCM — Servidor
cd /d "%~dp0"
echo.
echo  =============================================
echo    Atlas PCM — Almoxarifado
echo    Iniciando servidor...
echo  =============================================
echo.
echo  Aguarde a mensagem de confirmacao e acesse:
echo  http://localhost:8080
echo.
echo  Para parar o servidor feche esta janela.
echo.
node-v26.1.0-win-x64\node-v26.1.0-win-x64\node.exe server.js
echo.
echo  Servidor encerrado.
pause
