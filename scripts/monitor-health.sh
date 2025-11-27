#!/bin/bash
# Phase 2D.2: Monitoring & Alerting Script
LOG_FILE=" /var/www/goatgoat-staging/server/logs/monitoring.log\
mkdir -p /var/www/goatgoat-staging/server/logs

log_message() {
 echo \[\09/27/2025 03:43:55] \\ | tee -a \\\
}

log_message \🔍 Starting comprehensive system monitoring...\

while true; do
 log_message \=== Health Check Cycle ====\
 
 # PM2 Process Monitoring
 if ! pm2 list | grep -q \goatgoat-staging.*online\; then
 log_message \❌ ALERT: Staging process is down - attempting restart\
 pm2 restart goatgoat-staging
 sleep 5
 if pm2 list | grep -q \goatgoat-staging.*online\; then
 log_message \✅ Staging process restarted successfully\
 else
 log_message \🚨 CRITICAL: Failed to restart staging process\
 fi
 else
 log_message \✅ Staging process is healthy\
 fi
 
 if ! pm2 list | grep -q \goatgoat-production.*online\; then
 log_message \❌ ALERT: Production process is down - attempting restart\
 pm2 restart goatgoat-production
 sleep 5
 if pm2 list | grep -q \goatgoat-production.*online\; then
 log_message \✅ Production process restarted successfully\
 else
 log_message \🚨 CRITICAL: Failed to restart production process\
 fi
 else
 log_message \✅ Production process is healthy\
 fi
 
 # Disk Space Monitoring
 DISK_USAGE=\
 if [ \\\ -gt 80 ]; then
 log_message \⚠️ WARNING: Disk usage is \% - consider cleanup\
 else
 log_message \✅ Disk usage is healthy: \%\
 fi
 
 # Memory Monitoring
 MEMORY_USAGE=\
 if [ \\\ -gt 85 ]; then
 log_message \⚠️ WARNING: Memory usage is \%\
 else
 log_message \✅ Memory usage is healthy: \%\
 fi
 
 log_message \=== Monitoring cycle completed ====\
 sleep 60 # Check every minute
done
