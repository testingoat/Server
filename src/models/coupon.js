import mongoose from 'mongoose';
import Counter from './counter.js';

/**
 * Coupon Schema - Abuse-proof design
 * Supports: flat, percentage, free_delivery, bogo, cashback
 */
const couponSchema = new mongoose.Schema({
    // ============ IDENTITY ============
    code: {
        type: String,
        unique: true,
        uppercase: true,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 20,
        match: [/^[A-Z0-9]+$/, 'Code must be alphanumeric only']
    },
    couponId: {
        type: String,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 500
    },

    // ============ TYPE & VALUE ============
    type: {
        type: String,
        enum: ['flat', 'percentage', 'free_delivery', 'bogo', 'cashback'],
        required: true
    },
    value: {
        type: Number,
        required: true,
        min: 0,
        max: 100000  // Max ₹1 lakh or 100%
    },
    maxDiscount: {
        type: Number,
        min: 0,
        default: null  // null = no cap
    },

    // ============ CONDITIONS ============
    minOrderValue: {
        type: Number,
        default: 0,
        min: 0
    },
    maxUsagePerUser: {
        type: Number,
        default: 1,
        min: 1,
        max: 100
    },
    totalUsageLimit: {
        type: Number,
        min: 1,
        default: null  // null = unlimited
    },
    currentUsageCount: {
        type: Number,
        default: 0,
        min: 0
    },

    // ============ TARGETING ============
    applicableTo: {
        type: String,
        enum: ['all', 'new_users', 'specific_users', 'category', 'seller', 'product'],
        default: 'all'
    },
    // Category/Seller/Product IDs based on applicableTo
    targetCategories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    targetSellers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller'
    }],
    targetProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    // Specific users allowed to use
    allowedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    }],
    // Specific users blocked (abuse prevention)
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    }],

    // ============ TIME VALIDITY ============
    validFrom: {
        type: Date,
        required: true,
        default: Date.now
    },
    validUntil: {
        type: Date,
        required: true
    },

    // Time-slot based deals (lunch/dinner specials)
    timeSlots: [{
        startHour: { type: Number, min: 0, max: 23 },
        endHour: { type: Number, min: 0, max: 23 },
        days: [{ type: Number, min: 0, max: 6 }]  // 0=Sunday, 6=Saturday
    }],

    // ============ DISPLAY ============
    isVisible: {
        type: Boolean,
        default: true  // Show in coupon list
    },
    isHidden: {
        type: Boolean,
        default: false  // Secret coupon (manual entry only)
    },
    displayPriority: {
        type: Number,
        default: 0  // Higher = shown first
    },
    bannerImage: { type: String },
    terms: {
        type: String,
        maxlength: 1000  // Terms and conditions
    },

    // ============ STATUS & AUDIT ============
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: { type: String },
    lastModifiedBy: { type: String },

    // ============ ABUSE PREVENTION ============
    // Minimum gap between coupon uses by same user (in hours)
    cooldownHours: {
        type: Number,
        default: 0,
        min: 0
    },
    // Maximum discount per day per user
    maxDiscountPerDay: {
        type: Number,
        default: null  // null = no limit
    },
    // Require minimum order history before use
    minOrdersRequired: {
        type: Number,
        default: 0,
        min: 0
    }

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ============ INDEXES ============
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
couponSchema.index({ applicableTo: 1, isActive: 1 });

// ============ VIRTUALS ============
couponSchema.virtual('isExpired').get(function () {
    return new Date() > this.validUntil;
});

couponSchema.virtual('isNotYetValid').get(function () {
    return new Date() < this.validFrom;
});

couponSchema.virtual('usageRemaining').get(function () {
    if (!this.totalUsageLimit) return Infinity;
    return Math.max(0, this.totalUsageLimit - this.currentUsageCount);
});

couponSchema.virtual('discountDisplay').get(function () {
    switch (this.type) {
        case 'flat':
            return `₹${this.value} OFF`;
        case 'percentage':
            return this.maxDiscount
                ? `${this.value}% OFF (upto ₹${this.maxDiscount})`
                : `${this.value}% OFF`;
        case 'free_delivery':
            return 'FREE DELIVERY';
        case 'cashback':
            return this.maxDiscount
                ? `${this.value}% Cashback (upto ₹${this.maxDiscount})`
                : `${this.value}% Cashback`;
        case 'bogo':
            return 'Buy 1 Get 1 FREE';
        default:
            return `₹${this.value} OFF`;
    }
});

// ============ AUTO-GENERATE COUPON ID ============
async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findOneAndUpdate(
        { name: sequenceName },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    );
    return sequenceDocument.sequence_value;
}

couponSchema.pre('save', async function (next) {
    if (this.isNew && !this.couponId) {
        const sequenceValue = await getNextSequenceValue('couponId');
        this.couponId = `CPN${sequenceValue.toString().padStart(5, '0')}`;
    }

    // Validate percentage type
    if (this.type === 'percentage' && this.value > 100) {
        return next(new Error('Percentage discount cannot exceed 100%'));
    }

    // Validate validUntil > validFrom
    if (this.validUntil <= this.validFrom) {
        return next(new Error('validUntil must be after validFrom'));
    }

    next();
});

// ============ METHODS ============
couponSchema.methods.incrementUsage = async function () {
    this.currentUsageCount += 1;
    await this.save();
};

couponSchema.methods.isValidNow = function () {
    const now = new Date();
    return this.isActive &&
        now >= this.validFrom &&
        now <= this.validUntil &&
        (this.totalUsageLimit === null || this.currentUsageCount < this.totalUsageLimit);
};

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
