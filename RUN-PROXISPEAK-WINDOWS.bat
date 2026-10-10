@echo off
setlocal
start "ProxiSpeak Backend" cmd /k "cd /d ""%~dp0server"" && npm install && npm run dev"
timeout /t 2 /nobreak >nul
start "ProxiSpeak Frontend" cmd /k "cd /d ""%~dp0client"" && npm install && npm run dev"
echo.
echo Two terminal windows have been opened.
echo Open the Local URL shown in the Frontend terminal.
echo Keep both windows open while using ProxiSpeak.
pause
