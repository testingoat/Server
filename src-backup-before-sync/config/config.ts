import fastifySession from '@fastify/session';
import ConnectMongoDBSession from 'connect-mongodb-session';
// import { Store } from 'express-session';
import { Admin, IAdmin } from '../models/user.js';

export const PORT = process.env.PORT || 3000;
export const COOKIE_PASSWORD = process.env.COOKIE_PASSWORD;

const MongoDBStore = ConnectMongoDBSession(fastifySession as any);

// Debug MongoDB URI
console.log('🔍 CONFIG.JS - MONGO_URI exists:', !!process.env.MONGO_URI);
console.log('🔍 CONFIG.JS - MONGO_URI length:', process.env.MONGO_URI?.length);
console.log('🔍 CONFIG.JS - MONGO_URI starts with:', process.env.MONGO_URI?.substring(0, 20));

// Clean and validate MONGO_URI
let mongoUri = process.env.MONGO_URI;
if (mongoUri) {
    // Remove any potential whitespace or newlines
    mongoUri = mongoUri.trim();
    console.log('🔍 CONFIG.JS - Cleaned MONGO_URI starts with:', mongoUri.substring(0, 20));
}

// Create session store only if MONGO_URI is available
let sessionStore: any;
if (mongoUri && (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://'))) {
    try {
        sessionStore = new MongoDBStore({
            uri: mongoUri,
            collection: 'sessions',
        });
        console.log('✅ SessionStore created successfully');
    } catch (error: any) {
        console.error('❌ Error creating SessionStore:', error.message);
        sessionStore = null;
    }
} else {
    console.error('❌ Invalid or missing MONGO_URI in config.js');
    console.error('📝 MONGO_URI should start with mongodb:// or mongodb+srv://');
    sessionStore = null;
}

export { sessionStore as sessionStore };

if (sessionStore) {
    sessionStore.on('error',(error: any)=>{
        console.log('Session store error',error);
    });
}

export const authenticate = async (email: string, password: string) => {
    console.log('🔐 AUTHENTICATION ATTEMPT:', { email, passwordLength: password?.length });

    try {
        if (!email || !password) {
            console.log('❌ Missing email or password');
            return null;
        }

        // Debug: Check database connection
        console.log('🔍 Searching for admin with email:', email);

        // Query the Admin collection
        const user = await Admin.findOne({ email: email }) as IAdmin;
        console.log('🔍 Database query result:', user ? 'User found' : 'User not found');

        if (!user) {
            console.log('❌ No admin user found with email:', email);
            return null;
        }

        console.log('🔍 Found user:', {
            id: user._id as string,
            email: user.email,
            name: user.name,
            role: user.role,
            isActivated: user.isActivated,
            passwordLength: user.password?.length,
        });

        // Compare passwords (plain text comparison)
        console.log('🔍 Password comparison:', {
            provided: password,
            stored: user.password,
            match: user.password === password,
        });

        if (user.password === password) {
            console.log('✅ Authentication successful for:', email);
            const authResult = {
                email: user.email,
                password: user.password,
                name: user.name,
                role: user.role,
                id: user._id.toString(),
            };
            console.log('🔄 Returning auth result:', authResult);
            return Promise.resolve(authResult);
        } else {
            console.log('❌ Password mismatch for:', email);
            console.log('❌ Expected:', user.password, 'Got:', password);
            return null;
        }
    } catch (error: any) {
        console.error('💥 Authentication error:', error);
        return null;
    }
};
