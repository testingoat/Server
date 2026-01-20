import mongoose from 'mongoose';

/**
 * Referral Schema
 * Tracks referral relationships between users and rewards
 */
const referralSchema = new mongoose.Schema({
    // Referrer (the user who shared the code)
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true
    },

    // Referee (the new user who used the code)
    referee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        unique: true, // A user can only be referred once
        index: true
    },

    // Referral code used
    referralCode: {
        type: String,
        required: true,
        uppercase: true
    },

    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'first_order_placed', 'completed', 'expired', 'cancelled'],
        default: 'pending'
    },

    // Reward configuration
    referrerReward: {
        type: Number,
        default: 100 // ₹100 for referrer
    },
    refereeReward: {
        type: Number,
        default: 50 // ₹50 for referee
    },

    // Reward status
    referrerRewarded: {
        type: Boolean,
        default: false
    },
    refereeRewarded: {
        type: Boolean,
        default: false
    },
    referrerRewardedAt: Date,
    refereeRewardedAt: Date,

    // Order that completed the referral
    completingOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },

    // Expiry
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days to complete first order
    },

    // Source tracking
    source: {
        type: String,
        enum: ['app_share', 'link', 'manual', 'campaign'],
        default: 'app_share'
    },

    // Abuse prevention
    referrerIP: String,
    refereeIP: String,
    refereeDeviceId: String

}, { timestamps: true });

// Indexes for analytics
referralSchema.index({ status: 1, createdAt: -1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL for expired

// Virtual for checking if expired
referralSchema.virtual('isExpired').get(function () {
    return this.status === 'pending' && new Date() > this.expiresAt;
});

// Virtual for reward summary
referralSchema.virtual('rewardSummary').get(function () {
    return {
        referrerReward: this.referrerReward,
        refereeReward: this.refereeReward,
        totalReward: this.referrerReward + this.refereeReward,
        referrerPaid: this.referrerRewarded,
        refereePaid: this.refereeRewarded
    };
});

// Static methods for analytics
referralSchema.statics.getReferralStats = async function (referrerId) {
    const stats = await this.aggregate([
        { $match: { referrer: new mongoose.Types.ObjectId(referrerId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalReward: { $sum: { $cond: ['$referrerRewarded', '$referrerReward', 0] } }
            }
        }
    ]);

    const result = {
        pending: 0,
        completed: 0,
        expired: 0,
        totalEarned: 0
    };

    stats.forEach(s => {
        if (s._id === 'pending') result.pending = s.count;
        if (s._id === 'completed') {
            result.completed = s.count;
            result.totalEarned = s.totalReward;
        }
        if (s._id === 'expired') result.expired = s.count;
    });

    return result;
};

// Static method to check for IP abuse
referralSchema.statics.checkIPAbuse = async function (ip, threshold = 5) {
    const count = await this.countDocuments({
        $or: [{ referrerIP: ip }, { refereeIP: ip }],
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    return count >= threshold;
};

// Static method to find active referral for a referee
referralSchema.statics.findActiveReferral = async function (refereeId) {
    return this.findOne({
        referee: refereeId,
        status: { $in: ['pending', 'first_order_placed'] }
    }).populate('referrer', 'name phone');
};

// Ensure virtuals are included when converting to JSON
referralSchema.set('toJSON', { virtuals: true });
referralSchema.set('toObject', { virtuals: true });

const Referral = mongoose.model('Referral', referralSchema);

export default Referral;
