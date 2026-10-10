@echo off
rem Ouvre le site en local : http://127.0.0.1:8770
cd /d "%~dp0docs"
start "" http://127.0.0.1:8770
python -m http.server 8770 --bind 127.0.0.1
