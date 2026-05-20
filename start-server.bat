@echo off
title URL to Figma - Server
cd /d "%~dp0"
echo Starting URL to Figma server...
echo.
echo Keep this window open while using the Figma plugin.
echo Dashboard: http://localhost:3001
echo.
node scripts/serve-ir.mjs
pause
