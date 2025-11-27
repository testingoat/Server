#!/bin/bash
echo Phase 2D.1: Comprehensive Health Check
echo ======================================
echo Date: 09/27/2025 03:42:43
echo
echo DATABASE CONNECTIVITY:
curl -s http://localhost:4000/health | grep -q connected && echo " Staging DB: CONNECTED\ || echo \Staging DB: DISCONNECTED\
curl -s http://localhost:3000/health | grep -q connected && echo \Production DB: CONNECTED\ || echo \Production DB: DISCONNECTED\
echo
echo ADMINJS PANEL ACCESSIBILITY:
curl -s https://staging.goatgoat.tech/admin | grep -q AdminJS && echo \Staging AdminJS: ACCESSIBLE\ || echo \Staging AdminJS: INACCESSIBLE\
curl -s https://goatgoat.tech/admin | grep -q AdminJS && echo \Production AdminJS: ACCESSIBLE\ || echo \Production AdminJS: INACCESSIBLE\
echo
echo PORT STATUS:
netstat -tlnp | grep -q :4000 && echo \Port 4000: LISTENING\ || echo \Port 4000: NOT LISTENING\
netstat -tlnp | grep -q :3000 && echo \Port 3000: LISTENING\ || echo \Port 3000: NOT LISTENING\
echo
echo PM2 PROCESS STATUS:
pm2 list
