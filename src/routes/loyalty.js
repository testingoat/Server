import { verifyToken } from '../middleware/auth.js';
import loyaltyService from '../services/loyaltyService.js';

/**
 * Loyalty Routes
 * @param {FastifyInstance} fastify
 */
async function loyaltyRoutes(fastify, options) {

    // Get my loyalty status
    fastify.get('/', {
        preHandler: [verifyToken],
        schema: {
            description: 'Get my loyalty tier and status',
            tags: ['Loyalty'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'object' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const data = await loyaltyService.getLoyalty(customerId);

            return { success: true, data };
        } catch (error) {
            console.error('Error getting loyalty status:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to get loyalty status'
            });
        }
    });

    // Get progress to next tier
    fastify.get('/progress', {
        preHandler: [verifyToken],
        schema: {
            description: 'Get progress to next loyalty tier',
            tags: ['Loyalty']
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const progress = await loyaltyService.getProgress(customerId);

            return { success: true, data: progress };
        } catch (error) {
            console.error('Error getting loyalty progress:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to get loyalty progress'
            });
        }
    });

    // Get tier benefits for checkout
    fastify.get('/benefits', {
        preHandler: [verifyToken],
        schema: {
            description: 'Get loyalty benefits applicable to checkout',
            tags: ['Loyalty']
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const benefits = await loyaltyService.getCheckoutBenefits(customerId);

            return { success: true, data: benefits };
        } catch (error) {
            console.error('Error getting loyalty benefits:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to get loyalty benefits'
            });
        }
    });

    // Get tier history
    fastify.get('/history', {
        preHandler: [verifyToken],
        schema: {
            description: 'Get tier upgrade history',
            tags: ['Loyalty']
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const history = await loyaltyService.getTierHistory(customerId);

            return { success: true, data: history };
        } catch (error) {
            console.error('Error getting tier history:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to get tier history'
            });
        }
    });

    // Redeem points for wallet balance
    fastify.post('/redeem', {
        preHandler: [verifyToken],
        schema: {
            description: 'Redeem loyalty points for wallet balance',
            tags: ['Loyalty'],
            body: {
                type: 'object',
                required: ['points'],
                properties: {
                    points: { type: 'integer', minimum: 100 }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const { points } = request.body;

            const result = await loyaltyService.redeemPoints(customerId, points);

            if (!result.success) {
                return reply.status(400).send(result);
            }

            return { success: true, data: result };
        } catch (error) {
            console.error('Error redeeming points:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to redeem points'
            });
        }
    });

    // Get leaderboard
    fastify.get('/leaderboard', {
        schema: {
            description: 'Get top loyal customers',
            tags: ['Loyalty'],
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'integer', default: 10 }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { limit = 10 } = request.query;
            const leaderboard = await loyaltyService.getLeaderboard(limit);

            return { success: true, data: leaderboard };
        } catch (error) {
            console.error('Error getting leaderboard:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to get leaderboard'
            });
        }
    });
}

export default loyaltyRoutes;
