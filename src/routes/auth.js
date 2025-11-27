import { fetchUser, loginCustomer, loginDeliveryPartner, refreshToken, } from '../controllers/auth/auth.js';
import { updateUser } from '../controllers/tracking/user.js';
import { verifyToken } from '../middleware/auth.js';
import { requestOTP, verifyOTP, testOTP } from '../controllers/auth/otp.js';
import { requestDeliveryOtp, verifyDeliveryOtp, registerDeliveryPartner } from '../controllers/auth/deliveryOtp.js';
import { getDeliveryPartnerStats } from '../controllers/deliveryPartner/stats.js';

export const authRoutes = async (fastify, options) => {
    console.log('Registering auth routes');

    // Customer authentication
    console.log('Registering /auth/customer/login');
    fastify.post('/auth/customer/login', loginCustomer);

    // Delivery Partner authentication
    console.log('Registering /auth/delivery/login');
    fastify.post('/auth/delivery/login', loginDeliveryPartner);

    // NEW: Delivery Partner OTP authentication
    console.log('Registering /auth/delivery/otp/request');
    fastify.post('/auth/delivery/otp/request', requestDeliveryOtp);
    console.log('Registering /auth/delivery/otp/verify');
    fastify.post('/auth/delivery/otp/verify', verifyDeliveryOtp);

    // Delivery Partner Registration
    console.log('Registering /delivery/register');
    fastify.post('/delivery/register', registerDeliveryPartner);

    // Common authentication
    console.log('Registering /auth/refresh-token');
    fastify.post('/auth/refresh-token', refreshToken);

    // User profile
    console.log('Registering /user GET');
    fastify.get('/user', { preHandler: [verifyToken] }, fetchUser);
    console.log('Registering /user PATCH');
    fastify.patch('/user', { preHandler: [verifyToken] }, updateUser);

    // Customer OTP routes (existing)
    console.log('Registering /auth/otp/request');
    fastify.post('/auth/otp/request', requestOTP);
    console.log('Registering /auth/otp/verify');
    fastify.post('/auth/otp/verify', verifyOTP);

    // Test OTP route (development only)
    console.log('Registering /auth/otp/test');
    fastify.post('/auth/otp/test', testOTP);

    // Delivery Partner Stats
    console.log('Registering /delivery-partner/stats');
    fastify.get('/delivery-partner/stats', { preHandler: [verifyToken] }, getDeliveryPartnerStats);

    console.log('Auth routes registered successfully');
};

