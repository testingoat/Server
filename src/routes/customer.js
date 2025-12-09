import { verifyToken } from '../middleware/auth.js';
import { createAddress, deleteAddress, listAddresses, setDefaultAddress, updateAddress } from '../controllers/customer/address.js';
export const customerRoutes = async (fastify) => {
    fastify.addHook('preHandler', async (request, reply) => {
        const isAuthenticated = await verifyToken(request, reply);
        if (!isAuthenticated) {
            return reply.code(401).send({ message: 'Unauthorized' });
        }
    });
    fastify.get('/customer/addresses', listAddresses);
    fastify.post('/customer/addresses', createAddress);
    fastify.put('/customer/addresses/:addressId', updateAddress);
    fastify.delete('/customer/addresses/:addressId', deleteAddress);
    fastify.post('/customer/addresses/:addressId/default', setDefaultAddress);
};
export default customerRoutes;
