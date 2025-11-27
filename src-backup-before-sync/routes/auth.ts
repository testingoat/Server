import {
    fetchUser,
    loginCustomer,
    loginDeliveryPartner,
    refreshToken,
  } from '../controllers/auth/auth.js';
import { updateUser } from '../controllers/tracking/user.js';
import { verifyToken } from '../middleware/auth.js';
import { requestOTP, verifyOTP, testOTP } from '../controllers/auth/otp.js';
import { FastifyInstance } from 'fastify';

export const authRoutes = async (fastify: FastifyInstance, options: any) => {
    console.log('Registering auth routes');
    // Updated routes to match frontend expectations
    console.log('Registering /auth/customer/login');
    fastify.post('/auth/customer/login', loginCustomer);
    console.log('Registering /auth/delivery/login');
    fastify.post('/auth/delivery/login', loginDeliveryPartner);
    console.log('Registering /auth/refresh-token');
    fastify.post('/auth/refresh-token', refreshToken);
    console.log('Registering /user GET');
    fastify.get('/user', { preHandler: [verifyToken] }, fetchUser);
    console.log('Registering /user PATCH');
    fastify.patch('/user', { preHandler: [verifyToken] }, updateUser);

    // OTP routes (already correct)
    console.log('Registering /auth/otp/request');
    fastify.post('/auth/otp/request', requestOTP);
    console.log('Registering /auth/otp/verify');
    fastify.post('/auth/otp/verify', verifyOTP);

    // Test OTP route (development only)
    console.log('Registering /auth/otp/test');
    fastify.post('/auth/otp/test', testOTP);
    console.log('Auth routes registered successfully');
};
