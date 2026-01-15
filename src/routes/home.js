import { getHome } from '../controllers/home/home.js';

export const homeRoutes = async (fastify) => {
  fastify.get('/home', getHome);
};

