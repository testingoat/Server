import Wallet from '../models/wallet.js';
import { verifyToken } from '../middleware/auth.js';

/**
 * Wallet Routes - All wallet-related API endpoints
 */
export const walletRoutes = async (fastify, options) => {

    /**
     * GET /wallet
     * Get user's wallet balance and summary
     */
    fastify.get('/', {
        preHandler: [verifyToken]
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const wallet = await Wallet.getOrCreate(customerId);

            return reply.send({
                success: true,
                wallet: {
                    balance: wallet.availableBalance,
                    expiringBalance: wallet.expiringBalance,
                    totalEarned: wallet.totalEarned,
                    totalSpent: wallet.totalSpent,
                    isFrozen: wallet.isFrozen
                }
            });

        } catch (error) {
            console.error('[Wallet Routes] Error fetching wallet:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch wallet'
            });
        }
    });

    /**
     * GET /wallet/transactions
     * Get wallet transaction history
     */
    fastify.get('/transactions', {
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

            const wallet = await Wallet.getOrCreate(customerId);
            const result = wallet.getTransactions(page, limit);

            return reply.send({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('[Wallet Routes] Error fetching transactions:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch transactions'
            });
        }
    });

    /**
     * GET /wallet/expiring
     * Get expiring credits summary
     */
    fastify.get('/expiring', {
        preHandler: [verifyToken]
    }, async (request, reply) => {
        try {
            const customerId = request.user.userId;
            const wallet = await Wallet.getOrCreate(customerId);

            // Get credits expiring in next 7 days
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

            const expiringCredits = wallet.transactions.filter(txn =>
                txn.type === 'credit' &&
                !txn.isExpired &&
                txn.expiresAt &&
                txn.expiresAt <= sevenDaysFromNow
            ).map(txn => ({
                amount: txn.amount,
                expiresAt: txn.expiresAt,
                source: txn.source,
                description: txn.description
            }));

            const totalExpiring = expiringCredits.reduce((sum, c) => sum + c.amount, 0);

            return reply.send({
                success: true,
                expiringCredits,
                totalExpiring
            });

        } catch (error) {
            console.error('[Wallet Routes] Error fetching expiring credits:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to fetch expiring credits'
            });
        }
    });

    console.log('💰 Wallet routes registered');
};

export default walletRoutes;
