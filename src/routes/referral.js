import { verifyToken } from '../middleware/auth.js';
import referralService from '../services/referralService.js';

/**
 * Referral Routes
 * @param {FastifyInstance} fastify
 */
async function referralRoutes(fastify, options) {

    // Get my referral code and stats
    fastify.get('/my-code', {
        preHandler: [verifyToken],
        schema: {
            description: 'Get my referral code and stats',
            tags: ['Referral'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                code: { type: 'string' },
                                shareMessage: { type: 'string' },
                                stats: { type: 'object' }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const data = await referralService.getMyReferralCode(customerId);

            return { success: true, data };
        } catch (error) {
            console.error('Error getting referral code:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to get referral code'
            });
        }
    });

    // Apply a referral code
    fastify.post('/apply', {
        preHandler: [verifyToken],
        schema: {
            description: 'Apply a referral code',
            tags: ['Referral'],
            body: {
                type: 'object',
                required: ['code'],
                properties: {
                    code: { type: 'string', minLength: 4 }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const { code } = request.body;

            // Get metadata for abuse tracking
            const metadata = {
                ip: request.ip || request.headers['x-forwarded-for'],
                deviceId: request.headers['x-device-id'],
                source: request.headers['x-source'] || 'app_share'
            };

            const result = await referralService.applyReferralCode(customerId, code, metadata);

            if (!result.success) {
                return reply.status(400).send(result);
            }

            return { success: true, ...result };
        } catch (error) {
            console.error('Error applying referral code:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to apply referral code'
            });
        }
    });

    // Get referral history (as referrer)
    fastify.get('/history', {
        preHandler: [verifyToken],
        schema: {
            description: 'Get my referral history',
            tags: ['Referral'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'integer', default: 1 },
                    limit: { type: 'integer', default: 20 }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const { page = 1, limit = 20 } = request.query;

            const data = await referralService.getReferralHistory(customerId, page, limit);

            return { success: true, data };
        } catch (error) {
            console.error('Error getting referral history:', error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to get referral history'
            });
        }
    });

    // Get referral leaderboard
    fastify.get('/leaderboard', {
        schema: {
            description: 'Get top referrers',
            tags: ['Referral'],
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
            const leaderboard = await referralService.getLeaderboard(limit);

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

export default referralRoutes;
