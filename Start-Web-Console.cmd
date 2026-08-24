@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\windows\start-console.ps1" -EnableProfileActions -EnableProfileDownload -EnableProfileNickname -EnableProfileNotifications -EnableProfileDelete -EnableSmsSend -EnableSmsDelete -EnableCallActions -EnableUssd -EnableUsbMode -EnableDriverInstall -EnableVoiceRuntime -EnableStockBootstrap
pause