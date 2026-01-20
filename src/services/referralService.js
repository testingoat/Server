import Referral from '../models/referral.js';
import { Customer, Order } from '../models/index.js';
import walletService from './walletService.js';
import crypto from 'crypto';

/**
 * ReferralService - Handles all referral program operations
 */
class ReferralService {

    /**
     * Generate a unique referral code for a customer
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<String>} The generated referral code
     */
    async generateReferralCode(customerId) {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            throw new Error('Customer not found');
        }

        // Check if customer already has a referral code
        if (customer.referral?.myCode) {
            return customer.referral.myCode;
        }

        // Generate code based on name + random suffix
        let code;
        let isUnique = false;
        let attempts = 0;

        while (!isUnique && attempts < 10) {
            const namePart = (customer.name || 'USER')
                .toUpperCase()
                .replace(/[^A-Z]/g, '')
                .substring(0, 4);
            const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
            code = `${namePart}${randomPart}`;

            // Check uniqueness
            const existing = await Customer.findOne({ 'referral.myCode': code });
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        // Fallback to pure random if name-based fails
        if (!isUnique) {
            code = crypto.randomBytes(4).toString('hex').toUpperCase();
        }

        // Save the code to customer
        customer.referral = {
            ...customer.referral,
            myCode: code,
            referralCount: customer.referral?.referralCount || 0,
            referralEarnings: customer.referral?.referralEarnings || 0
        };
        await customer.save();

        console.log(`🎫 Generated referral code ${code} for customer ${customerId}`);

        return code;
    }

    /**
     * Get a customer's referral code (generate if needed)
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<Object>} Referral code and stats
     */
    async getMyReferralCode(customerId) {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            throw new Error('Customer not found');
        }

        let code = customer.referral?.myCode;
        if (!code) {
            code = await this.generateReferralCode(customerId);
        }

        const stats = await Referral.getReferralStats(customerId);

        return {
            code,
            shareMessage: `Use my code ${code} to get ₹50 off on your first order! Download app: https://goatgoat.tech/app`,
            stats
        };
    }

    /**
     * Apply a referral code during signup or first order
     * @param {ObjectId} refereeId - The new user's customer ID
     * @param {String} code - The referral code
     * @param {Object} metadata - Additional tracking data (IP, deviceId)
     * @returns {Promise<Object>} Application result
     */
    async applyReferralCode(refereeId, code, metadata = {}) {
        const referee = await Customer.findById(refereeId);
        if (!referee) {
            return { success: false, error: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' };
        }

        // Check if referee was already referred
        if (referee.referral?.referredBy) {
            return { success: false, error: 'ALREADY_REFERRED', message: 'You have already used a referral code' };
        }

        // Check if referee already has orders (not a new user)
        const existingOrders = await Order.countDocuments({ customer: refereeId, status: 'delivered' });
        if (existingOrders > 0) {
            return { success: false, error: 'NOT_NEW_USER', message: 'Referral codes are only for new users' };
        }

        // Find referrer by code
        const referrer = await Customer.findOne({ 'referral.myCode': code.toUpperCase() });
        if (!referrer) {
            return { success: false, error: 'INVALID_CODE', message: 'Invalid referral code' };
        }

        // Prevent self-referral
        if (referrer._id.toString() === refereeId.toString()) {
            return { success: false, error: 'SELF_REFERRAL', message: 'You cannot use your own referral code' };
        }

        // Check for IP abuse
        if (metadata.ip) {
            const isAbuse = await Referral.checkIPAbuse(metadata.ip);
            if (isAbuse) {
                console.log(`⚠️ Potential referral abuse detected from IP: ${metadata.ip}`);
                return { success: false, error: 'ABUSE_DETECTED', message: 'Referral limit exceeded' };
            }
        }

        // Create referral record
        const referral = await Referral.create({
            referrer: referrer._id,
            referee: refereeId,
            referralCode: code.toUpperCase(),
            status: 'pending',
            referrerIP: metadata.referrerIP,
            refereeIP: metadata.ip,
            refereeDeviceId: metadata.deviceId,
            source: metadata.source || 'app_share'
        });

        // Update referee's customer record
        referee.referral = {
            ...referee.referral,
            referredBy: referrer._id
        };
        await referee.save();

        // Credit instant reward to referee (₹50)
        await walletService.credit(
            refereeId,
            referral.refereeReward,
            'referral',
            `Welcome bonus from referral code ${code}`,
            null,
            30 // 30 days expiry
        );

        // Mark referee as rewarded
        referral.refereeRewarded = true;
        referral.refereeRewardedAt = new Date();
        await referral.save();

        console.log(`✅ Referral applied: ${code} for new user ${refereeId}`);

        return {
            success: true,
            referralId: referral._id,
            refereeReward: referral.refereeReward,
            message: `₹${referral.refereeReward} added to your wallet!`
        };
    }

    /**
     * Complete a referral when referee places first order
     * @param {ObjectId} refereeId - The referee's customer ID
     * @param {ObjectId} orderId - The completing order ID
     * @returns {Promise<Object>} Completion result
     */
    async completeReferral(refereeId, orderId) {
        // Find active referral for this referee
        const referral = await Referral.findOne({
            referee: refereeId,
            status: { $in: ['pending', 'first_order_placed'] }
        });

        if (!referral) {
            return { success: false, message: 'No active referral found' };
        }

        // Mark as completed
        referral.status = 'completed';
        referral.completingOrder = orderId;

        // Credit reward to referrer
        if (!referral.referrerRewarded) {
            await walletService.credit(
                referral.referrer,
                referral.referrerReward,
                'referral',
                'Referral reward - Friend completed first order',
                orderId,
                30 // 30 days expiry
            );

            referral.referrerRewarded = true;
            referral.referrerRewardedAt = new Date();

            // Update referrer's stats
            await Customer.findByIdAndUpdate(referral.referrer, {
                $inc: {
                    'referral.referralCount': 1,
                    'referral.referralEarnings': referral.referrerReward
                }
            });
        }

        await referral.save();

        console.log(`🎉 Referral completed: Referrer ${referral.referrer} earned ₹${referral.referrerReward}`);

        return {
            success: true,
            referrerReward: referral.referrerReward,
            message: 'Referral completed successfully'
        };
    }

    /**
     * Get referral history for a customer (as referrer)
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} page - Page number
     * @param {Number} limit - Items per page
     * @returns {Promise<Object>} Referral history
     */
    async getReferralHistory(customerId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const [referrals, total] = await Promise.all([
            Referral.find({ referrer: customerId })
                .populate('referee', 'name phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Referral.countDocuments({ referrer: customerId })
        ]);

        return {
            referrals: referrals.map(r => ({
                id: r._id,
                refereeName: r.referee?.name || 'Unknown',
                refereePhone: r.referee?.phone ? `${r.referee.phone.substring(0, 5)}***` : '',
                status: r.status,
                reward: r.referrerReward,
                rewarded: r.referrerRewarded,
                createdAt: r.createdAt
            })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Expire old pending referrals (scheduled job)
     * @returns {Promise<Object>} Expiry result
     */
    async expirePendingReferrals() {
        const now = new Date();

        const result = await Referral.updateMany(
            {
                status: 'pending',
                expiresAt: { $lte: now }
            },
            {
                $set: { status: 'expired' }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`⏰ Expired ${result.modifiedCount} pending referrals`);
        }

        return {
            expiredCount: result.modifiedCount
        };
    }

    /**
     * Get referral leaderboard
     * @param {Number} limit - Number of top referrers
     * @returns {Promise<Array>} Top referrers
     */
    async getLeaderboard(limit = 10) {
        const leaderboard = await Referral.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$referrer',
                    count: { $sum: 1 },
                    totalEarned: { $sum: '$referrerReward' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'customers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            { $unwind: '$customer' },
            {
                $project: {
                    name: '$customer.name',
                    referralCount: '$count',
                    totalEarned: 1
                }
            }
        ]);

        return leaderboard;
    }
}

// Singleton instance
const referralService = new ReferralService();

export { ReferralService, referralService };
export default referralService;
