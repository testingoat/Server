#!/bin/bash
echo Starting staging rollback...
cd /var/www/goatgoat-staging/server
BACKUP_FILE=" /var/www/backups/staging-backup.tar.gz\
if [ ! -f \\ ]; then
 echo \❌ Backup file not found: \
 exit 1
fi
echo \Stopping PM2 process...\
pm2 stop goatgoat-staging
echo \Restoring from backup...\
tar -xzf \\ -C /
echo \Starting PM2 process...\
pm2 start goatgoat-staging
echo \✅ Rollback completed\
