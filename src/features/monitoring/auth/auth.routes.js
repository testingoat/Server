import { AuthController } from './auth.controller.js';

export const authRoutes = async (fastify, options) => {
    const controller = new AuthController();

    // Login Page
    fastify.get('/admin/monitoring/auth/login', controller.serveLoginPage);

    // Login API
    fastify.post('/admin/monitoring/auth/login', controller.login);

    // Logout API
    fastify.post('/admin/monitoring/auth/logout', controller.logout);
    fastify.get('/admin/monitoring/auth/logout', controller.logout); // Allow GET for easier logout links
};
