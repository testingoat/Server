#!/bin/bash
echo === System Alert Check ===
if pm2 list | grep -q " goatgoat-staging.*online\; then
 echo OK: Staging is healthy
else
 echo ALERT: Staging is down!
fi
if pm2 list | grep -q \goatgoat-production.*online\; then
 echo OK: Production is healthy
else
 echo ALERT: Production is down!
fi
echo === Alert check completed ===
