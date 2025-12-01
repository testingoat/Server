import { verifyToken } from '../middleware/auth.js';
import {
    getCustomerNotifications,
    markCustomerNotificationRead,
    deleteCustomerNotification,
    clearCustomerNotifications,
    markAllCustomerNotificationsRead
} from '../controllers/customer/customerNotifications.js';

export const customerNotificationRoutes = async (fastify) => {
    fastify.get('/customers/notifications', { preHandler: [verifyToken] }, getCustomerNotifications);
    fastify.post('/customers/notifications/:notificationId/read', { preHandler: [verifyToken] }, markCustomerNotificationRead);
    fastify.delete('/customers/notifications/:notificationId', { preHandler: [verifyToken] }, deleteCustomerNotification);
    fastify.post('/customers/notifications/clear', { preHandler: [verifyToken] }, clearCustomerNotifications);
    fastify.post('/customers/notifications/mark-all-read', { preHandler: [verifyToken] }, markAllCustomerNotificationsRead);
};
