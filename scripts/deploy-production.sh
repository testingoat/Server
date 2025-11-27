#!/bin/bash
echo Starting production deployment...
cd /var/www/goatgoat-production/server
mkdir -p /var/www/backups
tar -czf /var/www/backups/production-backup.tar.gz /var/www/goatgoat-production/server
bash scripts/build-production.sh
pm2 restart goatgoat-production
sleep 3
echo Production deployment completed
