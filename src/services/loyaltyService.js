import LoyaltyTier from '../models/loyaltyTier.js';
import walletService from './walletService.js';

/**
 * LoyaltyService - Handles loyalty program operations
 */
class LoyaltyService {

    /**
     * Get or create loyalty record for a customer
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<Object>} Loyalty record
     */
    async getLoyalty(customerId) {
        const loyalty = await LoyaltyTier.getOrCreate(customerId);

        return {
            tier: loyalty.tier,
            tierDisplay: loyalty.tierDisplay,
            ordersThisMonth: loyalty.ordersThisMonth,
            spentThisMonth: loyalty.spentThisMonth,
            totalOrders: loyalty.totalOrders,
            totalSpent: loyalty.totalSpent,
            points: loyalty.points,
            lifetimePoints: loyalty.lifetimePoints,
            benefits: loyalty.benefits,
            nextTierProgress: loyalty.nextTierProgress,
            tierExpiresAt: loyalty.tierExpiresAt
        };
    }

    /**
     * Record an order and update loyalty status
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} orderAmount - Order amount in rupees
     * @param {ObjectId} orderId - The order ID
     * @returns {Promise<Object>} Update result with tier changes
     */
    async recordOrder(customerId, orderAmount, orderId) {
        const loyalty = await LoyaltyTier.getOrCreate(customerId);
        const previousTier = loyalty.tier;

        // Add order and recalculate tier
        const { pointsEarned, newTier } = loyalty.addOrder(orderAmount);
        await loyalty.save();

        const tierUpgraded = previousTier !== newTier &&
            ['silver', 'gold', 'platinum'].indexOf(newTier) > ['silver', 'gold', 'platinum'].indexOf(previousTier);

        // If tier upgraded, award bonus
        if (tierUpgraded) {
            const tierBonuses = {
                silver: 50,
                gold: 100,
                platinum: 200
            };

            const bonus = tierBonuses[newTier] || 0;
            if (bonus > 0) {
                await walletService.credit(
                    customerId,
                    bonus,
                    'promo',
                    `Congratulations! You reached ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} tier!`,
                    orderId,
                    30
                );
            }

            console.log(`🎉 Customer ${customerId} upgraded to ${newTier} tier!`);
        }

        return {
            previousTier,
            currentTier: newTier,
            tierUpgraded,
            pointsEarned,
            totalPoints: loyalty.points,
            benefits: loyalty.benefits
        };
    }

    /**
     * Get customer's loyalty benefits for checkout
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<Object>} Benefits applicable to checkout
     */
    async getCheckoutBenefits(customerId) {
        const loyalty = await LoyaltyTier.getOrCreate(customerId);

        return {
            tier: loyalty.tier,
            freeDelivery: loyalty.benefits.freeDelivery,
            extraCashbackPercent: loyalty.benefits.extraCashbackPercent,
            message: this.getBenefitMessage(loyalty.tier)
        };
    }

    /**
     * Get benefit message for display
     * @param {String} tier - The tier name
     * @returns {String} Benefit message
     */
    getBenefitMessage(tier) {
        const messages = {
            bronze: null,
            silver: '🥈 You get 5% extra cashback!',
            gold: '🥇 Free delivery + 10% extra cashback!',
            platinum: '💎 Free delivery + 15% extra cashback + Priority support!'
        };
        return messages[tier];
    }

    /**
     * Calculate extra cashback for an order based on tier
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} orderAmount - Order amount
     * @returns {Promise<Object>} Extra cashback calculation
     */
    async calculateExtraCashback(customerId, orderAmount) {
        const loyalty = await LoyaltyTier.getOrCreate(customerId);
        const extraPercent = loyalty.benefits.extraCashbackPercent;

        if (extraPercent <= 0) {
            return { applicable: false, amount: 0 };
        }

        const extraCashback = Math.floor((orderAmount * extraPercent) / 100);

        return {
            applicable: true,
            percent: extraPercent,
            amount: extraCashback,
            tier: loyalty.tier
        };
    }

    /**
     * Get progress to next tier
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<Object>} Progress details
     */
    async getProgress(customerId) {
        const loyalty = await LoyaltyTier.getOrCreate(customerId);
        return loyalty.nextTierProgress;
    }

    /**
     * Get tier history for a customer
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<Array>} Tier history
     */
    async getTierHistory(customerId) {
        const loyalty = await LoyaltyTier.getOrCreate(customerId);
        return loyalty.tierHistory.sort((a, b) => new Date(b.achievedAt) - new Date(a.achievedAt));
    }

    /**
     * Redeem points for wallet balance
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} points - Points to redeem
     * @returns {Promise<Object>} Redemption result
     */
    async redeemPoints(customerId, points) {
        const loyalty = await LoyaltyTier.getOrCreate(customerId);

        if (points <= 0) {
            return { success: false, error: 'Invalid points amount' };
        }

        if (loyalty.points < points) {
            return {
                success: false,
                error: 'INSUFFICIENT_POINTS',
                message: `You only have ${loyalty.points} points available`
            };
        }

        // Minimum redemption: 100 points
        if (points < 100) {
            return {
                success: false,
                error: 'MIN_POINTS',
                message: 'Minimum 100 points required for redemption'
            };
        }

        // Conversion: 100 points = ₹10
        const rupees = Math.floor(points / 10);

        // Deduct points
        loyalty.points -= points;
        await loyalty.save();

        // Credit to wallet
        await walletService.credit(
            customerId,
            rupees,
            'promo',
            `Redeemed ${points} points`,
            null,
            30
        );

        console.log(`🎯 Customer ${customerId} redeemed ${points} points for ₹${rupees}`);

        return {
            success: true,
            pointsRedeemed: points,
            rupeesCredited: rupees,
            remainingPoints: loyalty.points
        };
    }

    /**
     * Get tier leaderboard
     * @param {Number} limit - Number of top users
     * @returns {Promise<Array>} Leaderboard
     */
    async getLeaderboard(limit = 10) {
        const leaderboard = await LoyaltyTier.find({ tier: { $ne: 'bronze' } })
            .sort({ lifetimePoints: -1 })
            .limit(limit)
            .populate('customer', 'name')
            .lean();

        return leaderboard.map((l, index) => ({
            rank: index + 1,
            name: l.customer?.name || 'Anonymous',
            tier: l.tier,
            lifetimePoints: l.lifetimePoints,
            totalOrders: l.totalOrders
        }));
    }

    /**
     * Reset monthly stats for all customers (scheduled job)
     * @returns {Promise<Number>} Count of reset records
     */
    async monthlyReset() {
        return LoyaltyTier.resetMonthlyStats();
    }

    /**
     * Get tier distribution analytics
     * @returns {Promise<Object>} Distribution stats
     */
    async getTierAnalytics() {
        const distribution = await LoyaltyTier.getTierDistribution();

        return {
            distribution,
            config: LoyaltyTier.TIER_CONFIG
        };
    }
}

// Singleton instance
const loyaltyService = new LoyaltyService();

export { LoyaltyService, loyaltyService };
export default loyaltyService;
