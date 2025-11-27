#!/bin/bash

echo "🚀 ULTIMATE COMPONENTLOADER FIX DEPLOYMENT"
echo "============================================="

# Navigate to the correct directory
cd /var/www/goatgoat-app || {
    echo "❌ Error: Could not navigate to /var/www/goatgoat-app"
    exit 1
}

echo "📍 Current directory: $(pwd)"

# 1. Pull the latest changes with our fixes
echo ""
echo "1️⃣ PULLING LATEST FIXES..."
git pull origin main

# 2. Navigate to server directory
cd server || {
    echo "❌ Error: Could not navigate to server directory"
    exit 1
}

echo "📍 Server directory: $(pwd)"

# 3. Complete cleanup of old build artifacts
echo ""
echo "2️⃣ CLEANING OLD BUILD ARTIFACTS..."
rm -rf dist/
rm -rf node_modules/.cache/
rm -rf .adminjs/

# 3.1. Remove any potential AdminJS component files
echo "🧹 Cleaning AdminJS component artifacts..."
find . -name "*monitoring-component*" -type f -delete 2>/dev/null || true
find . -name "*.bundle.js" -type f -delete 2>/dev/null || true
rm -rf .adminjs-* 2>/dev/null || true

# 4. Verify our fix files are in place
echo ""
echo "3️⃣ VERIFYING FIX FILES..."

echo "📋 Contents of src/config/setup.ts (line 11-13):"
sed -n '11,13p' src/config/setup.ts

echo "📋 Contents of src/adminjs/components.js:"
cat src/adminjs/components.js

# 4.1. Verify Firebase service account file exists
echo ""
echo "📋 Checking Firebase service account file:"
if [ -f "secure/firebase-service-account.json" ]; then
    echo "✅ Firebase service account file exists"
    echo "📋 File size: $(stat -f%z secure/firebase-service-account.json 2>/dev/null || stat -c%s secure/firebase-service-account.json 2>/dev/null) bytes"
else
    echo "❌ Firebase service account file missing at secure/firebase-service-account.json"
    echo "🔧 Creating secure directory if needed..."
    mkdir -p secure
    echo "⚠️ You need to upload your Firebase service account JSON file to secure/firebase-service-account.json"
fi

# 5. Clean reinstall of dependencies (if needed)
echo ""
echo "4️⃣ CHECKING DEPENDENCIES..."
if [ ! -d "node_modules" ]; then
    echo "🔧 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# 6. Build with proper error handling
echo ""
echo "5️⃣ BUILDING APPLICATION..."
echo "🔧 Running TypeScript build..."

if npm run build; then
    echo "✅ Build completed successfully!"
else
    echo "❌ Build failed! Checking for errors..."
    echo "📋 TypeScript errors:"
    npx tsc --noEmit --skipLibCheck
    exit 1
fi

# 7. Verify the build output
echo ""
echo "6️⃣ VERIFYING BUILD OUTPUT..."
if [ -d "dist" ]; then
    echo "✅ dist directory exists"
    echo "📋 dist contents:"
    ls -la dist/
else
    echo "❌ dist directory missing!"
    exit 1
fi

# 8. Stop all PM2 processes gracefully
echo ""
echo "7️⃣ RESTARTING PM2 PROCESSES..."
pm2 stop all
sleep 2

# 9. Start PM2 processes
pm2 start goatgoat-production
pm2 start goatgoat-staging

# 10. Wait for startup
echo "⏳ Waiting for applications to start..."
sleep 5

# 11. Show PM2 status
echo ""
echo "8️⃣ PM2 STATUS:"
pm2 list

# 12. Check for ComponentLoader errors (should be NONE)
echo ""
echo "9️⃣ CHECKING FOR ERRORS..."
echo "🔍 Checking for ComponentLoader errors (should be EMPTY):"
pm2 logs --lines 20 | grep -i "componentloader\|bundle" | head -10

echo ""
echo "🔍 Checking for AdminJS startup messages:"
pm2 logs --lines 20 | grep -i "adminjs.*built\|admin.*router" | head -5

# 13. Test the monitoring dashboard
echo ""
echo "🔟 TESTING MONITORING DASHBOARD:"
curl -I https://goatgoat.tech/admin/monitoring-dashboard || echo "❌ Dashboard test failed"

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================="
echo "📋 EXPECTED RESULTS:"
echo "   ✅ No ComponentLoader errors in logs"
echo "   ✅ AdminJS panel accessible at /admin"
echo "   ✅ Monitoring dashboard at /admin/monitoring-dashboard"
echo "   ✅ PM2 processes running normally"
echo ""
echo "🔍 To monitor ongoing logs:"
echo "   pm2 logs --lines 50"
echo ""
echo "🔧 If issues persist, check:"
echo "   pm2 logs --err --lines 50"
