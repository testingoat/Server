import { verifyToken } from '../middleware/auth.js';
import { getSellerNotifications, markNotificationAsRead, deleteNotification, markAllNotificationsAsRead } from '../controllers/seller/sellerNotifications.js';

export const sellerNotificationsRoutes = async (fastify) => {
  console.log('Registering seller notification routes (separate module)');
  // Get all notifications for authenticated seller
  fastify.get('/seller/notifications', { preHandler: [verifyToken] }, getSellerNotifications);
  // Mark specific notification as read
  fastify.put('/seller/notifications/:id/read', { preHandler: [verifyToken] }, markNotificationAsRead);
  // Delete specific notification
  fastify.delete('/seller/notifications/:id', { preHandler: [verifyToken] }, deleteNotification);
  // Mark all notifications as read
  fastify.put('/seller/notifications/mark-all-read', { preHandler: [verifyToken] }, markAllNotificationsAsRead);
};
