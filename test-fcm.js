// Test FCM functionality
import 'dotenv/config';

async function testFCM() {
    console.log('🔍 Testing Firebase Admin SDK initialization...');

    const fs = await import('fs');
    const path = await import('path');

    const firebaseServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

    try {
        let serviceAccount;
        let serviceAccountSource = 'unknown';

        // Method 1: Try to read from file path
        const absolutePath = path.resolve(firebaseServiceAccountPath);
        console.log('🔍 Looking for Firebase service account at:', absolutePath);

        if (fs.existsSync(absolutePath)) {
            console.log('📄 Reading Firebase service account from file:', absolutePath);
            const fileContent = fs.readFileSync(absolutePath, 'utf8');
            console.log('📄 File content length:', fileContent.length);
            console.log('🔤 First 100 chars:', fileContent.substring(0, 100));
            serviceAccount = JSON.parse(fileContent);
            serviceAccountSource = 'file';
        }
        // Method 2: Try environment variable with JSON string (not base64)
        else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            console.log('📄 Reading Firebase service account from JSON environment variable');
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            serviceAccountSource = 'env_json';
        }
        // Method 3: Try base64 environment variable (fallback)
        else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON) {
            console.log('📄 Reading Firebase service account from base64 environment variable');
            const buffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON, 'base64');
            const jsonString = buffer.toString('utf8');
            serviceAccount = JSON.parse(jsonString);
            serviceAccountSource = 'env_base64';
        }
        else {
            throw new Error('No Firebase service account found. Tried file path, JSON env var, and base64 env var.');
        }

        console.log('✅ Firebase service account loaded from:', serviceAccountSource);
        console.log('📋 Project ID:', serviceAccount.project_id);
        console.log('📧 Client Email:', serviceAccount.client_email);
        console.log('🔑 Private Key ID:', serviceAccount.private_key_id);

        // Import and initialize Firebase Admin
        console.log('📦 Importing firebase-admin...');
        const admin = await import('firebase-admin');

        if (admin.default.apps.length === 0) {
            console.log('🚀 Initializing Firebase Admin SDK...');
            admin.default.initializeApp({
                credential: admin.default.credential.cert(serviceAccount),
            });
            console.log('✅ Firebase Admin SDK initialized successfully');
        } else {
            console.log('ℹ️ Firebase Admin SDK already initialized');
        }

        // Test FCM messaging service
        console.log('🧪 Testing FCM messaging service...');
        const messaging = admin.default.messaging();
        console.log('✅ FCM messaging service accessible');

        console.log('🎉 All Firebase tests passed!');

    } catch (error) {
        console.error('❌ FCM test failed:', error);
        console.error('Error type:', error?.constructor?.name || 'Unknown');
        console.error('Error message:', error?.message || 'No message');
        console.error('Stack trace:', error?.stack || 'No stack trace');

        console.log('💡 Available Firebase environment variables:');
        console.log('  FIREBASE_SERVICE_ACCOUNT_PATH:', process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'not set');
        console.log('  FIREBASE_SERVICE_ACCOUNT_JSON:', process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'set' : 'not set');
        console.log('  FIREBASE_SERVICE_ACCOUNT_KEY_JSON:', process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON ? 'set' : 'not set');
    }
}

testFCM();
