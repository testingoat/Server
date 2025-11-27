#!/bin/bash
LOG_FILE=" /var/www/goatgoat-staging/server/logs/monitoring.log\
mkdir -p /var/www/goatgoat-staging/server/logs
log_message() {
 echo \[\] \\ | tee -a \\\
}
log_message \🔍 Starting system monitoring...\
while true; do
 log_message \=== Health Check Cycle ====\
 if ! pm2 list | grep -q \goatgoat-staging.*online\; then
 log_message \❌ Staging process is down! Attempting restart...\
 pm2 restart goatgoat-staging
 sleep 5
 fi
 if ! pm2 list | grep -q \goatgoat-production.*online\; then
 log_message \❌ Production process is down! Attempting restart...\
 pm2 restart goatgoat-production
 sleep 5
 fi
 log_message \✅ Process monitoring completed\
 sleep 60
done
