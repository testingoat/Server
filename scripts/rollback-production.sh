#!/bin/bash
# Phase 2E.1: Production Rollback Script
echo " 🔄 Starting production rollback...\
cd /var/www/goatgoat-production/server

BACKUP_FILE=\/var/www/backups/production-backup.tar.gz\
if [ ! -f \\\ ]; then
 echo \❌ Backup file not found: \\
 exit 1
fi

echo \📋 Rollback Details:\
echo \- Environment: Production\
echo \- Backup File: \\
echo \- Date: \09/27/2025 03:44:13\
echo \\

echo \⏹️ Stopping PM2 process...\
pm2 stop goatgoat-production

echo \📦 Restoring from backup...\
tar -xzf \\\ -C /

echo \🔧 Verifying restoration...\
if [ -f \/var/www/goatgoat-production/server/dist/app.js\ ]; then
 echo \✅ Application files restored\
else
 echo \❌ Application files missing after restore\
 exit 1
fi

echo \▶️ Starting PM2 process...\
pm2 start goatgoat-production

sleep 5

echo \🔍 Verifying rollback...\
if pm2 list | grep -q \goatgoat-production.*online\; then
 echo \✅ Production process is online\
 if curl -s http://localhost:3000/health | grep -q \healthy\; then
 echo \✅ Health check passed\
 echo \🎉 Production rollback completed successfully!\
 else
 echo \⚠️ Health check failed - manual verification needed\
 fi
else
 echo \❌ Production process failed to start\
 exit 1
fi

echo \\
echo \📊 Final Status:\
pm2 list | grep production
echo \\
echo \📝 Rollback completed: \09/27/2025 03:44:13\
