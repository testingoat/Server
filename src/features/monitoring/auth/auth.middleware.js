import jwt from 'jsonwebtoken';

const MONITORING_SECRET = process.env.MONITORING_SECRET || process.env.ACCESS_TOKEN_SECRET || 'monitoring-secret-key';
const COOKIE_NAME = 'monitoring_token';

/**
 * Helper function to determine if a request is an API call vs HTML page
 * All routes under /admin/monitoring/ are API requests except:
 * - /admin/monitoring/auth/login (login HTML page)
 * - /admin/monitoring/dashboard (dashboard HTML page)
 */
const isApiRequest = (url) => {
    // If it's under /admin/monitoring/
    if (url.startsWith('/admin/monitoring/')) {
        // Exclude HTML pages
        if (url === '/admin/monitoring/auth/login' || url.startsWith('/admin/monitoring/auth/login?')) {
            return false; // Login page
        }
        if (url === '/admin/monitoring/dashboard' || url.startsWith('/admin/monitoring/dashboard?')) {
            return false; // Dashboard HTML page (not an API endpoint)
        }
        // Exclude WebSocket endpoints (they handle auth differently)
        if (url === '/admin/monitoring/logs/stream' || url.startsWith('/admin/monitoring/logs/stream?')) {
            return false; // WebSocket endpoint
        }
        // Everything else under /admin/monitoring/ is an API endpoint
        return true;
    }
    return false;
};

export const verifyMonitoringAuth = async (req, reply) => {
    const path = req.url;
    console.log(`🔐 Auth check for: ${path}`);

    // Check if this is a WebSocket upgrade request
    const isWebSocket = req.headers.upgrade === 'websocket';
    if (isWebSocket) {
        console.log('🔌 WebSocket upgrade request detected');
        // For WebSocket, check for token in query params as fallback
        const queryToken = req.query?.token;
        if (queryToken) {
            try {
                const decoded = jwt.verify(queryToken, MONITORING_SECRET);
                if (decoded.type === 'monitoring_access') {
                    console.log(`✅ WebSocket authenticated via query token for: ${decoded.email}`);
                    req.user = decoded;
                    return; // Allow WebSocket upgrade
                }
            } catch (err) {
                console.log(`❌ Invalid WebSocket query token: ${err.message}`);
            }
        }
        // If no valid query token, try cookie (may work in some browsers)
        console.log('⚠️ No query token, attempting cookie auth for WebSocket');
    }

    // Log available cookies
    const cookies = req.cookies || {};
    console.log(`🍪 Available cookies: ${Object.keys(cookies).join(', ') || 'none'}`);

    const token = cookies[COOKIE_NAME];

    if (!token) {
        console.log(`❌ No token found for: ${path}`);

        if (isWebSocket) {
            console.log('❌ WebSocket auth failed: No token provided');
            return reply.code(401).send('Unauthorized');
        }

        // Use robust API detection
        if (isApiRequest(path)) {
            return reply.status(401).send({ success: false, message: 'Authentication required' });
        }
        // Otherwise redirect to login page
        return reply.redirect('/admin/monitoring/auth/login');
    }

    try {
        const decoded = jwt.verify(token, MONITORING_SECRET);

        if (decoded.type !== 'monitoring_access') {
            throw new Error('Invalid token type');
        }

        console.log(`✅ Token valid for: ${decoded.email}`);
        req.user = decoded;
    } catch (error) {
        console.log(`❌ Token verification failed: ${error.message}`);
        console.log(`   Route: ${path}`);

        // Clear invalid cookie
        reply.clearCookie(COOKIE_NAME, { path: '/admin/monitoring' });

        if (isWebSocket) {
            console.log('❌ WebSocket auth failed: Invalid token');
            return reply.code(401).send('Unauthorized');
        }

        // Use robust API detection
        if (isApiRequest(path)) {
            return reply.status(401).send({ success: false, message: 'Invalid or expired session' });
        }
        return reply.redirect('/admin/monitoring/auth/login');
    }
};
