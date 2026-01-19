import { getAllCategories } from '../controllers/product/category.js';
import { getProductsByCategoryId } from '../controllers/product/product.js';
import { getProductById, getRelatedProducts } from '../controllers/product/productDetail.js';

export const categoryRoutes = async (fastify, options) => {
    fastify.get('/categories', getAllCategories);
};

export const productRoutes = async (fastify, options) => {
    fastify.get('/products/:categoryId', getProductsByCategoryId);
    fastify.get('/product/:productId', getProductById);
    fastify.get('/product/:productId/related', getRelatedProducts);
};

