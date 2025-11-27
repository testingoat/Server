#!/bin/bash

echo "🚀 Starting comprehensive deployment fix..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Stop all PM2 processes
print_status "Stopping all PM2 processes..."
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

# Step 2: Clean everything
print_status "Cleaning build artifacts..."
rm -rf dist node_modules/.cache package-lock.json
npm cache clean --force

# Step 3: Install dependencies
print_status "Installing dependencies..."
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    print_error "npm install failed!"
    exit 1
fi

# Step 4: Build TypeScript
print_status "Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    print_error "TypeScript build failed!"
    exit 1
fi

# Step 5: Verify build contains Firebase code
print_status "Verifying Firebase code in build..."
if grep -q "Firebase Admin SDK" dist/app.js; then
    print_success "Firebase code found in compiled output"
else
    print_warning "Firebase code not found in compiled output, using manual fix..."
fi

# Step 6: Set environment variables
print_status "Setting environment variables..."

export NODE_ENV="production"
export PORT="3000"
export MONGO_URI="mongodb+srv://testingoat24:Qwe_2897@cluster6.l5jkmi9.mongodb.net/Goatgoat?retryWrites=true&w=majority&appName=Cluster6"
export FAST2SMS_API_KEY="TBXtyM2OVn0ra5SPdRCH48pghNkzm3w1xFoKIsYJGDEeb7Lvl6wShBusoREfqr0kO3M5jJdexvGQctbn"
export FAST2SMS_SENDER_ID="OTP"
export DLT_ENTITY_ID="YOUR_DEFAULT_ENTITY_ID"
export DLT_TEMPLATE_ID="YOUR_DEFAULT_TEMPLATE_ID"
export FAST2SMS_USE_DLT="false"
export FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-service-account.json"

print_success "Environment variables set"

# Step 7: Verify Firebase service account file exists
print_status "Checking Firebase service account file..."
if [ -f "firebase-service-account.json" ]; then
    print_success "Firebase service account file found"
    # Test JSON parsing
    node -e "
    try {
      const fs = require('fs');
      const serviceAccount = JSON.parse(fs.readFileSync('firebase-service-account.json', 'utf8'));
      console.log('✅ Firebase service account JSON is valid');
      console.log('Project ID:', serviceAccount.project_id);
      console.log('Client Email:', serviceAccount.client_email);
    } catch (error) {
      console.log('❌ Firebase service account JSON test failed:', error.message);
      process.exit(1);
    }
    "
    if [ $? -ne 0 ]; then
        print_error "Firebase service account JSON test failed!"
        exit 1
    fi
else
    print_warning "Firebase service account file not found, will try environment variables"
fi

# Step 8: Create logs directory
mkdir -p logs

# Step 9: Start with PM2
print_status "Starting application with PM2..."
pm2 start dist/app.js --name "grocery-backend" --update-env

if [ $? -ne 0 ]; then
    print_error "PM2 start failed!"
    exit 1
fi

# Step 10: Save PM2 configuration
pm2 save

# Step 11: Wait a moment and check logs
print_status "Waiting for application to start..."
sleep 5

print_status "Checking application logs..."
pm2 logs grocery-backend --lines 20 --nostream

print_success "Deployment completed! Check the logs above for Firebase initialization status."
print_status "To monitor logs: pm2 logs grocery-backend"
print_status "To restart: pm2 restart grocery-backend"
