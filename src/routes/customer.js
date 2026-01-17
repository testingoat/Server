import { verifyToken } from '../middleware/auth.js';
import { createAddress, deleteAddress, listAddresses, setDefaultAddress, updateAddress } from '../controllers/customer/address.js';
import { addWishlistItem, getWishlist, removeWishlistItem } from '../controllers/customer/wishlist.js';
export const customerRoutes = async (fastify) => {
    fastify.addHook('preHandler', async (request, reply) => {
        const isAuthenticated = await verifyToken(request, reply);
        if (!isAuthenticated) {
            return reply.code(401).send({ message: 'Unauthorized' });
        }
        if (request.user?.role && request.user.role !== 'Customer') {
            return reply.code(403).send({ message: 'Forbidden' });
        }
    });
    fastify.get('/customer/addresses', listAddresses);
    fastify.post('/customer/addresses', createAddress);
    fastify.put('/customer/addresses/:addressId', updateAddress);
    fastify.delete('/customer/addresses/:addressId', deleteAddress);
    fastify.post('/customer/addresses/:addressId/default', setDefaultAddress);

    fastify.get('/customer/wishlist', getWishlist);
    fastify.post('/customer/wishlist', addWishlistItem);
    fastify.delete('/customer/wishlist/:productId', removeWishlistItem);
};
export default customerRoutes;
