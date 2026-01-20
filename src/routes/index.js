import { authRoutes } from './auth.js';
import { orderRoutes } from './order.js';
import { categoryRoutes, productRoutes } from './products.js';
import { usersRoutes } from './users.js';
import { sellerRoutes } from './seller.js';
import notificationRoutes from './notifications.js';
import adminOpsRoutes from '../api/routes/admin/ops.js';
import { adminFcmRoutes, apiFcmRoutes } from '../features/fcm-dashboard/routes.js';
import { searchRoutes } from './search.js';
import { customerNotificationRoutes } from './customerNotifications.js';
import { customerRoutes } from './customer.js';
import { homeRoutes } from './home.js';
import { couponRoutes } from './coupon.js';
import { walletRoutes } from './wallet.js';
const prefix = '/api';
export const registerRoutes = async (fastify) => {
    console.log('Registering routes with prefix:', prefix);
    try {
        console.log('Registering search routes...');
        await fastify.register(searchRoutes, { prefix }); // NOTE: using prefix here
        console.log('Search routes registered');

        console.log('Registering auth routes...');
        await fastify.register(authRoutes, { prefix: prefix });
        console.log('Auth routes registered');
        console.log('Registering product routes...');
        await fastify.register(productRoutes, { prefix: prefix });
        console.log('Product routes registered');
        console.log('Registering category routes...');
        await fastify.register(categoryRoutes, { prefix: prefix });
        console.log('Category routes registered');
        console.log('Registering order routes...');
        await fastify.register(orderRoutes, { prefix: prefix });
        console.log('Order routes registered');
        console.log('Registering users routes...');
        await fastify.register(usersRoutes, { prefix: prefix });
        console.log('Users routes registered');
        console.log('Registering seller routes...');
        await fastify.register(sellerRoutes, { prefix: prefix });
        console.log('Seller routes registered');
        console.log('Registering notification routes...');
        await fastify.register(notificationRoutes, { prefix: prefix });
        console.log('Notification routes registered');
        console.log('Registering customer notification routes...');
        await fastify.register(customerNotificationRoutes, { prefix: prefix });
        console.log('Customer notification routes registered');
        console.log('Registering customer routes...');
        await fastify.register(customerRoutes, { prefix: prefix });
        console.log('Customer routes registered');
        console.log('Registering home routes...');
        await fastify.register(homeRoutes, { prefix: prefix });
        console.log('Home routes registered');
        console.log('Registering admin routes...');
        await fastify.register(adminOpsRoutes, { prefix: '/admin' });
        console.log('Admin routes registered');

        console.log('Registering FCM dashboard routes...');
        await fastify.register(adminFcmRoutes, { prefix: '/admin' }); // /admin/fcm-management
        await fastify.register(apiFcmRoutes, { prefix: '/api/fcm' }); // /api/fcm/send-to-*
        console.log('FCM dashboard routes registered');

        console.log('Registering coupon routes...');
        await fastify.register(couponRoutes, { prefix: `${prefix}/coupons` }); // /api/coupons/*
        console.log('Coupon routes registered');

        console.log('Registering wallet routes...');
        await fastify.register(walletRoutes, { prefix: `${prefix}/wallet` }); // /api/wallet/*
        console.log('Wallet routes registered');

        console.log('All routes registered successfully');
    }
    catch (error) {
        console.error('Error registering routes:', error);
        throw error;
    }
};
