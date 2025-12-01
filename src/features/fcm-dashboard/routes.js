import {
    getFCMManagementDashboard,
    sendToCustomers,
    sendToSellers,
    sendToDelivery,
    getDashboardTokens,
    deleteDashboardToken,
    getDashboardStats,
    getDashboardHistory,
    sendDashboardNotification
} from './fcmManagement.js';

// Admin Dashboard Route
export async function adminFcmRoutes(fastify) {
    // Dashboard HTML page
    fastify.get('/fcm-management', getFCMManagementDashboard);
    fastify.get('/fcm-management/api/tokens', getDashboardTokens);
    fastify.delete('/fcm-management/api/tokens/:tokenId', deleteDashboardToken);
    fastify.get('/fcm-management/api/history', getDashboardHistory);
    fastify.get('/fcm-management/api/stats', getDashboardStats);
    fastify.post('/fcm-management/api/send', sendDashboardNotification);
}

// API Routes for FCM operations
export async function apiFcmRoutes(fastify) {
    // Send notifications API endpoints
    fastify.post('/send-to-customers', sendToCustomers);
    fastify.post('/send-to-sellers', sendToSellers);
    fastify.post('/send-to-delivery', sendToDelivery);

    // Stats endpoint (used by dashboard)
    fastify.get('/stats', async (request, reply) => {
        // Redirect to existing stats endpoint or implement specific stats here
        // For now, we'll reuse the existing notification stats logic if needed, 
        // or just return basic stats as implemented in fcmManagement.js dashboard logic
        // But since the dashboard fetches from /admin/fcm-management/api/stats in some backups,
        // let's ensure we have what the frontend expects.

        // Based on the HTML analysis, the dashboard expects:
        // /admin/fcm-management/api/stats
        // /admin/fcm-management/api/tokens
        // /admin/fcm-management/api/history
        // /admin/fcm-management/api/send

        // However, the fcmManagement.js we found uses /api/fcm/send-to-customers etc.
        // We need to align these. The fcmManagement.js seems to have updated the frontend code 
        // to use /api/fcm/... endpoints. Let's stick to that for the API.

        return { message: "Stats endpoint" };
    });
}
