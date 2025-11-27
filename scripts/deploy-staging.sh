#!/bin/bash
echo Starting deployment...
cd /var/www/goatgoat-staging/server
mkdir -p /var/www/backups
tar -czf /var/www/backups/staging-backup.tar.gz /var/www/goatgoat-staging/server
bash scripts/build-staging.sh
pm2 restart goatgoat-staging
sleep 3
echo Deployment completed
