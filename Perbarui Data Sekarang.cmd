@echo off
cd /d "%~dp0"
py -3 scripts\update_data.py --force
if errorlevel 1 (
  echo Pembaruan gagal. Snapshot sebelumnya tetap tersedia. Lihat data\update_status.json.
  pause
)
