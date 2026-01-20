import mongoose from 'mongoose';

/**
 * LoyaltyTier Schema
 * Tracks customer loyalty levels and associated benefits
 */
const loyaltyTierSchema = new mongoose.Schema({
    // Customer reference
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        unique: true,
        required: true,
        index: true
    },

    // Current tier
    tier: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum'],
        default: 'bronze'
    },

    // Progress tracking
    ordersThisMonth: {
        type: Number,
        default: 0
    },
    spentThisMonth: {
        type: Number,
        default: 0
    },
    totalOrders: {
        type: Number,
        default: 0
    },
    totalSpent: {
        type: Number,
        default: 0
    },

    // Points system (optional gamification)
    points: {
        type: Number,
        default: 0
    },
    lifetimePoints: {
        type: Number,
        default: 0
    },

    // Tier benefits (calculated based on tier)
    benefits: {
        extraCashbackPercent: {
            type: Number,
            default: 0
        },
        freeDelivery: {
            type: Boolean,
            default: false
        },
        prioritySupport: {
            type: Boolean,
            default: false
        },
        exclusiveDeals: {
            type: Boolean,
            default: false
        }
    },

    // Tier validity
    tierAchievedAt: Date,
    tierExpiresAt: Date, // Usually end of next month

    // History
    previousTier: String,
    tierHistory: [{
        tier: String,
        achievedAt: Date,
        ordersAtTime: Number,
        spentAtTime: Number
    }],

    // Monthly reset tracking
    lastMonthlyReset: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

// Tier thresholds configuration
const TIER_CONFIG = {
    bronze: {
        minOrders: 0,
        minSpent: 0,
        extraCashback: 0,
        freeDelivery: false,
        prioritySupport: false,
        exclusiveDeals: false,
        pointsMultiplier: 1
    },
    silver: {
        minOrders: 6,
        minSpent: 1500,
        extraCashback: 5,
        freeDelivery: false,
        prioritySupport: false,
        exclusiveDeals: true,
        pointsMultiplier: 1.25
    },
    gold: {
        minOrders: 16,
        minSpent: 5000,
        extraCashback: 10,
        freeDelivery: true,
        prioritySupport: false,
        exclusiveDeals: true,
        pointsMultiplier: 1.5
    },
    platinum: {
        minOrders: 30,
        minSpent: 10000,
        extraCashback: 15,
        freeDelivery: true,
        prioritySupport: true,
        exclusiveDeals: true,
        pointsMultiplier: 2
    }
};

// Export tier config for use in services
loyaltyTierSchema.statics.TIER_CONFIG = TIER_CONFIG;

// Virtual for tier display name
loyaltyTierSchema.virtual('tierDisplay').get(function () {
    const displays = {
        bronze: '🥉 Bronze',
        silver: '🥈 Silver',
        gold: '🥇 Gold',
        platinum: '💎 Platinum'
    };
    return displays[this.tier] || 'Bronze';
});

// Virtual for progress to next tier
loyaltyTierSchema.virtual('nextTierProgress').get(function () {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tierOrder.indexOf(this.tier);

    if (currentIndex >= tierOrder.length - 1) {
        return { isMaxTier: true, message: 'You are at the highest tier!' };
    }

    const nextTier = tierOrder[currentIndex + 1];
    const nextConfig = TIER_CONFIG[nextTier];

    const ordersNeeded = Math.max(0, nextConfig.minOrders - this.ordersThisMonth);
    const spentNeeded = Math.max(0, nextConfig.minSpent - this.spentThisMonth);

    return {
        isMaxTier: false,
        nextTier,
        ordersNeeded,
        spentNeeded,
        ordersProgress: Math.min(100, (this.ordersThisMonth / nextConfig.minOrders) * 100),
        spentProgress: Math.min(100, (this.spentThisMonth / nextConfig.minSpent) * 100)
    };
});

// Method to calculate and update tier
loyaltyTierSchema.methods.recalculateTier = function () {
    let newTier = 'bronze';

    // Check tiers from highest to lowest
    if (this.ordersThisMonth >= TIER_CONFIG.platinum.minOrders ||
        this.spentThisMonth >= TIER_CONFIG.platinum.minSpent) {
        newTier = 'platinum';
    } else if (this.ordersThisMonth >= TIER_CONFIG.gold.minOrders ||
        this.spentThisMonth >= TIER_CONFIG.gold.minSpent) {
        newTier = 'gold';
    } else if (this.ordersThisMonth >= TIER_CONFIG.silver.minOrders ||
        this.spentThisMonth >= TIER_CONFIG.silver.minSpent) {
        newTier = 'silver';
    }

    // Update if tier changed
    if (newTier !== this.tier) {
        this.previousTier = this.tier;
        this.tier = newTier;
        this.tierAchievedAt = new Date();

        // Set tier expiry to end of next month
        const now = new Date();
        this.tierExpiresAt = new Date(now.getFullYear(), now.getMonth() + 2, 0);

        // Add to history
        this.tierHistory.push({
            tier: newTier,
            achievedAt: new Date(),
            ordersAtTime: this.ordersThisMonth,
            spentAtTime: this.spentThisMonth
        });
    }

    // Update benefits
    const config = TIER_CONFIG[this.tier];
    this.benefits = {
        extraCashbackPercent: config.extraCashback,
        freeDelivery: config.freeDelivery,
        prioritySupport: config.prioritySupport,
        exclusiveDeals: config.exclusiveDeals
    };

    return this;
};

// Method to add order
loyaltyTierSchema.methods.addOrder = function (orderAmount) {
    this.ordersThisMonth += 1;
    this.spentThisMonth += orderAmount;
    this.totalOrders += 1;
    this.totalSpent += orderAmount;

    // Add points (₹1 = 1 point * multiplier)
    const multiplier = TIER_CONFIG[this.tier].pointsMultiplier;
    const pointsEarned = Math.floor(orderAmount * multiplier);
    this.points += pointsEarned;
    this.lifetimePoints += pointsEarned;

    // Recalculate tier
    this.recalculateTier();

    return { pointsEarned, newTier: this.tier };
};

// Static method to reset monthly stats
loyaltyTierSchema.statics.resetMonthlyStats = async function () {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await this.updateMany(
        { lastMonthlyReset: { $lt: startOfMonth } },
        {
            $set: {
                ordersThisMonth: 0,
                spentThisMonth: 0,
                lastMonthlyReset: now
            }
        }
    );

    console.log(`📊 Reset monthly loyalty stats for ${result.modifiedCount} customers`);
    return result.modifiedCount;
};

// Static method to get or create loyalty record
loyaltyTierSchema.statics.getOrCreate = async function (customerId) {
    let loyalty = await this.findOne({ customer: customerId });

    if (!loyalty) {
        loyalty = await this.create({
            customer: customerId,
            tier: 'bronze',
            tierAchievedAt: new Date()
        });
    }

    return loyalty;
};

// Static method for tier distribution analytics
loyaltyTierSchema.statics.getTierDistribution = async function () {
    return this.aggregate([
        {
            $group: {
                _id: '$tier',
                count: { $sum: 1 },
                avgOrders: { $avg: '$totalOrders' },
                avgSpent: { $avg: '$totalSpent' }
            }
        },
        { $sort: { count: -1 } }
    ]);
};

// Ensure virtuals are included
loyaltyTierSchema.set('toJSON', { virtuals: true });
loyaltyTierSchema.set('toObject', { virtuals: true });

const LoyaltyTier = mongoose.model('LoyaltyTier', loyaltyTierSchema);

export default LoyaltyTier;
