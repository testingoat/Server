import { sendPushNotification, sendTopicNotification } from '../services/fcmService.js';
// import { sendPushNotificationToUsers } from '../services/notificationService.js';
import { verifyToken } from '../middleware/auth.js';
export default async function notificationRoutes(fastify) {
    // Send push notification to single token
    fastify.post('/notifications/send', { preHandler: [verifyToken] }, async (req, reply) => {
        try {
            const { fcmToken, title, body, data, imageUrl } = req.body;
            if (!fcmToken || !title || !body) {
                return reply.status(400).send({
                    success: false,
                    message: 'fcmToken, title, and body are required',
                });
            }
            const payload = { title, body, data, imageUrl };
            const result = await sendPushNotification(fcmToken, payload);
            return reply.send(result);
        }
        catch (error) {
            console.error('Send notification error:', error);
            return reply.status(500).send({
                success: false,
                message: 'Internal server error',
            });
        }
    });
    // Send push notifications to multiple users
    fastify.post('/notifications/broadcast', { preHandler: [verifyToken] }, async (req, reply) => {
        try {
            const { userIds, role, title, body, data, imageUrl } = req.body;
            if (!userIds || !Array.isArray(userIds) || !role || !title || !body) {
                return reply.status(400).send({
                    success: false,
                    message: 'userIds (array), role, title, and body are required',
                });
            }
            if (!['Customer', 'DeliveryPartner'].includes(role)) {
                return reply.status(400).send({
                    success: false,
                    message: 'role must be either Customer or DeliveryPartner',
                });
            }
            const payload = { title, body, data, imageUrl };
            //       const result = await sendPushNotificationToUsers(userIds, role, payload);
            //       return reply.send(result);
            return reply.send({ success: true, message: "Broadcast notification feature temporarily disabled" });
        }
        catch (error) {
            console.error('Broadcast notification error:', error);
            return reply.status(500).send({
                success: false,
                message: 'Internal server error',
            });
        }
    });
    // Send notification to topic
    fastify.post('/notifications/topic', { preHandler: [verifyToken] }, async (req, reply) => {
        try {
            const { topic, title, body, data, imageUrl } = req.body;
            if (!topic || !title || !body) {
                return reply.status(400).send({
                    success: false,
                    message: 'topic, title, and body are required',
                });
            }
            const payload = { title, body, data, imageUrl };
            const result = await sendTopicNotification(topic, payload);
            return reply.send(result);
        }
        catch (error) {
            console.error('Topic notification error:', error);
            return reply.status(500).send({
                success: false,
                message: 'Internal server error',
            });
        }
    });
    // Test FCM service status
    fastify.get('/notifications/test-fcm', { preHandler: [verifyToken] }, async (req, reply) => {
        try {
            const { admin } = await import('../config/firebase-admin.js');
            const status = {
                firebaseInitialized: admin.apps.length > 0,
                timestamp: new Date().toISOString(),
                message: admin.apps.length > 0 ? 'Firebase Admin SDK is initialized and ready' : 'Firebase Admin SDK is not initialized',
            };
            return reply.send({
                success: true,
                status,
            });
        }
        catch (error) {
            console.error('FCM test error:', error);
            return reply.status(500).send({
                success: false,
                message: 'Internal server error',
                error: error.message,
            });
        }
    });
    // Send test notification (for debugging)
    fastify.post('/notifications/test', { preHandler: [verifyToken] }, async (req, reply) => {
        try {
            const { fcmToken } = req.body;
            if (!fcmToken) {
                return reply.status(400).send({
                    success: false,
                    message: 'fcmToken is required for test notification',
                });
            }
            const testPayload = {
                title: 'GoatGoat Test Notification',
                body: 'This is a test push notification from GoatGoat Grocery Platform',
                data: {
                    type: 'test',
                    timestamp: new Date().toISOString(),
                },
            };
            const result = await sendPushNotification(fcmToken, testPayload);
            return reply.send({
                success: result.success,
                message: result.success ? 'Test notification sent successfully' : 'Failed to send test notification',
                result,
            });
        }
        catch (error) {
            console.error('Test notification error:', error);
            return reply.status(500).send({
                success: false,
                message: 'Internal server error',
                error: error.message,
            });
        }
    });
    // Get notification statistics
    fastify.get('/notifications/stats', { preHandler: [verifyToken] }, async (req, reply) => {
        try {
            const { Customer, DeliveryPartner } = await import('../models/index.js');
            // Count users with FCM tokens
            const customerTokenCount = await Customer.countDocuments({ fcmToken: { $exists: true, $ne: null } });
            const deliveryPartnerTokenCount = await DeliveryPartner.countDocuments({ fcmToken: { $exists: true, $ne: null } });
            const stats = {
                totalUsersWithTokens: customerTokenCount + deliveryPartnerTokenCount,
                customerTokens: customerTokenCount,
                deliveryPartnerTokens: deliveryPartnerTokenCount,
                timestamp: new Date().toISOString(),
            };
            return reply.send({
                success: true,
                stats,
            });
        }
        catch (error) {
            console.error('Notification stats error:', error);
            return reply.status(500).send({
                success: false,
                message: 'Internal server error',
                error: error.message,
            });
        }
    });
    // Public FCM status endpoint (no authentication required)
    fastify.get('/notifications/fcm-status', async (req, reply) => {
        try {
            const { admin } = await import('../config/firebase-admin.js');
            const { Customer, DeliveryPartner } = await import('../models/index.js');
            // Count users with FCM tokens
            const customerTokenCount = await Customer.countDocuments({ fcmToken: { $exists: true, $ne: null } });
            const deliveryPartnerTokenCount = await DeliveryPartner.countDocuments({ fcmToken: { $exists: true, $ne: null } });
            const status = {
                firebaseInitialized: admin.apps.length > 0,
                totalUsersWithTokens: customerTokenCount + deliveryPartnerTokenCount,
                customerTokens: customerTokenCount,
                deliveryPartnerTokens: deliveryPartnerTokenCount,
                timestamp: new Date().toISOString(),
                message: admin.apps.length > 0 ? 'FCM is ready and operational' : 'FCM is not initialized',
                endpoints: {
                    send: '/api/notifications/send',
                    broadcast: '/api/notifications/broadcast',
                    topic: '/api/notifications/topic',
                    test: '/api/notifications/test',
                    stats: '/api/notifications/stats',
                },
            };
            return reply.send({
                success: true,
                status,
            });
        }
        catch (error) {
            console.error('FCM status error:', error);
            return reply.status(500).send({
                success: false,
                message: 'Internal server error',
                error: error.message,
            });
        }
    });
}
