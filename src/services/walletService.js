import { Wallet } from '../models/index.js';

/**
 * WalletService - Handles all wallet operations
 * Provides methods for checkout integration, credits, debits, and balance management
 */
class WalletService {
    /**
     * Get or create a wallet for a customer
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<Object>} The wallet document
     */
    async getOrCreateWallet(customerId) {
        let wallet = await Wallet.findOne({ customer: customerId });

        if (!wallet) {
            wallet = await Wallet.create({
                customer: customerId,
                balance: 0,
                expiringBalance: 0,
                totalEarned: 0,
                totalSpent: 0,
                transactions: []
            });
        }

        return wallet;
    }

    /**
     * Get wallet balance for a customer
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<Object>} Balance summary
     */
    async getBalance(customerId) {
        const wallet = await this.getOrCreateWallet(customerId);

        // Calculate available balance (excluding frozen wallets)
        if (wallet.isFrozen) {
            return {
                balance: 0,
                availableBalance: 0,
                expiringBalance: 0,
                totalEarned: wallet.totalEarned,
                totalSpent: wallet.totalSpent,
                isFrozen: true,
                frozenReason: wallet.frozenReason
            };
        }

        return {
            balance: wallet.balance,
            availableBalance: wallet.balance,
            expiringBalance: wallet.expiringBalance,
            totalEarned: wallet.totalEarned,
            totalSpent: wallet.totalSpent,
            isFrozen: false
        };
    }

    /**
     * Credit amount to wallet
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} amount - Amount to credit
     * @param {String} source - Source of credit (cashback, referral, refund, promo, admin_credit)
     * @param {String} description - Description of the transaction
     * @param {ObjectId} orderId - Optional order ID for reference
     * @param {Number} expiryDays - Days until credit expires (default: 30 for cashback)
     * @returns {Promise<Object>} Updated wallet
     */
    async credit(customerId, amount, source, description, orderId = null, expiryDays = 30) {
        if (amount <= 0) {
            throw new Error('Credit amount must be positive');
        }

        const wallet = await this.getOrCreateWallet(customerId);

        // Calculate expiry date for cashback/promo credits
        const expiresAt = ['cashback', 'referral', 'promo'].includes(source)
            ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
            : null;

        // Add transaction
        wallet.transactions.push({
            type: 'credit',
            amount,
            source,
            description,
            orderId,
            expiresAt,
            createdAt: new Date()
        });

        // Update balances
        wallet.balance += amount;
        wallet.totalEarned += amount;

        if (expiresAt) {
            wallet.expiringBalance += amount;
        }

        await wallet.save();

        console.log(`💰 Wallet credited: ₹${amount} to customer ${customerId} for ${source}`);

        return {
            success: true,
            newBalance: wallet.balance,
            credited: amount,
            expiresAt
        };
    }

    /**
     * Debit amount from wallet (for order payment)
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} amount - Amount to debit
     * @param {ObjectId} orderId - Order ID for reference
     * @param {String} description - Description of the transaction
     * @returns {Promise<Object>} Debit result
     */
    async debit(customerId, amount, orderId, description = 'Order payment') {
        if (amount <= 0) {
            throw new Error('Debit amount must be positive');
        }

        const wallet = await this.getOrCreateWallet(customerId);

        // Check if wallet is frozen
        if (wallet.isFrozen) {
            return {
                success: false,
                error: 'WALLET_FROZEN',
                message: 'Your wallet is frozen. Please contact support.'
            };
        }

        // Check sufficient balance
        if (wallet.balance < amount) {
            return {
                success: false,
                error: 'INSUFFICIENT_BALANCE',
                message: `Insufficient wallet balance. Available: ₹${wallet.balance}`
            };
        }

        // Add debit transaction
        wallet.transactions.push({
            type: 'debit',
            amount,
            source: 'order_payment',
            description,
            orderId,
            createdAt: new Date()
        });

        // Update balances
        wallet.balance -= amount;
        wallet.totalSpent += amount;

        // Reduce expiring balance proportionally
        if (wallet.expiringBalance > 0) {
            const expiringReduction = Math.min(amount, wallet.expiringBalance);
            wallet.expiringBalance -= expiringReduction;
        }

        await wallet.save();

        console.log(`💳 Wallet debited: ₹${amount} from customer ${customerId} for order ${orderId}`);

        return {
            success: true,
            deducted: amount,
            newBalance: wallet.balance
        };
    }

    /**
     * Validate if wallet can be used for a given amount
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} amount - Amount to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateForCheckout(customerId, amount) {
        const wallet = await this.getOrCreateWallet(customerId);

        if (wallet.isFrozen) {
            return {
                canUse: false,
                error: 'WALLET_FROZEN',
                message: 'Your wallet is frozen'
            };
        }

        if (wallet.balance <= 0) {
            return {
                canUse: false,
                error: 'NO_BALANCE',
                message: 'No wallet balance available'
            };
        }

        const usableAmount = Math.min(wallet.balance, amount);

        return {
            canUse: true,
            availableBalance: wallet.balance,
            usableAmount,
            remainingToPay: amount - usableAmount
        };
    }

    /**
     * Process refund to wallet (for cancelled orders)
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} amount - Amount to refund
     * @param {ObjectId} orderId - Original order ID
     * @param {String} reason - Refund reason
     * @returns {Promise<Object>} Refund result
     */
    async processRefund(customerId, amount, orderId, reason = 'Order cancelled') {
        return this.credit(
            customerId,
            amount,
            'refund',
            `Refund: ${reason}`,
            orderId,
            0 // Refunds don't expire
        );
    }

    /**
     * Credit cashback after order completion
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} amount - Cashback amount
     * @param {ObjectId} orderId - Order ID
     * @param {Number} expiryDays - Days until cashback expires
     * @returns {Promise<Object>} Credit result
     */
    async creditCashback(customerId, amount, orderId, expiryDays = 30) {
        return this.credit(
            customerId,
            amount,
            'cashback',
            'Cashback credited',
            orderId,
            expiryDays
        );
    }

    /**
     * Credit referral reward
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} amount - Reward amount
     * @param {String} refereePhone - Phone of the referred user
     * @param {Number} expiryDays - Days until reward expires
     * @returns {Promise<Object>} Credit result
     */
    async creditReferralReward(customerId, amount, refereePhone, expiryDays = 30) {
        return this.credit(
            customerId,
            amount,
            'referral',
            `Referral reward for inviting ${refereePhone}`,
            null,
            expiryDays
        );
    }

    /**
     * Get transaction history for a customer
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} page - Page number
     * @param {Number} limit - Items per page
     * @returns {Promise<Object>} Transaction history
     */
    async getTransactionHistory(customerId, page = 1, limit = 20) {
        const wallet = await this.getOrCreateWallet(customerId);

        // Sort transactions by date descending
        const sortedTransactions = wallet.transactions
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const total = sortedTransactions.length;
        const startIndex = (page - 1) * limit;
        const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + limit);

        return {
            transactions: paginatedTransactions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get credits expiring soon
     * @param {ObjectId} customerId - The customer ID
     * @param {Number} days - Days to look ahead
     * @returns {Promise<Object>} Expiring credits summary
     */
    async getExpiringCredits(customerId, days = 7) {
        const wallet = await this.getOrCreateWallet(customerId);

        const expiryThreshold = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

        const expiringTransactions = wallet.transactions.filter(t =>
            t.type === 'credit' &&
            t.expiresAt &&
            new Date(t.expiresAt) <= expiryThreshold &&
            new Date(t.expiresAt) > new Date()
        );

        const totalExpiring = expiringTransactions.reduce((sum, t) => sum + t.amount, 0);

        return {
            expiringWithinDays: days,
            totalExpiring,
            transactions: expiringTransactions
        };
    }

    /**
     * Process expired credits (should be run as a scheduled job)
     * @returns {Promise<Object>} Processing result
     */
    async processExpiredCredits() {
        const now = new Date();

        const walletsWithExpiring = await Wallet.find({
            'transactions.expiresAt': { $lte: now },
            'transactions.type': 'credit'
        });

        let processedCount = 0;
        let totalExpired = 0;

        for (const wallet of walletsWithExpiring) {
            let expiredAmount = 0;

            for (const transaction of wallet.transactions) {
                if (
                    transaction.type === 'credit' &&
                    transaction.expiresAt &&
                    new Date(transaction.expiresAt) <= now &&
                    transaction.source !== 'expired' // Not already processed
                ) {
                    expiredAmount += transaction.amount;
                }
            }

            if (expiredAmount > 0 && expiredAmount <= wallet.balance) {
                // Add expiry transaction
                wallet.transactions.push({
                    type: 'debit',
                    amount: expiredAmount,
                    source: 'expired',
                    description: 'Credits expired',
                    createdAt: now
                });

                wallet.balance -= expiredAmount;
                wallet.expiringBalance = Math.max(0, wallet.expiringBalance - expiredAmount);

                await wallet.save();

                processedCount++;
                totalExpired += expiredAmount;
            }
        }

        console.log(`⏰ Processed expired credits: ${processedCount} wallets, ₹${totalExpired} expired`);

        return {
            processedWallets: processedCount,
            totalExpiredAmount: totalExpired
        };
    }

    /**
     * Freeze a wallet (for fraud prevention)
     * @param {ObjectId} customerId - The customer ID
     * @param {String} reason - Reason for freezing
     * @returns {Promise<Object>} Freeze result
     */
    async freezeWallet(customerId, reason) {
        const wallet = await this.getOrCreateWallet(customerId);

        wallet.isFrozen = true;
        wallet.frozenReason = reason;
        wallet.frozenAt = new Date();

        await wallet.save();

        console.log(`🔒 Wallet frozen for customer ${customerId}: ${reason}`);

        return {
            success: true,
            frozen: true,
            reason
        };
    }

    /**
     * Unfreeze a wallet
     * @param {ObjectId} customerId - The customer ID
     * @returns {Promise<Object>} Unfreeze result
     */
    async unfreezeWallet(customerId) {
        const wallet = await this.getOrCreateWallet(customerId);

        wallet.isFrozen = false;
        wallet.frozenReason = null;
        wallet.frozenAt = null;

        await wallet.save();

        console.log(`🔓 Wallet unfrozen for customer ${customerId}`);

        return {
            success: true,
            frozen: false
        };
    }
}

// Singleton instance
const walletService = new WalletService();

export { WalletService, walletService };
export default walletService;
