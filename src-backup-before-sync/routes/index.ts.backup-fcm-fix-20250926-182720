import { authRoutes } from './auth.js';
import { orderRoutes } from './order.js';
import { categoryRoutes, productRoutes } from './products.js';
import { usersRoutes } from './users.js';
import adminOpsRoutes from '../api/routes/admin/ops.js';
import { FastifyInstance } from 'fastify';

const prefix = '/api';

export const registerRoutes = async (fastify: FastifyInstance) => {
  console.log('Registering routes with prefix:', prefix);
  try {
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

    console.log('Registering admin routes...');
    await fastify.register(adminOpsRoutes, { prefix: '/admin' });
    console.log('Admin routes registered');

    console.log('All routes registered successfully');
  } catch (error) {
    console.error('Error registering routes:', error);
    throw error;
  }
};
