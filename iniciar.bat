@echo off
cd /d "%~dp0"
echo Iniciando o servidor local do jogo...
where node >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"
  node servidor.js
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"
  python servidor.py
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000"
  py servidor.py
  goto :eof
)
echo.
echo Nao encontrei Node.js nem Python. Instale um deles (https://nodejs.org) e rode de novo.
pause
