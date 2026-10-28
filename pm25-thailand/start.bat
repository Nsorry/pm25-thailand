@echo off
title ThaiBreathe - PM2.5 Live Dashboard
cd /d "%~dp0"
echo ======================================================
echo    ThaiBreathe - ตรวจวัดค่าฝุ่น PM2.5 ทั่วประเทศไทย
echo ======================================================
echo กำลังเปิดเว็บเซิร์ฟเวอร์และบราวเซอร์...
node --use-system-ca server.js
pause
