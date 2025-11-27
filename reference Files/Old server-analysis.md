# GoatGoat Server Infrastructure Analysis

## 🏗️ Server Architecture Overview

**Server IP**: `147.93.108.121`
**OS**: Ubuntu 22.04.5 LTS
**Load**: 0.09 (Low)
**Memory Usage**: 41%
**Disk Usage**: 30.7% of 48.27GB

## 🚪 Port Configuration & Services

### Active Ports
- **Port 22**: SSH (OpenSSH)
- **Port 80**: HTTP (Nginx)
- **Port 443**: HTTPS (Nginx with SSL)
- **Port 3000**: **PRODUCTION** GoatGoat App (PM2 managed)
- **Port 4000**: **STAGING** GoatGoat App (PM2 managed)
- **Port 53**: DNS Resolution (systemd-resolved)
- **Port 65529**: Monitoring Agent (monarx-agent)

### Service Architecture
```
Internet → Nginx (Reverse Proxy) → Node.js Applications
    ↓
SSL Termination → Load Balancing → PM2 Process Manager
    ↓
Production (Port 3000) & Staging (Port 4000)
```

## 🔄 Staging vs Production Environments

### Directory Structure
```
/var/www/
├── goatgoat-production/     # Production environment
├── goatgoat-staging/        # Staging environment  
├── backups/                 # System backups
└── goatgoat-app-backup-*/   # Version backups
```

### Environment Configurations

#### Production Environment
- **Path**: `/var/www/goatgoat-production/server/`
- **Port**: `3000`
- **Database**: `GoatgoatProduction`
- **Node ENV**: `production`
- **Script**: `dist/app.js`
- **Memory Limit**: 1GB
- **Uptime**: 3 days (29 restarts)

#### Staging Environment  
- **Path**: `/var/www/goatgoat-staging/server/`
- **Port**: `4000`
- **Database**: `GoatgoatStaging`  
- **Node ENV**: `staging`
- **Script**: `dist/app.js`
- **Memory Limit**: 512MB
- **Uptime**: 2 days (140 restarts)

### Key Configuration Differences
```javascript
// Production Environment
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb+srv://...GoatgoatProduction

// Staging Environment  
NODE_ENV=staging
PORT=4000
MONGO_URI=mongodb+srv://...GoatgoatStaging
```

## 🔒 SSL Certificates & Security

### SSL Configuration
- **Certificate Authority**: Let's Encrypt
- **Certificate Path**: `/etc/letsencrypt/live/goatgoat.tech/`
- **Domains Covered**:
  - `goatgoat.tech`
  - `staging.goatgoat.tech`
  - `www.goatgoat.tech`
- **Expiry Date**: December 12, 2025 (64 days remaining)
- **Key Type**: RSA
- **Auto-renewal**: Managed by Certbot

### Security Headers
```nginx
Content-Security-Policy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
font-src 'self' https://fonts.gstatic.com; 
img-src 'self' data: https:; connect-src 'self' ws: wss:; frame-src 'self';"
```

### SSL Protocols
- **Supported**: TLSv1.2, TLSv1.3
- **Cipher Suites**: High-security ciphers only
- **Session Caching**: 10MB shared cache, 1440m timeout

## 🛣️ API Routes & Endpoints

### Main Route Categories
```javascript
/api/
├── auth/              # Authentication endpoints
├── products/          # Product management
├── categories/        # Product categories  
├── orders/           # Order management
├── users/            # User management
├── seller/           # Seller-specific endpoints
├── notifications/    # User notifications
├── sellerNotifications/ # Seller notifications
└── admin/            # Administrative operations
    ├── ops/          # Admin operations
    ├── monitoring/   # System monitoring
    └── fcm/          # FCM management
```

### Route Files Structure
```
src/routes/
├── index.js           # Main route registrar
├── auth.js           # Authentication routes
├── products.js       # Product & category routes
├── users.js          # User management
├── seller.js         # Seller operations
├── order.js          # Order processing
├── notifications.js  # Notification system
├── sellerNotifications.js # Seller-specific notifications
└── email.js          # Email services
```

## 🎛️ AdminJS Integration & Structure

### AdminJS Configuration
- **Main Config**: `dist/config/setup.js` (⚠️ CRITICAL FILE - Controls panel structure)
- **Resources**: `src/config/adminjs-setup.js`
- **Theme**: Dark theme with custom branding

### Hierarchical Navigation Structure
```
AdminJS Panel/
├── User Management/
│   └── Customer Management
├── Seller Management/
│   ├── Seller Profiles  
│   └── Seller Registration Data
├── Store Management/
│   └── Store Information
├── Product Management/
│   ├── Approved Products ✅
│   └── Category Management
├── Order Management/
│   └── Order Processing
└── System/
    ├── FCM Management 🔥
    ├── Monitoring Dashboard 📊
    └── System Configuration
```

### Custom Actions
- **Approve Product**: Updates status to 'approved'
- **Reject Product**: Updates status to 'rejected' with reason
- **Bulk Operations**: Available for batch processing

### ⚠️ CRITICAL ADMIN RULES
- **NEVER** edit `dist/config/setup.js` directly without backup
- Changes must be made in `src/` directory first, then built
- AdminJS tab structure is fragile - test after any changes
- Use hierarchical navigation structure for organization

## ⚙️ PM2 Process Management

### PM2 Configuration
```javascript
// ecosystem.config.cjs
{
  apps: [
    {
      name: 'goatgoat-production',
      script: './dist/app.js',
      cwd: '/var/www/goatgoat-production/server',
      instances: 1,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production', PORT: 3000 }
    },
    {
      name: 'goatgoat-staging', 
      script: './dist/app.js',
      cwd: '/var/www/goatgoat-staging/server',
      instances: 1,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'staging', PORT: 4000 }
    }
  ]
}
```

### Process Status & Health
```
┌────┬───────────────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
│ id │ name                  │ mode    │ pid     │ uptime   │ ↺      │ cpu  │ memory    │
├────┼───────────────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┤
│ 0  │ goatgoat-production   │ cluster │ 486942  │ 3D       │ 29     │ 0%   │ 142.6mb   │
│ 2  │ goatgoat-staging      │ cluster │ 528936  │ 2D       │ 140    │ 0%   │ 129.6mb   │
└────┴───────────────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┘
```

### Logging Configuration
```
Production Logs:
├── 📋-production-combined.log    # All logs
├── 🚨-production-error.log       # Errors only  
└── 📄-production-output.log      # Standard output

Staging Logs:
├── 📋-staging-combined.log       # All logs
├── 🚨-staging-error.log          # Errors only
└── 📄-staging-output.log         # Standard output
```

### PM2 Management Commands
```bash
# Status and monitoring
pm2 status                    # View all processes
pm2 show <app-name>          # Detailed process info
pm2 monit                    # Real-time monitoring
pm2 logs <app-name>          # View logs

# Process control
pm2 restart <app-name>       # Restart application
pm2 reload <app-name>        # Zero-downtime reload
pm2 stop <app-name>          # Stop application
pm2 delete <app-name>        # Remove from PM2

# Memory and performance
pm2 trigger <app-name> km:heapdump          # Generate heap dump
pm2 trigger <app-name> km:cpu:profiling:start # Start CPU profiling
```

## 🔥 FCM (Firebase Cloud Messaging) Integration

### Firebase Configuration
- **Service Account**: `/var/www/*/server/secure/firebase-service-account.json`
- **Initialization**: `src/config/firebase-admin.js`
- **Service Layer**: `src/services/fcmService.js`

### FCM Architecture
```
Client App → FCM Token Registration → Server Database
     ↓
Server → Firebase Admin SDK → FCM Service → Push Notifications
     ↓
Admin Dashboard → FCM Management → Token Analytics
```

### FCM Management Dashboard
- **Endpoint**: `/admin/fcm-management`
- **Features**:
  - Token statistics and analytics
  - Mass notification sending
  - Token validation and cleanup
  - Delivery tracking and reporting

### FCM Service Functions
```javascript
// Core functions in fcmService.js
sendPushNotification(fcmToken, payload)      # Single notification
sendBulkNotifications(tokens, payload)       # Bulk notifications  
validateFCMToken(token)                      # Token validation
cleanupInvalidTokens()                       # Maintenance function
```

### FCM Database Models
- **Customer**: FCM token storage for users
- **DeliveryPartner**: FCM token for delivery partners
- **NotificationLog**: Delivery tracking and history

## 📊 Monitoring Dashboard & System Health

### Monitoring Architecture
```
System Metrics → In-Memory Store → API Endpoints → Admin Dashboard
     ↓
Performance Data → MongoDB → Historical Analytics
```

### Key Metrics Tracked
```javascript
{
  server: {
    uptime: 'Process uptime in seconds',
    requests: 'Total requests handled',
    errors: 'Total error count',
    requestsPerSecond: 'RPS calculation',
    avgResponseTime: 'Average response time in ms'
  },
  system: {
    memoryUsage: 'Process memory consumption',
    cpuUsage: 'CPU utilization',
    loadAverage: 'System load (1m, 5m, 15m)'
  },
  database: {
    connectionState: 'MongoDB connection status',
    operations: 'Database operation counts'
  }
}
```

### Monitoring Endpoints
- **GET `/admin/monitoring/metrics`**: Current system metrics
- **GET `/admin/monitoring/health`**: Health check endpoint
- **GET `/admin/monitoring/logs`**: Recent application logs

### Health Check Indicators
- ✅ **Green**: All systems operational
- 🟡 **Yellow**: Minor issues detected  
- 🔴 **Red**: Critical issues requiring attention

## 🗄️ MongoDB Database Integration

### Database Configuration
```javascript
// Connection settings
maxPoolSize: 10           # Maximum connections
minPoolSize: 2            # Minimum connections  
maxIdleTimeMS: 30000     # Connection timeout
serverSelectionTimeoutMS: 5000  # Server selection timeout
socketTimeoutMS: 45000   # Socket timeout
retryWrites: true        # Automatic retry
retryReads: true         # Read retry
```

### Database Structure
```
MongoDB Cluster (cluster6.l5jkmi9.mongodb.net)
├── GoatgoatProduction    # Production database
├── GoatgoatStaging       # Staging database  
└── GoatgoatDevelopment   # Development database (if exists)
```

### Core Collections
```javascript
// User Management
customers                 # Customer profiles and data
deliveryPartners         # Delivery partner information
sellers                  # Seller accounts and stores

// Product & Inventory  
products                 # Product catalog
categories              # Product categories
sellerProducts          # Seller-specific products

// Order Management
orders                  # Order processing and history
orderHistory           # Order tracking and updates

// Notifications
notifications          # User notifications
sellerNotifications    # Seller-specific notifications  
notificationLogs       # Delivery tracking

// System
counters              # Auto-increment sequences
monitoring            # System health metrics
otps                  # OTP verification codes
```

### Model Files
```
src/models/
├── index.js              # Model exports
├── user.js              # Customer model
├── products.js          # Product catalog
├── sellerProducts.js    # Seller products
├── order.js             # Order processing
├── notification.js      # Notification system
├── notificationLog.js   # Notification tracking
├── otp.js              # OTP verification
├── counter.js          # Auto-increment
├── monitoring.js       # System metrics
├── category.js         # Product categories
└── branch.js           # Branch/location data
```

## 💾 Backup Strategy & Data Protection

### Backup Locations
```
System Backups:
├── /root/backups/                    # Root user backups
├── /var/www/backups/                # Application backups
└── /var/www/*-backup-*/             # Versioned backups
```

### Current Backups
```
Recent Backups:
├── staging-complete-backup-20251002.tar.gz         # 351KB
├── PRODUCTION-PRE-FCM-DEPLOY-20250929-191550.tar.gz # 221MB
├── STAGING-GOLDEN-BACKUP-FCM-WORKING-20250929-191212.tar.gz # 620MB
└── Multiple FCM deployment backups (28-Sept phase backups)
```

### Backup Types
1. **Pre-deployment Backups**: Created before major deployments
2. **Feature-specific Backups**: For specific feature implementations (e.g., FCM)
3. **Golden Master Backups**: Stable, working versions
4. **Emergency Recovery Backups**: Quick restore points

### Backup Strategy
- **Manual Backups**: Created before major changes
- **Version Control**: Git-based source code backup
- **Database Backups**: MongoDB Atlas automatic backups
- **File System Backups**: Complete application directory archives

### ⚠️ BACKUP RULES
1. **ALWAYS** create backup before major changes
2. **Test** backups periodically for restore capability  
3. **Label** backups clearly with purpose and date
4. **Retain** at least 3 recent backups per environment
5. **Store** critical backups in multiple locations

## 🔄 SRC=DIST Rule & Development Workflow

### ⚠️ CRITICAL DEVELOPMENT RULE: SRC=DIST

**NEVER EDIT DIST/ DIRECTORY DIRECTLY**

### Proper Development Workflow
```bash
# 1. Make changes in src/ directory
vim /var/www/goatgoat-production/server/src/routes/seller.js

# 2. Build the application (compiles src/ to dist/)
cd /var/www/goatgoat-production/server
npm run build

# 3. Restart the PM2 process
pm2 restart goatgoat-production

# 4. Verify changes are working
pm2 logs goatgoat-production
```

### Directory Structure
```
server/
├── src/                    # 📝 SOURCE CODE - Edit here!
│   ├── routes/
│   ├── controllers/  
│   ├── models/
│   ├── config/
│   └── services/
├── dist/                   # 🚫 COMPILED CODE - Never edit!
│   ├── routes/
│   ├── controllers/
│   ├── models/ 
│   ├── config/
│   └── services/
└── package.json
```

### Build Process
```javascript
// TypeScript compilation: src/ → dist/
{
  "scripts": {
    "build": "tsc",           // Compile TypeScript
    "start": "node dist/app.js", // Run compiled version
    "dev": "nodemon src/app.js"  // Development mode
  }
}
```

## 🚀 Deployment & Release Management

### Environment Flow
```
Development → Staging (Port 4000) → Production (Port 3000)
     ↓              ↓                        ↓
   Local Dev    staging.goatgoat.tech    goatgoat.tech
```

### Deployment Scripts
```
server/
├── deploy.sh              # Main deployment script
├── deploy-fix.sh          # Hot-fix deployment
└── scripts/
    └── Various utility scripts
```

### Release Process
1. **Development**: Code changes in `src/`
2. **Build**: Compile to `dist/`
3. **Test**: Staging environment validation  
4. **Backup**: Create pre-deployment backup
5. **Deploy**: Production deployment
6. **Monitor**: Health checks and validation

## 📱 Mobile App Integration

### API Integration Points
- **Authentication**: JWT-based auth system
- **Product Catalog**: RESTful product APIs
- **Order Processing**: Order management endpoints
- **Push Notifications**: FCM integration
- **Seller Dashboard**: Seller-specific APIs

### Environment Configuration
```javascript
// Mobile app environment config
Debug Build → Staging Server (Port 4000)
Release Build → Production Server (Port 3000)
```

### Authentication Flow
```
Mobile App → `/api/auth/login` → JWT Token → API Access
     ↓
Token Storage → Automatic header injection → Authenticated requests
```

## 🔧 Do's and Don'ts

### ✅ DO's
1. **ALWAYS** create backups before changes
2. **EDIT** code in `src/` directory only  
3. **BUILD** after making changes
4. **TEST** on staging before production
5. **MONITOR** logs after deployments
6. **FOLLOW** the SRC=DIST rule strictly
7. **USE** PM2 for process management
8. **MAINTAIN** AdminJS hierarchical structure
9. **VALIDATE** SSL certificate expiry regularly
10. **DOCUMENT** all major changes

### ❌ DON'Ts  
1. **NEVER** edit `dist/` directory directly
2. **NEVER** break AdminJS panel functionality
3. **NEVER** skip backup before major changes
4. **NEVER** deploy directly to production without staging test
5. **NEVER** ignore PM2 restart warnings
6. **NEVER** expose Firebase service account keys
7. **NEVER** modify MongoDB connection pooling without testing
8. **NEVER** change port configurations without updating Nginx
9. **NEVER** ignore SSL certificate expiry warnings
10. **NEVER** delete backup files without proper retention policy

## 🚫 Files NOT to Touch

### ⚠️ CRITICAL SYSTEM FILES
```
# SSL Certificates (Auto-managed)
/etc/letsencrypt/live/goatgoat.tech/*

# PM2 Configuration (Global)
/root/.pm2/*

# System Configuration
/etc/nginx/nginx.conf
/etc/nginx/sites-available/default

# Firebase Service Accounts
/var/www/*/server/secure/firebase-service-account.json

# Database Connection Configs (Unless specifically required)
/var/www/*/server/.env.production
/var/www/*/server/.env.staging

# Compiled Code (Use src/ instead)
/var/www/*/server/dist/*
```

### 📁 Files Requiring Extreme Caution
```
# AdminJS Panel Structure
/var/www/*/server/dist/config/setup.js    # Controls entire panel structure

# Process Management  
/var/www/*/server/ecosystem.config.cjs    # PM2 app definitions

# Database Models
/var/www/*/server/src/models/index.js     # Model exports - affects entire app
```

## 🎯 Best Practices & Guidelines

### Development Workflow
1. **Local Development**: Use staging environment for testing
2. **Code Changes**: Always in `src/` directory
3. **Testing**: Comprehensive testing on staging
4. **Deployment**: Phased rollout with monitoring
5. **Rollback Plan**: Always have rollback strategy ready

### Security Practices
1. **SSL Management**: Monitor certificate expiry
2. **Environment Variables**: Secure credential storage
3. **Access Control**: Limited SSH access with key authentication
4. **API Security**: JWT token validation and rate limiting
5. **Database Security**: Connection pooling and query optimization

### Monitoring & Maintenance
1. **Health Checks**: Regular system health monitoring
2. **Log Management**: Centralized logging with rotation
3. **Performance Monitoring**: Memory, CPU, and response time tracking
4. **Database Maintenance**: Index optimization and cleanup
5. **Backup Verification**: Regular backup restore testing

## 📋 Quick Reference Commands

### PM2 Management
```bash
pm2 status                    # Process status
pm2 logs goatgoat-production  # View logs
pm2 restart goatgoat-staging  # Restart app
pm2 monit                     # Real-time monitoring
```

### System Health
```bash
htop                          # System resource usage
df -h                         # Disk usage
nginx -t                      # Nginx config test
systemctl status nginx       # Nginx status
```

### SSL Certificate
```bash
certbot certificates         # View certificates  
certbot renew --dry-run     # Test renewal
nginx -s reload             # Reload after cert update
```

### Database Operations
```bash
# Use MongoDB Compass or admin tools
# Direct DB access not recommended from server
```

---

## 📞 Emergency Procedures

### System Down Recovery
1. Check PM2 process status: `pm2 status`
2. Check Nginx status: `systemctl status nginx`
3. Review logs: `pm2 logs` and `/var/log/nginx/`
4. Restart services if needed
5. Monitor system metrics

### Database Connection Issues  
1. Check MongoDB Atlas status
2. Verify connection strings in `.env` files
3. Test network connectivity
4. Review database logs
5. Check connection pool settings

### SSL Certificate Issues
1. Check certificate expiry: `certbot certificates`
2. Test renewal: `certbot renew --dry-run`  
3. Verify Nginx configuration
4. Reload Nginx: `nginx -s reload`
5. Monitor SSL handshake logs

---

*This analysis provides comprehensive documentation for GoatGoat server infrastructure. Keep this document updated as the system evolves.*