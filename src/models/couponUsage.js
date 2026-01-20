import mongoose from 'mongoose';

/**
 * CouponUsage Schema - Tracks every coupon use for analytics and abuse prevention
 */
const couponUsageSchema = new mongoose.Schema({
    // ============ REFERENCES ============
    coupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        required: true
    },
    couponCode: {
        type: String,
        required: true,
        uppercase: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },

    // ============ DISCOUNT DETAILS ============
    discountType: {
        type: String,
        enum: ['flat', 'percentage', 'free_delivery', 'bogo', 'cashback'],
        required: true
    },
    discountApplied: {
        type: Number,
        required: true,
        min: 0
    },
    orderTotal: {
        type: Number,
        required: true,
        min: 0
    },
    orderTotalAfterDiscount: {
        type: Number,
        required: true,
        min: 0
    },

    // ============ CASHBACK SPECIFIC ============
    cashbackAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    cashbackCredited: {
        type: Boolean,
        default: false
    },
    cashbackCreditedAt: {
        type: Date
    },

    // ============ ABUSE TRACKING ============
    customerIP: {
        type: String,
        maxlength: 45  // IPv6 max length
    },
    deviceId: {
        type: String
    },
    userAgent: {
        type: String
    },

    // ============ STATUS ============
    status: {
        type: String,
        enum: ['applied', 'completed', 'refunded', 'cancelled'],
        default: 'applied'
    },
    refundedAt: {
        type: Date
    },
    refundReason: {
        type: String
    },

    usedAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

// ============ INDEXES ============
// Fast lookup for user's coupon usage
couponUsageSchema.index({ coupon: 1, customer: 1 });
// Fast lookup for order's coupon
couponUsageSchema.index({ order: 1 });
// For analytics: usage by date
couponUsageSchema.index({ usedAt: -1 });
// For abuse detection: same IP using same coupon
couponUsageSchema.index({ coupon: 1, customerIP: 1 });
// For daily limit tracking
couponUsageSchema.index({ customer: 1, usedAt: 1 });

// ============ STATICS ============

/**
 * Get user's usage count for a specific coupon
 */
couponUsageSchema.statics.getUserUsageCount = async function (couponId, customerId) {
    return this.countDocuments({
        coupon: couponId,
        customer: customerId,
        status: { $ne: 'refunded' }  // Don't count refunded
    });
};

/**
 * Get user's total discount today (for daily limit check)
 */
couponUsageSchema.statics.getUserDailyDiscount = async function (customerId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await this.aggregate([
        {
            $match: {
                customer: customerId,
                usedAt: { $gte: startOfDay },
                status: { $ne: 'refunded' }
            }
        },
        {
            $group: {
                _id: null,
                totalDiscount: { $sum: '$discountApplied' }
            }
        }
    ]);

    return result[0]?.totalDiscount || 0;
};

/**
 * Get user's last usage time for a specific coupon (for cooldown check)
 */
couponUsageSchema.statics.getLastUsageTime = async function (couponId, customerId) {
    const lastUsage = await this.findOne({
        coupon: couponId,
        customer: customerId,
        status: { $ne: 'refunded' }
    }).sort({ usedAt: -1 });

    return lastUsage?.usedAt || null;
};

/**
 * Check if IP has suspicious usage patterns
 */
couponUsageSchema.statics.checkIPAbuse = async function (couponId, ip, threshold = 5) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const count = await this.countDocuments({
        coupon: couponId,
        customerIP: ip,
        usedAt: { $gte: oneDayAgo }
    });

    return count >= threshold;
};

/**
 * Get coupon analytics
 */
couponUsageSchema.statics.getCouponAnalytics = async function (couponId) {
    const result = await this.aggregate([
        { $match: { coupon: new mongoose.Types.ObjectId(couponId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalDiscount: { $sum: '$discountApplied' },
                avgDiscount: { $avg: '$discountApplied' }
            }
        }
    ]);

    return result;
};

const CouponUsage = mongoose.model('CouponUsage', couponUsageSchema);
export default CouponUsage;
