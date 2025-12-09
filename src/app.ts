
// Load environment-specific dotenv file
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Get NODE_ENV from PM2 or default
const NODE_ENV = process.env.NODE_ENV || 'development';
console.log(`🌍 Environment detected: ${NODE_ENV}`);

// Try loading environment-specific files in order of priority
const envFiles = [
    `.env.${NODE_ENV}`,        // .env.production, .env.staging, etc.
    '.env.local',               // Local overrides (not in git)
    '.env'                      // Default fallback
];

// Load environment files
let loaded = false;
for (const envFile of envFiles) {
    const envPath = path.resolve(envFile);
    if (fs.existsSync(envPath)) {
        console.log(`🔧 Loading environment file: ${envPath}`);
        dotenv.config({ path: envPath });
        loaded = true;
        // Don't break - allow multiple files to load (later ones override earlier ones)
    } else {
        console.log(`🔍 Environment file not found: ${envPath}`);
    }
}

if (!loaded) {
    console.warn(`⚠️ No .env files found! Using system environment variables only.`);
}

import { connectDB } from './config/connect.js';
import fastify from 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PORT } from './config/config.js';
import { seedDefaultDeliveryFeeConfig } from './config/seedDeliveryFeeConfig.js';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';

import { registerRoutes } from './routes/index.js';
import { Server as SocketIOServer } from 'socket.io';
import { admin, buildAdminRouter } from './config/setup.js';
import mongoose from 'mongoose';
import { verifyMonitoringAuth } from './features/monitoring/auth/auth.middleware.js';

const start = async () => {
    console.log('DEBUG: process.env.NODE_ENV in app.ts:', process.env.NODE_ENV);

    // 🐛 DEBUG: Check JWT secrets on app startup
    console.log('🔍 STARTUP DEBUG - JWT Environment Variables:');
    console.log('ACCESS_TOKEN_SECRET exists:', !!process.env.ACCESS_TOKEN_SECRET);
    console.log('REFRESH_TOKEN_SECRET exists:', !!process.env.REFRESH_TOKEN_SECRET);
    console.log('All env keys containing TOKEN:', Object.keys(process.env).filter(key => key.includes('TOKEN')));
    console.log('Current working directory:', process.cwd());

    // Check if .env files exist
    const fs = await import('fs');
    const path = await import('path');
    const envProductionPath = path.resolve('.env.production');
    const envPath = path.resolve('.env');
    console.log('Checking .env.production at:', envProductionPath, 'exists:', fs.existsSync(envProductionPath));
    console.log('Checking .env at:', envPath, 'exists:', fs.existsSync(envPath));

    // Initialize Firebase Admin SDK (optional - won't crash if missing)
    if (process.env.DISABLE_FIREBASE === 'true') {
        console.log('🚫 Firebase Admin SDK initialization skipped (DISABLE_FIREBASE=true)');
    } else {
        const firebaseServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

        try {
            console.log('🔍 Attempting to initialize Firebase Admin SDK...');
            console.log('🔍 Looking for Firebase service account at:', firebaseServiceAccountPath);

            // Check if file exists
            const fs = await import('fs');
            const path = await import('path');

            let serviceAccount;
            let serviceAccountSource = 'unknown';

            // Method 1: Try to read from file path
            const absolutePath = path.resolve(firebaseServiceAccountPath);
            if (fs.existsSync(absolutePath)) {
                console.log('📄 Reading Firebase service account from file:', absolutePath);
                const fileContent = fs.readFileSync(absolutePath, 'utf8');
                serviceAccount = JSON.parse(fileContent);
                serviceAccountSource = 'file';
            }
            // Method 2: Try environment variable with JSON string (not base64)
            else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
                console.log('📄 Reading Firebase service account from environment variable');
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

            // Normalize PEM newlines if provided via env to avoid Invalid PEM formatted message
            if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }

            // Dynamically import firebase-admin
            let adminModule;
            try {
                adminModule = await import('firebase-admin');
            } catch (importError) {
                console.error('❌ Failed to import firebase-admin. Is it installed?', importError);
                throw importError;
            }

            // Initialize Firebase Admin SDK
            adminModule.default.initializeApp({
                credential: adminModule.default.credential.cert(serviceAccount),
            });
            console.log('✅ Firebase Admin SDK initialized successfully.');

        } catch (error: any) {
            console.error('⚠️ Failed to initialize Firebase Admin SDK (continuing without it):', error);
            console.error('Error type:', error?.constructor?.name || 'Unknown');
            console.error('Error message:', error?.message || 'No message');
            console.log('💡 Tip: Place firebase-service-account.json in server directory or set FIREBASE_SERVICE_ACCOUNT_JSON env var');
        }
    }

    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI environment variable is required');
    }
    await connectDB(process.env.MONGO_URI);

    console.log('🌱 Seeding default delivery fee configuration...');
    try {
        await seedDefaultDeliveryFeeConfig();
        console.log('✅ Delivery fee configuration check completed');
    } catch (error) {
        console.error('⚠️ Error during delivery fee config seeding:', error);
        console.log('⚠️ Server will continue, but order creation may fail without config');
    }

    const app = fastify();

    // Serve empty favicon to silence 404s in AdminJS and browser
    app.get('/favicon.ico', async (_req: FastifyRequest, reply: FastifyReply) => {
        reply.code(204).send();
    });


    // Register WebSocket support
    await app.register(websocket);

    // Register Cookie Plugin (required for monitoring auth)
    await app.register(cookie);
    console.log('✅ Cookie plugin registered');

    // Health check endpoint for cloud deployment
    app.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
        try {
            // Check database connection
            const dbState = mongoose.connection.readyState;
            const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

            // Test delivery partner count
            const { DeliveryPartner } = await import('./models/user.js');
            const deliveryPartnerCount = await DeliveryPartner.countDocuments();
            console.log(`Found ${deliveryPartnerCount} delivery partners in database`);

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: dbStatus,
                deliveryPartners: deliveryPartnerCount,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0',
            };
        } catch (error: any) {
            _reply.code(500);
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString(),
            };
        }
    });

    // Serve static assets from dist/public for paths under /public/*
    app.get('/public/*', async (request: any, reply: FastifyReply) => {
        try {
            const fs = await import('fs');
            const path = await import('path');

            const wildcardPath = request.params['*'] || '';
            const safePath = wildcardPath.replace(/(\.\.[/\\])+/g, '');
            const filePath = path.join(process.cwd(), 'dist', 'public', safePath);

            if (!fs.existsSync(filePath)) {
                reply.code(404).send({ message: 'File not found' });
                return;
            }

            if (filePath.endsWith('.js')) {
                reply.type('application/javascript');
            } else if (filePath.endsWith('.css')) {
                reply.type('text/css');
            } else if (filePath.endsWith('.html')) {
                reply.type('text/html');
            }

            const stream = fs.createReadStream(filePath);
            reply.send(stream);
        } catch (error: any) {
            reply.code(500).send({ message: 'Error serving static file', error: error.message });
        }
    });

    try {
        // 1. Register Network Monitoring Middleware
        const { networkMiddleware } = await import('./features/monitoring/network/network-middleware.js');
        await app.register(networkMiddleware);
        console.log('✅ Network monitoring middleware registered');

        // 2. Register regular API routes
        await registerRoutes(app);
        console.log('Routes registered successfully');

        // 3. Register monitoring AUTH routes FIRST (no middleware - must be accessible)
        try {
            const { authRoutes } = await import('./features/monitoring/auth/auth.routes.js');
            await app.register(authRoutes);
            console.log('✅ Monitoring auth routes registered (login/logout)');
        } catch (error) {
            console.error('⚠️ Error registering monitoring auth routes:', error);
        }

        // 4. Register monitoring PROTECTED routes (with auth middleware)
        try {
            const { monitoringRoutes } = await import('./features/monitoring/monitoring.routes.js');
            await app.register(monitoringRoutes);
            console.log('✅ Monitoring protected routes registered');
        } catch (error) {
            console.error('⚠️ Error registering monitoring routes:', error);
        }

        // 5. Initialize monitoring service
        try {
            const { monitoringService } = await import('./features/monitoring/monitoring.service.js');
            await monitoringService.initialize(app.server);
            console.log('✅ Monitoring service initialized');
        } catch (error) {
            console.error('⚠️ Error initializing monitoring service:', error);
        }

        console.log('✅ Monitoring routes registered successfully (FBA)');
    } catch (error) {
        console.error('⚠️ Error registering monitoring routes:', error);
        // Don't exit - continue without monitoring routes
    }

    // Add admin debug route
    app.get('/admin/debug', async (_request: FastifyRequest, _reply: FastifyReply) => {
        try {
            const { Admin } = await import('./models/index.js');
            const admins = await Admin.find({});
            return {
                status: 'success',
                totalAdmins: admins.length,
                admins: admins.map((adminUser: any) => ({
                    id: adminUser._id,
                    email: adminUser.email,
                    name: adminUser.name,
                    role: adminUser.role,
                    isActivated: adminUser.isActivated,
                    passwordLength: adminUser.password?.length,
                })),
            };
        } catch (error: any) {
            return {
                status: 'error',
                error: error.message,
            };
        }
    });

    // Add authentication test route
    app.post('/admin/test-auth', async (_request: FastifyRequest, _reply: FastifyReply) => {
        try {
            const { email, password } = _request.body as any;
            console.log('Test auth attempt with email:', email);
            const { authenticate } = await import('./config/config.js');
            const result = await authenticate(email, password);
            return {
                status: 'success',
                authenticated: !!(result && result.success),
                result: result,
            };
        } catch (error: any) {
            return {
                status: 'error',
                error: error.message,
            };
        }
    });

    // Add route test endpoint
    app.get('/admin/test-routes', async (_request: FastifyRequest, _reply: FastifyReply) => {
        try {
            // List all registered routes
            const routes = app.printRoutes({ commonPrefix: false });
            console.log('Registered routes:', routes);
            return {
                status: 'success',
                routes: routes,
            };
        } catch (error: any) {
            return {
                status: 'error',
                error: error.message,
            };
        }
    });

    // Add session test route
    app.get('/admin/test-session', async (_request: FastifyRequest, _reply: FastifyReply) => {
        try {
            return {
                status: 'success',
                session: _request.session,
                headers: _request.headers,
            };
        } catch (error: any) {
            return {
                status: 'error',
                error: error.message,
            };
        }
    });

    // Add monitoring dashboard endpoint
    app.get('/admin/monitoring', async (_request: FastifyRequest, _reply: FastifyReply) => {
        try {
            // Get database connection status
            const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

            // Get delivery partner count
            const { DeliveryPartner } = await import('./models/user.js');
            const deliveryPartnerCount = await DeliveryPartner.countDocuments();

            const monitoring = {
                title: '🚀 GoatGoat Server Monitoring Dashboard',
                message: 'Real-time server health and performance metrics',
                timestamp: new Date().toISOString(),
                serverHealth: {
                    status: 'healthy',
                    uptime: Math.floor(process.uptime()),
                    uptimeFormatted: `${Math.floor(process.uptime() / 86400)}d ${Math.floor((process.uptime() % 86400) / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
                    memory: {
                        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`,
                        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
                        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)} MB`,
                        external: `${(process.memoryUsage().external / 1024 / 1024).toFixed(1)} MB`,
                        heapUsedPercent: `${((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100).toFixed(1)}%`
                    },
                    database: dbStatus,
                    deliveryPartners: deliveryPartnerCount,
                    environment: process.env.NODE_ENV || 'unknown',
                    platform: process.platform,
                    nodeVersion: process.version
                },
                endpoints: {
                    production: 'https://goatgoat.tech',
                    staging: 'https://staging.goatgoat.tech',
                    adminPanel: '/admin',
                    healthCheck: '/health',
                    monitoring: '/admin/monitoring'
                }
            };

            return monitoring;
        } catch (error: any) {
            return {
                title: '🚀 GoatGoat Server Monitoring Dashboard',
                message: 'Error fetching server metrics',
                timestamp: new Date().toISOString(),
                error: error?.message || 'Unknown error',
                serverHealth: {
                    status: 'error',
                    uptime: Math.floor(process.uptime()),
                    memory: process.memoryUsage(),
                    database: 'unknown'
                }
            };
        }
    });



    // Add notification center endpoint
    app.get('/admin/notifications', async (_request: FastifyRequest, _reply: FastifyReply) => {
        return {
            title: '📱 Notification Center',
            message: 'Welcome to Notification Center',
            description: 'Send push notifications and SMS to your users',
            features: [
                'Push Notifications via Firebase Cloud Messaging',
                'SMS Notifications via Fast2SMS API',
                'Target specific users or groups',
                'Template management',
                'Notification history and analytics'
            ],
            endpoints: {
                sendNotification: '/api/notifications/send',
                testSms: '/admin/ops/test-otp'
            }
        };
    });

    console.log('DEBUG: COOKIE_PASSWORD in app.ts before buildAdminRouter:', process.env.COOKIE_PASSWORD);

    // Log registered routes before starting
    console.log('Routes before starting server:');
    try {
        const routes = app.printRoutes({ commonPrefix: false });
        console.log('Registered routes:', routes);
    } catch (error) {
        console.log('Error getting routes:', error);
    }

    // Create Socket.IO server using Fastify's HTTP server BEFORE starting
    const io = new SocketIOServer(app.server, {
        cors: {
            origin: '*',
        },
        pingInterval: 10000,
        pingTimeout: 5000,
        transports: ['websocket', 'polling'],
    });

    // Attach Socket.IO to the app instance for access in routes BEFORE starting
    app.decorate('io', io);

    // Build AdminJS router AFTER registering socket but BEFORE starting the server
    await buildAdminRouter(app);

    // Register monitoring dashboard AFTER AdminJS to prevent conflicts
    console.log('🔧 Registering monitoring dashboard route...');
    app.get('/admin/monitoring/dashboard', { preHandler: verifyMonitoringAuth }, async (request: any, reply: any) => {
        try {
            const fs = await import('fs');
            const path = await import('path');
            // Serve the new Glassmorphism dashboard HTML
            const dashboardPath = path.join(process.cwd(), 'dist', 'features', 'monitoring', 'dashboard.html');

            if (fs.existsSync(dashboardPath)) {
                const html = fs.readFileSync(dashboardPath, 'utf8');
                reply.type('text/html').send(html);
            } else {
                // Fallback if file not found
                reply.type('text/html').send('<h1>Dashboard file not found</h1>');
            }
        } catch (error: any) {
            reply.type('text/html').send(`<h1>Error loading dashboard: ${error.message}</h1>`);
        }
    });
    console.log('✅ Monitoring dashboard route registered successfully');

    // Redirect old monitoring dashboard URL to new one (backward compatibility)
    app.get('/admin/monitoring-dashboard', async (request: any, reply: any) => {
        console.log('🔀 Redirecting /admin/monitoring-dashboard → /admin/monitoring/dashboard');
        return reply.redirect(301, '/admin/monitoring/dashboard');
    });
    console.log('✅ Monitoring dashboard redirect registered (backward compatibility)');

    // Start the Fastify server and get the server instance
    try {
        await app.listen({ port: Number(PORT), host: '0.0.0.0' });
        console.log(`Grocery App running on http://localhost:${PORT}${admin.options.rootPath}`);
    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }

    // Setup Socket.IO connection handling
    io.on('connection', (socket: any) => {
        console.log('A User Connected ✅');

        socket.on('joinRoom', (orderId: string) => {
            socket.join(orderId);
            console.log(` 🔴 User Joined room ${orderId}`);
        });

        socket.on('disconnect', () => {
            console.log('User Disconnected ❌');
        });
    });

};

start();
