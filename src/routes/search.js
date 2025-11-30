import { searchSuggest } from '../controllers/search/searchSuggest.js';

export const searchRoutes = async (fastify, options) => {
    fastify.get('/search/v1/suggest', searchSuggest);
};
