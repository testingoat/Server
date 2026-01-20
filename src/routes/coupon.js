import couponService from '../services/couponService.js';
import Coupon from '../models/coupon.js';
import { verifyToken } from '../middleware/auth.js';

/**
 * Coupon Routes - All coupon-related API endpoints
 */
export const couponRoutes = async (fastify, options) => {

    // ============ PUBLIC ROUTES ============

    /**
     * GET /coupons/available
     * Get available coupons for authenticated user
     */
    fastify.get('/available', {
        preHandler: [verifyToken],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    cartTotal: { type: 'number', minimum: 0 }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const cartTotal = parseFloat(request.query.cartTotal) || 0;

            const coupons = await couponService.getAvailableCoupons(customerId, cartTotal);

            return reply.send({
                success: true,
                coupons,
                count: coupons.length
            });

        } catch (error) {
            console.error('[Coupon Routes] Error fetching available coupons:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch coupons'
            });
        }
    });

    /**
     * POST /coupons/validate
     * Validate a coupon code and preview discount
     */
    fastify.post('/validate', {
        preHandler: [verifyToken],
        schema: {
            body: {
                type: 'object',
                required: ['code', 'cartTotal', 'cartItems'],
                properties: {
                    code: { type: 'string', minLength: 1, maxLength: 20 },
                    cartTotal: { type: 'number', minimum: 0 },
                    cartItems: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['productId', 'price', 'count'],
                            properties: {
                                productId: { type: 'string' },
                                sellerId: { type: 'string' },
                                categoryId: { type: 'string' },
                                price: { type: 'number' },
                                count: { type: 'number' }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const { code, cartTotal, cartItems } = request.body;

            // Get customer IP for abuse detection
            const customerIP = request.ip ||
                request.headers['x-forwarded-for']?.split(',')[0] ||
                request.headers['x-real-ip'];

            const result = await couponService.validateCoupon(
                code,
                customerId,
                cartItems,
                cartTotal,
                {
                    customerIP,
                    deviceId: request.headers['x-device-id']
                }
            );

            if (!result.valid) {
                return reply.status(400).send({
                    success: false,
                    ...result
                });
            }

            return reply.send({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('[Coupon Routes] Validation error:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to validate coupon'
            });
        }
    });

    /**
     * GET /coupons/history
     * Get user's coupon usage history
     */
    fastify.get('/history', {
        preHandler: [verifyToken],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', minimum: 1, default: 1 },
                    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const { page, limit } = request.query;

            const history = await couponService.getUserCouponHistory(customerId, page, limit);

            return reply.send({
                success: true,
                ...history
            });

        } catch (error) {
            console.error('[Coupon Routes] Error fetching history:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch coupon history'
            });
        }
    });

    /**
     * GET /coupons/:code
     * Get details of a specific coupon
     */
    fastify.get('/:code', {
        preHandler: [verifyToken]
    }, async (request, reply) => {
        try {
            const coupon = await Coupon.findOne({
                code: request.params.code.toUpperCase(),
                isActive: true
            }).select('-blockedUsers -allowedUsers -currentUsageCount -totalUsageLimit');

            if (!coupon) {
                return reply.status(404).send({
                    success: false,
                    error: 'Coupon not found'
                });
            }

            return reply.send({
                success: true,
                coupon: {
                    code: coupon.code,
                    name: coupon.name,
                    description: coupon.description,
                    type: coupon.type,
                    displayDiscount: coupon.discountDisplay,
                    minOrderValue: coupon.minOrderValue,
                    validFrom: coupon.validFrom,
                    validUntil: coupon.validUntil,
                    terms: coupon.terms,
                    bannerImage: coupon.bannerImage
                }
            });

        } catch (error) {
            console.error('[Coupon Routes] Error fetching coupon:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch coupon details'
            });
        }
    });

    console.log('🎟️ Coupon routes registered');
};

export default couponRoutes;
