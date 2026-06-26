@echo off
title Kiraex3 Guard Bot
:start
echo [%date% %time%] Bot baslatiliyor...
node index.js
echo [%date% %time%] Bot kapandi veya coktu. 5 saniye icinde yeniden baslatiliyor...
ping 127.0.0.1 -n 6 > nul
goto start
