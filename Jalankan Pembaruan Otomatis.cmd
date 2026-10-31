@echo off
cd /d "%~dp0"
echo Data resmi diperiksa setiap 6 jam. Biarkan jendela ini berjalan.
echo Ctrl+C untuk menghentikan. HTML tetap dapat dibuka saat pembaru berhenti.
py -3 scripts\update_data.py --watch
if errorlevel 1 pause
