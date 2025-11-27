import admin from 'firebase-admin';

let firebaseInitialized = false;

export const initializeFirebaseAdmin = async (): Promise<boolean> => {
  try {
    if (firebaseInitialized) {
      console.log('✅ Firebase Admin already initialized');
      return true;
    }

    console.log('🔥 Initializing Firebase Admin SDK...');

    // Get credentials from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase environment variables');
    }

    // Clean up the private key (handle escaped newlines)
    const cleanPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: cleanPrivateKey,
      }),
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log('📋 Project ID:', projectId);
    console.log('📧 Client Email:', clientEmail);

    return true;
  } catch (error: any) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    return false;
  }
};

export { admin };
