import mongoose from 'mongoose';

/**
 * Wallet Schema - For cashback, rewards, and credits with expiry
 */
const walletSchema = new mongoose.Schema({
    // ============ OWNER ============
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        unique: true
    },

    // ============ BALANCE ============
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    // Balance that can expire (cashback/promo)
    expiringBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    // Total earned lifetime (for analytics)
    totalEarned: {
        type: Number,
        default: 0,
        min: 0
    },
    // Total spent lifetime (for analytics)
    totalSpent: {
        type: Number,
        default: 0,
        min: 0
    },

    // ============ TRANSACTIONS ============
    transactions: [{
        transactionId: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        source: {
            type: String,
            enum: [
                'cashback',      // From cashback coupon
                'referral',      // From referral program
                'refund',        // Order refund
                'promo',         // Promotional credit
                'order_payment', // Used to pay for order
                'expired',       // Expired credit deduction
                'admin_credit',  // Admin manually added
                'admin_debit'    // Admin manually deducted
            ],
            required: true
        },
        description: {
            type: String,
            maxlength: 200
        },
        // Related entities
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        couponId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Coupon'
        },
        // Expiry for cashback credits
        expiresAt: {
            type: Date
        },
        isExpired: {
            type: Boolean,
            default: false
        },
        // Audit
        createdBy: {
            type: String  // 'system' or admin email
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    // ============ SETTINGS ============
    isActive: {
        type: Boolean,
        default: true
    },
    isFrozen: {
        type: Boolean,
        default: false  // Admin can freeze suspicious accounts
    },
    frozenReason: {
        type: String
    },
    frozenAt: {
        type: Date
    }

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// ============ INDEXES ============
walletSchema.index({ customer: 1 });
walletSchema.index({ 'transactions.expiresAt': 1, 'transactions.isExpired': 1 });

// ============ VIRTUALS ============
walletSchema.virtual('availableBalance').get(function () {
    if (this.isFrozen) return 0;
    return this.balance;
});

// ============ METHODS ============

/**
 * Add credit to wallet
 */
walletSchema.methods.credit = async function (amount, source, options = {}) {
    if (this.isFrozen) {
        throw new Error('Wallet is frozen');
    }

    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const transaction = {
        transactionId,
        type: 'credit',
        amount,
        source,
        description: options.description || `${source} credit`,
        orderId: options.orderId,
        couponId: options.couponId,
        expiresAt: options.expiresAt,
        createdBy: options.createdBy || 'system'
    };

    this.transactions.push(transaction);
    this.balance += amount;
    this.totalEarned += amount;

    if (options.expiresAt) {
        this.expiringBalance += amount;
    }

    await this.save();
    return transaction;
};

/**
 * Debit from wallet
 */
walletSchema.methods.debit = async function (amount, source, options = {}) {
    if (this.isFrozen) {
        throw new Error('Wallet is frozen');
    }

    if (this.balance < amount) {
        throw new Error('Insufficient wallet balance');
    }

    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const transaction = {
        transactionId,
        type: 'debit',
        amount,
        source,
        description: options.description || `${source} debit`,
        orderId: options.orderId,
        createdBy: options.createdBy || 'system'
    };

    this.transactions.push(transaction);
    this.balance -= amount;
    this.totalSpent += amount;

    await this.save();
    return transaction;
};

/**
 * Get transaction history with pagination
 */
walletSchema.methods.getTransactions = function (page = 1, limit = 20) {
    const startIndex = (page - 1) * limit;
    const transactions = this.transactions
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(startIndex, startIndex + limit);

    return {
        transactions,
        total: this.transactions.length,
        page,
        totalPages: Math.ceil(this.transactions.length / limit)
    };
};

// ============ STATICS ============

/**
 * Get or create wallet for customer
 */
walletSchema.statics.getOrCreate = async function (customerId) {
    let wallet = await this.findOne({ customer: customerId });

    if (!wallet) {
        wallet = new this({ customer: customerId });
        await wallet.save();
    }

    return wallet;
};

/**
 * Process expired credits (run daily via cron)
 */
walletSchema.statics.processExpiredCredits = async function () {
    const now = new Date();
    const walletsWithExpiring = await this.find({
        'transactions.expiresAt': { $lte: now },
        'transactions.isExpired': false,
        'transactions.type': 'credit'
    });

    for (const wallet of walletsWithExpiring) {
        let expiredAmount = 0;

        for (const txn of wallet.transactions) {
            if (txn.type === 'credit' &&
                txn.expiresAt &&
                txn.expiresAt <= now &&
                !txn.isExpired) {
                txn.isExpired = true;
                expiredAmount += txn.amount;
            }
        }

        if (expiredAmount > 0) {
            wallet.balance = Math.max(0, wallet.balance - expiredAmount);
            wallet.expiringBalance = Math.max(0, wallet.expiringBalance - expiredAmount);

            wallet.transactions.push({
                transactionId: `EXP${Date.now()}`,
                type: 'debit',
                amount: expiredAmount,
                source: 'expired',
                description: 'Expired credits removed',
                createdBy: 'system'
            });

            await wallet.save();
        }
    }
};

const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
