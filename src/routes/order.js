import { confirmOrder, createOrder, getOrderById, getOrders, quoteOrder, updateOrderStatus, } from '../controllers/order/order.js';
import { estimateEtaForLocation } from '../controllers/order/eta.js';
import { verifyToken } from '../middleware/auth.js';
export const orderRoutes = async (fastify, options) => {
    fastify.addHook('preHandler', async (request, reply) => {
        const isAuthenticated = await verifyToken(request, reply);
        if (!isAuthenticated) {
            return reply.code(401).send({ message: 'Unauthorized' });
        }
    });
    fastify.post('/order', createOrder);
    fastify.post('/order/quote', quoteOrder);
    fastify.get('/order', getOrders);
    fastify.patch('/order/:orderId/status', updateOrderStatus);
    fastify.post('/order/:orderId/confirm', confirmOrder);
    fastify.get('/order/:orderId', getOrderById);
    fastify.get('/delivery/estimate-for-location', estimateEtaForLocation);
};
