import { MonitoringController } from './monitoring.controller.js';
import { DbStatsController } from './database/db-stats.controller.js';
import { NetworkController } from './network/network.controller.js';
import { EnvEditorController } from './env-editor/env-editor.controller.js';
import { errorController } from './errors/error.controller.js';
import { dbQueryController } from './database/db.query.controller.js';
import { authRoutes } from './auth/auth.routes.js';
import { verifyMonitoringAuth } from './auth/auth.middleware.js';

// Create controller instances
const controller = new MonitoringController();
const dbStatsController = new DbStatsController();
const networkController = new NetworkController();
const envEditorController = new EnvEditorController();

export async function monitoringRoutes(fastify, options) {
    // Register Protected Routes (Auth routes handled separately in app.ts)
    await fastify.register(async (protectedFastify) => {
        // Apply Auth Middleware to this scope
        protectedFastify.addHook('preHandler', verifyMonitoringAuth);

        // DB Stats
        protectedFastify.get('/admin/monitoring/db/stats', async (request, reply) => {
            return dbStatsController.getStats(request, reply);
        });

        // DB Query Tool
        protectedFastify.get('/admin/monitoring/db/collections', async (request, reply) => {
            return dbQueryController.getCollections(request, reply);
        });

        protectedFastify.post('/admin/monitoring/db/query', async (request, reply) => {
            return dbQueryController.runQuery(request, reply);
        });

        // Network Stats
        protectedFastify.get('/admin/monitoring/network/stats', async (request, reply) => {
            return networkController.getStats(request, reply);
        });

        // Env Editor Routes
        protectedFastify.get('/admin/monitoring/env', async (request, reply) => {
            return envEditorController.getEnv(request, reply);
        });

        protectedFastify.post('/admin/monitoring/env', async (request, reply) => {
            return envEditorController.updateEnv(request, reply);
        });

        // Error Tracking Routes
        protectedFastify.post('/admin/monitoring/errors', async (request, reply) => {
            return errorController.logError(request, reply);
        });

        protectedFastify.get('/admin/monitoring/errors', async (request, reply) => {
            return errorController.getErrors(request, reply);
        });

        protectedFastify.patch('/admin/monitoring/errors/:id', async (request, reply) => {
            return errorController.updateErrorStatus(request, reply);
        });

        protectedFastify.delete('/admin/monitoring/errors', async (request, reply) => {
            return errorController.clearErrors(request, reply);
        });

        // Get metrics endpoint
        protectedFastify.get('/admin/monitoring/metrics', async (request, reply) => {
            return controller.getMetrics(request, reply);
        });

        // Create backup endpoint
        protectedFastify.post('/admin/monitoring/backup', async (request, reply) => {
            return controller.createBackup(request, reply);
        });

        // Download backup endpoint
        protectedFastify.get('/admin/monitoring/download/:filename', async (request, reply) => {
            return controller.downloadBackup(request, reply);
        });

        // Get backups list
        protectedFastify.get('/admin/monitoring/backups', async (request, reply) => {
            return controller.getBackups(request, reply);
        });

        // Restart server endpoint
        protectedFastify.post('/admin/monitoring/restart', async (request, reply) => {
            return controller.restartServer(request, reply);
        });

        // Historical data endpoint
        protectedFastify.get('/admin/monitoring/historical', async (request, reply) => {
            return controller.getHistoricalData(request, reply);
        });

        // Recent logs endpoint
        protectedFastify.get('/admin/monitoring/logs/recent', async (request, reply) => {
            return controller.getRecentLogs(request, reply);
        });

        // WebSocket endpoint for real-time logs
        protectedFastify.get('/admin/monitoring/logs/stream', { websocket: true }, (connection, req) => {
            return controller.handleLogStream(connection, req);
        });
    });
}
