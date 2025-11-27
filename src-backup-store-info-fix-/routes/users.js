import { verifyToken } from '../middleware/auth.js';
import { upsertFcmToken } from '../controllers/users/fcmToken.js';
export const usersRoutes = async (fastify, options) => {
    fastify.post('/users/fcm-token', { preHandler: [verifyToken] }, upsertFcmToken);
};
