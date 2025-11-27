import { authenticate } from '../../../config/config.js';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONITORING_SECRET = process.env.MONITORING_SECRET || process.env.ACCESS_TOKEN_SECRET || 'monitoring-secret-key';
const COOKIE_NAME = 'monitoring_token';

export class AuthController {
    /**
     * Serve the login page
     */
    async serveLoginPage(req, reply) {
        try {
            const loginPagePath = path.join(__dirname, 'login.html');
            console.log('📄 Serving login page from:', loginPagePath);

            if (!fs.existsSync(loginPagePath)) {
                console.error('❌ Login page not found at:', loginPagePath);
                return reply.status(500).send({
                    success: false,
                    message: 'Login page not found. Please rebuild the application.',
                    hint: 'Run: npm run build'
                });
            }

            const html = fs.readFileSync(loginPagePath, 'utf8');
            return reply.type('text/html').send(html);
        } catch (error) {
            console.error('❌ Error serving login page:', error);
            return reply.status(500).send({
                success: false,
                message: 'Error loading login page',
                error: error.message
            });
        }
    }

    /**
     * Handle login request
     */
    async login(req, reply) {
        try {
            const { email, password } = req.body;

            console.log('🔐 Login attempt for:', email);

            if (!email || !password) {
                console.log('❌ Missing credentials');
                return reply.status(400).send({ success: false, message: 'Email and password are required' });
            }

            // Use existing authentication helper
            const authResult = await authenticate(email, password);

            console.log('🔍 Auth result structure:', JSON.stringify(authResult, null, 2));

            if (!authResult || !authResult.success) {
                console.log('❌ Invalid credentials for:', email);
                return reply.status(401).send({
                    success: false,
                    message: 'Invalid credentials. Ensure your admin account exists in the database.'
                });
            }

            // Check if user has admin role (double check)
            if (authResult.user.role !== 'Admin' && authResult.user.role !== 'Super Admin') {
                console.log('❌ Unauthorized role:', authResult.user.role, 'for:', email);
                return reply.status(403).send({ success: false, message: 'Unauthorized access' });
            }

            console.log('✅ Authentication successful for:', email, '(', authResult.user.role, ')');

            // Generate JWT for monitoring dashboard
            const token = jwt.sign(
                {
                    id: authResult.user.id,
                    email: authResult.user.email,
                    role: authResult.user.role,
                    type: 'monitoring_access'
                },
                MONITORING_SECRET,
                { expiresIn: '24h' }
            );

            console.log('🍪 Setting cookie for:', email);

            // Set HTTP-only cookie
            reply.setCookie(COOKIE_NAME, token, {
                path: '/admin/monitoring',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 // 24 hours
            });
            console.log('🍪 Cookie set:', COOKIE_NAME, 'Path:', '/admin/monitoring');
            console.log('🍪 Available cookies:', Object.keys(req.cookies || {}));
            console.log('🍪 Cookie value length:', token.length);

            console.log('✅ Login successful for:', email);
            return reply.send({
                success: true,
                message: 'Login successful',
                email: authResult.user.email
            });

        } catch (error) {
            console.error('❌ Monitoring Login Error:', error);
            return reply.status(500).send({ success: false, message: 'Internal server error' });
        }
    }

    /**
     * Handle logout
     */
    async logout(req, reply) {
        reply.clearCookie(COOKIE_NAME, { path: '/admin/monitoring' });
        return reply.redirect('/admin/monitoring/auth/login');
    }
}
