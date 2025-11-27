# Phase 2E.2: Rollback Procedures & Documentation

## 🔄 Rollback Decision Matrix

### When to Rollback:
- ❌ AdminJS panel inaccessible after deployment
- ❌ Database connection failures
- ❌ PM2 process crashes repeatedly
- ❌ Critical functionality broken
- ❌ Performance degradation > 50%

### Rollback Triggers:
1. **Automatic**: Process crashes > 3 times in 5 minutes
2. **Manual**: Health check failures
3. **Emergency**: Critical system errors

## 📋 Rollback Procedures

### Staging Rollback:
\\\ash
cd /var/www/goatgoat-staging/server
bash scripts/rollback-staging.sh
\\\

### Production Rollback:
\\\ash
cd /var/www/goatgoat-staging/server
bash scripts/rollback-production.sh
\\\

## ✅ Rollback Testing Checklist

### Pre-Rollback:
- [ ] Verify backup file exists
- [ ] Check current system status
- [ ] Document rollback reason
- [ ] Notify team (if production)

### During Rollback:
- [ ] Monitor PM2 process status
- [ ] Verify file restoration
- [ ] Check application startup
- [ ] Test health endpoints

### Post-Rollback:
- [ ] Verify AdminJS accessibility
- [ ] Test database connectivity
- [ ] Check system resources
- [ ] Document rollback completion
- [ ] Investigate original issue

## 🚨 Emergency Contact Procedures

### Critical Issues:
1. **Immediate**: Check monitoring logs
2. **Escalate**: If rollback fails
3. **Contact**: System administrator
4. **Document**: All actions taken

### Emergency Commands:
\\\ash
# Quick health check
curl -s http://localhost:4000/health
curl -s http://localhost:3000/health

# PM2 status
pm2 list

# Emergency restart
pm2 restart all

# View logs
pm2 logs --lines 20
\\\

## 📊 Rollback Success Criteria

### Staging:
- ✅ PM2 process online
- ✅ Port 4000 listening
- ✅ Health endpoint responds
- ✅ AdminJS accessible

### Production:
- ✅ PM2 process online
- ✅ Port 3000 listening
- ✅ Health endpoint responds
- ✅ AdminJS accessible
- ✅ Database connectivity

## 📝 Rollback Log Template

\\\
Date: [DATE]
Environment: [STAGING/PRODUCTION]
Reason: [REASON FOR ROLLBACK]
Backup Used: [BACKUP FILE]
Duration: [TIME TAKEN]
Success: [YES/NO]
Issues: [ANY ISSUES ENCOUNTERED]
Next Steps: [FOLLOW-UP ACTIONS]
\\\
