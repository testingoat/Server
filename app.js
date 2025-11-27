// Load dotenv first if not in production
if (process.env.NODE_ENV !== 'production') {
    try {
        const dotenv = await import('dotenv');
        dotenv.config();
        console.log('✅ dotenv loaded for development');
    } catch (error) {
        console.log('ℹ️ dotenv not available, using environment variables directly');
    }
}

import { connectDB } from "./src/config/connect.js";
import fastify from 'fastify';
import { PORT } from "./src/config/config.js";
import fastifySocketIO from "fastify-socket.io";
import fastifyWebsocket from "@fastify/websocket";
import cookie from '@fastify/cookie';
import { admin, buildAdminRouter } from './src/config/setup.js';
import mongoose from 'mongoose';

const start = async () => {
    // Clean environment variables (remove any prefixes)
    const cleanEnvVar = (value) => {
        if (!value) return value;
        // Remove any "KEY=" prefix that might have been accidentally added
        const cleaned = value.replace(/^[A-Z_]+=/, '');
        return cleaned;
    };

    // Clean critical environment variables
    if (process.env.NODE_ENV) {
        process.env.NODE_ENV = cleanEnvVar(process.env.NODE_ENV);
    }
    if (process.env.MONGO_URI) {
        process.env.MONGO_URI = cleanEnvVar(process.env.MONGO_URI);
    }

    // Debug environment variables
    console.log('🔍 DEBUGGING ENVIRONMENT VARIABLES:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', process.env.PORT);
    console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
    console.log('MONGO_URI value:', process.env.MONGO_URI ? 'SET' : 'UNDEFINED');
    console.log('All env keys:', Object.keys(process.env).filter(key => key.includes('MONGO')));

    // Validate environment variables
    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI environment variable is required');
        console.error('🔧 Please set MONGO_URI in Render dashboard Environment Variables');
        console.error('📝 Value should be: mongodb+srv://testingoat24:Qwe_2897@cluster6.l5jkmi9.mongodb.net/Goatgoat?retryWrites=true&w=majority&appName=Cluster6');
        process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await connectDB(process.env.MONGO_URI);
    const app = fastify()

    app.register(fastifySocketIO, {
        cors: {
            origin: "*"
        },
        pingInterval: 10000,
        pingTimeout: 5000,
        transports: ['websocket']
    })

    app.register(fastifyWebsocket);

    // Health check endpoint for cloud deployment
    app.get('/health', async (request, reply) => {
        try {
            // Check database connection
            const dbState = mongoose.connection.readyState;
            const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: dbStatus,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0'
            };
        } catch (error) {
            reply.code(500);
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    });

    await registerRoutes(app)

    // Add admin debug route
    app.get('/admin/debug', async (request, reply) => {
        try {
            const { Admin } = await import('./src/models/index.js');
            const admins = await Admin.find({});
            return {
                status: 'success',
                totalAdmins: admins.length,
                admins: admins.map(admin => ({
                    id: admin._id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                    isActivated: admin.isActivated,
                    passwordLength: admin.password?.length
                }))
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    });

    // Add authentication test route
    app.post('/admin/test-auth', async (request, reply) => {
        try {
            const { email, password } = request.body;
            const { authenticate } = await import('./src/config/config.js');
            const result = await authenticate(email, password);
            return {
                status: 'success',
                authenticated: !!(result && result.success),
                result: result
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    });

    // Add session test route
    app.get('/admin/test-session', async (request, reply) => {
        try {
            return {
                status: 'success',
                session: request.session,
                cookies: request.cookies,
                headers: request.headers
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    });

    await buildAdminRouter(app);

    app.listen({ port: PORT, host: '0.0.0.0' }, (err, addr) => {
        if (err) {
            console.log(err);
        } else {
            console.log(`Grocery App running on http://localhost:${PORT}${admin.options.rootPath}`)
        }
    })

    app.ready().then(() => {
        app.io.on('connection', (socket) => {
            console.log("A User Connected ✅")

            socket.on("joinRoom", (orderId) => {
                socket.join(orderId);
                console.log(` 🔴 User Joined room ${orderId}`)
            })

            socket.on('disconnect', () => {
                console.log("User Disconnected ❌")
            })
        })
    })

}

start()