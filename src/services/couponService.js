import Coupon from '../models/coupon.js';
import CouponUsage from '../models/couponUsage.js';
import Wallet from '../models/wallet.js';
import { Customer } from '../models/user.js';
import Order from '../models/order.js';

/**
 * CouponService - Abuse-proof coupon validation and application
 */
class CouponService {

    /**
     * Validate a coupon code for a customer
     * Returns validation result with discount preview
     */
    async validateCoupon(code, customerId, cartItems, cartTotal, options = {}) {
        try {
            const { customerIP, deviceId } = options;

            // 1. Find coupon by code
            const coupon = await Coupon.findOne({
                code: code.toUpperCase().trim(),
                isActive: true
            });

            if (!coupon) {
                return {
                    valid: false,
                    error: 'Invalid coupon code',
                    errorCode: 'INVALID_CODE'
                };
            }

            // 2. Check if customer is blocked
            if (coupon.blockedUsers?.includes(customerId)) {
                return {
                    valid: false,
                    error: 'You are not eligible for this coupon',
                    errorCode: 'USER_BLOCKED'
                };
            }

            // 3. Check validity period
            const now = new Date();
            if (now < coupon.validFrom) {
                return {
                    valid: false,
                    error: `Coupon valid from ${coupon.validFrom.toLocaleDateString()}`,
                    errorCode: 'NOT_YET_VALID'
                };
            }

            if (now > coupon.validUntil) {
                return {
                    valid: false,
                    error: 'Coupon has expired',
                    errorCode: 'EXPIRED'
                };
            }

            // 4. Check time slots (lunch/dinner deals)
            if (coupon.timeSlots && coupon.timeSlots.length > 0) {
                const isValidTimeSlot = this.checkTimeSlot(coupon.timeSlots);
                if (!isValidTimeSlot) {
                    return {
                        valid: false,
                        error: 'Coupon not valid at this time. Check valid hours.',
                        errorCode: 'INVALID_TIME_SLOT'
                    };
                }
            }

            // 5. Check minimum order value
            if (cartTotal < coupon.minOrderValue) {
                const amountNeeded = coupon.minOrderValue - cartTotal;
                return {
                    valid: false,
                    error: `Add ₹${amountNeeded.toFixed(0)} more to use this coupon`,
                    errorCode: 'MIN_ORDER_NOT_MET',
                    minOrderValue: coupon.minOrderValue,
                    amountNeeded
                };
            }

            // 6. Check total usage limit
            if (coupon.totalUsageLimit && coupon.currentUsageCount >= coupon.totalUsageLimit) {
                return {
                    valid: false,
                    error: 'Coupon limit exhausted',
                    errorCode: 'LIMIT_EXHAUSTED'
                };
            }

            // 7. Check user usage limit
            const userUsageCount = await CouponUsage.getUserUsageCount(coupon._id, customerId);
            if (userUsageCount >= coupon.maxUsagePerUser) {
                return {
                    valid: false,
                    error: 'You have already used this coupon',
                    errorCode: 'MAX_USAGE_REACHED',
                    usageCount: userUsageCount,
                    maxUsage: coupon.maxUsagePerUser
                };
            }

            // 8. Check cooldown period
            if (coupon.cooldownHours > 0) {
                const lastUsage = await CouponUsage.getLastUsageTime(coupon._id, customerId);
                if (lastUsage) {
                    const hoursSinceLastUse = (now - lastUsage) / (1000 * 60 * 60);
                    if (hoursSinceLastUse < coupon.cooldownHours) {
                        const hoursRemaining = Math.ceil(coupon.cooldownHours - hoursSinceLastUse);
                        return {
                            valid: false,
                            error: `Please wait ${hoursRemaining} hour(s) before using this coupon again`,
                            errorCode: 'COOLDOWN_ACTIVE',
                            hoursRemaining
                        };
                    }
                }
            }

            // 9. Check IP abuse (multiple accounts same IP)
            if (customerIP) {
                const isIPAbuse = await CouponUsage.checkIPAbuse(coupon._id, customerIP);
                if (isIPAbuse) {
                    console.log(`[ABUSE WARNING] IP ${customerIP} flagged for coupon ${coupon.code}`);
                    return {
                        valid: false,
                        error: 'Unable to apply coupon. Please try again later.',
                        errorCode: 'SUSPECTED_ABUSE'
                    };
                }
            }

            // 10. Check eligibility (new user, specific user)
            const eligibility = await this.checkEligibility(coupon, customerId);
            if (!eligibility.valid) {
                return eligibility;
            }

            // 11. Check applicability (category, seller, product targeting)
            const applicability = this.checkApplicability(coupon, cartItems);
            if (!applicability.valid) {
                return applicability;
            }

            // 12. Check daily discount limit
            if (coupon.maxDiscountPerDay) {
                const dailyDiscount = await CouponUsage.getUserDailyDiscount(customerId);
                if (dailyDiscount >= coupon.maxDiscountPerDay) {
                    return {
                        valid: false,
                        error: 'Daily discount limit reached. Try again tomorrow!',
                        errorCode: 'DAILY_LIMIT_REACHED'
                    };
                }
            }

            // 13. Calculate discount
            const discount = this.calculateDiscount(coupon, cartTotal, applicability.applicableAmount);
            const finalTotal = Math.max(0, cartTotal - discount);

            return {
                valid: true,
                coupon: {
                    _id: coupon._id,
                    code: coupon.code,
                    name: coupon.name,
                    description: coupon.description,
                    type: coupon.type,
                    displayDiscount: coupon.discountDisplay
                },
                discount,
                originalTotal: cartTotal,
                finalTotal,
                message: `You saved ₹${discount.toFixed(0)}!`,
                isCashback: coupon.type === 'cashback',
                cashbackAmount: coupon.type === 'cashback' ? discount : 0
            };

        } catch (error) {
            console.error('[CouponService] Validation error:', error);
            return {
                valid: false,
                error: 'Unable to validate coupon. Please try again.',
                errorCode: 'VALIDATION_ERROR'
            };
        }
    }

    /**
     * Check if current time falls within any valid time slot
     */
    checkTimeSlot(timeSlots) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 = Sunday

        for (const slot of timeSlots) {
            // Check if current day is in allowed days
            if (slot.days && slot.days.length > 0 && !slot.days.includes(currentDay)) {
                continue;
            }

            // Check if current hour is in range
            if (slot.startHour <= slot.endHour) {
                // Normal range (e.g., 9 to 17)
                if (currentHour >= slot.startHour && currentHour < slot.endHour) {
                    return true;
                }
            } else {
                // Overnight range (e.g., 22 to 6)
                if (currentHour >= slot.startHour || currentHour < slot.endHour) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check user eligibility based on coupon targeting
     */
    async checkEligibility(coupon, customerId) {
        switch (coupon.applicableTo) {
            case 'new_users':
                // Check if user has any completed orders
                const orderCount = await Order.countDocuments({
                    customer: customerId,
                    status: 'delivered'
                });
                if (orderCount > 0) {
                    return {
                        valid: false,
                        error: 'This coupon is for new users only',
                        errorCode: 'NEW_USERS_ONLY'
                    };
                }
                break;

            case 'specific_users':
                if (!coupon.allowedUsers?.includes(customerId)) {
                    return {
                        valid: false,
                        error: 'You are not eligible for this coupon',
                        errorCode: 'NOT_ELIGIBLE'
                    };
                }
                break;
        }

        // Check minimum orders required
        if (coupon.minOrdersRequired > 0) {
            const totalOrders = await Order.countDocuments({
                customer: customerId,
                status: 'delivered'
            });
            if (totalOrders < coupon.minOrdersRequired) {
                return {
                    valid: false,
                    error: `Complete ${coupon.minOrdersRequired} orders to unlock this coupon`,
                    errorCode: 'MIN_ORDERS_NOT_MET',
                    ordersRequired: coupon.minOrdersRequired,
                    currentOrders: totalOrders
                };
            }
        }

        return { valid: true };
    }

    /**
     * Check if coupon applies to cart items (category/seller/product targeting)
     */
    checkApplicability(coupon, cartItems) {
        // If coupon is for all, skip checks
        if (coupon.applicableTo === 'all' ||
            coupon.applicableTo === 'new_users' ||
            coupon.applicableTo === 'specific_users') {
            const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.count), 0);
            return { valid: true, applicableAmount: totalAmount };
        }

        let applicableAmount = 0;
        let applicableItems = [];

        for (const item of cartItems) {
            let isApplicable = false;

            switch (coupon.applicableTo) {
                case 'category':
                    if (coupon.targetCategories?.some(catId =>
                        catId.toString() === item.categoryId?.toString())) {
                        isApplicable = true;
                    }
                    break;

                case 'seller':
                    if (coupon.targetSellers?.some(sellerId =>
                        sellerId.toString() === item.sellerId?.toString())) {
                        isApplicable = true;
                    }
                    break;

                case 'product':
                    if (coupon.targetProducts?.some(productId =>
                        productId.toString() === item.productId?.toString())) {
                        isApplicable = true;
                    }
                    break;
            }

            if (isApplicable) {
                applicableAmount += item.price * item.count;
                applicableItems.push(item);
            }
        }

        if (applicableItems.length === 0) {
            return {
                valid: false,
                error: 'Coupon not applicable on items in your cart',
                errorCode: 'NOT_APPLICABLE'
            };
        }

        return {
            valid: true,
            applicableAmount,
            applicableItems
        };
    }

    /**
     * Calculate discount based on coupon type
     */
    calculateDiscount(coupon, cartTotal, applicableAmount = cartTotal) {
        let discount = 0;

        switch (coupon.type) {
            case 'flat':
                discount = Math.min(coupon.value, applicableAmount);
                break;

            case 'percentage':
                discount = (applicableAmount * coupon.value) / 100;
                // Apply max discount cap if set
                if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                    discount = coupon.maxDiscount;
                }
                break;

            case 'free_delivery':
                // This is handled separately in checkout
                discount = 0;
                break;

            case 'cashback':
                // Cashback is credited to wallet after order completion
                discount = (applicableAmount * coupon.value) / 100;
                if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                    discount = coupon.maxDiscount;
                }
                // Return 0 as immediate discount, cashback is post-order
                return 0;

            case 'bogo':
                // Buy One Get One - requires special handling in cart
                // Find the cheapest item and make it free
                discount = 0; // Handled in cart calculation
                break;
        }

        // Ensure discount doesn't exceed cart total
        return Math.min(discount, cartTotal);
    }

    /**
     * Apply coupon to order (record usage)
     */
    async applyCouponToOrder(couponCode, customerId, orderId, discountApplied, orderTotal, options = {}) {
        try {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
            if (!coupon) {
                throw new Error('Coupon not found');
            }

            // Create usage record
            const usage = new CouponUsage({
                coupon: coupon._id,
                couponCode: coupon.code,
                customer: customerId,
                order: orderId,
                discountType: coupon.type,
                discountApplied,
                orderTotal,
                orderTotalAfterDiscount: orderTotal - discountApplied,
                customerIP: options.customerIP,
                deviceId: options.deviceId,
                userAgent: options.userAgent,
                status: 'applied'
            });

            await usage.save();

            // Increment coupon usage count
            await coupon.incrementUsage();

            // If it's a cashback coupon, calculate and queue for crediting
            if (coupon.type === 'cashback') {
                const cashbackAmount = this.calculateDiscount(
                    { ...coupon.toObject(), type: 'percentage' },
                    orderTotal
                );
                usage.cashbackAmount = cashbackAmount;
                await usage.save();
            }

            console.log(`[CouponService] Coupon ${couponCode} applied to order ${orderId}`);

            return { success: true, usageId: usage._id };

        } catch (error) {
            console.error('[CouponService] Error applying coupon:', error);
            throw error;
        }
    }

    /**
     * Mark coupon usage as completed and credit cashback
     */
    async completeCouponUsage(orderId) {
        try {
            const usage = await CouponUsage.findOne({ order: orderId });
            if (!usage) return null;

            usage.status = 'completed';
            await usage.save();

            // Credit cashback to wallet if applicable
            if (usage.cashbackAmount > 0 && !usage.cashbackCredited) {
                const wallet = await Wallet.getOrCreate(usage.customer);

                // Cashback expires in 30 days
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);

                await wallet.credit(usage.cashbackAmount, 'cashback', {
                    orderId: usage.order,
                    couponId: usage.coupon,
                    description: `Cashback from ${usage.couponCode}`,
                    expiresAt
                });

                usage.cashbackCredited = true;
                usage.cashbackCreditedAt = new Date();
                await usage.save();

                console.log(`[CouponService] Cashback ₹${usage.cashbackAmount} credited for order ${orderId}`);
            }

            return usage;

        } catch (error) {
            console.error('[CouponService] Error completing coupon usage:', error);
            throw error;
        }
    }

    /**
     * Refund coupon usage (order cancelled/refunded)
     */
    async refundCouponUsage(orderId, reason) {
        try {
            const usage = await CouponUsage.findOne({ order: orderId });
            if (!usage || usage.status === 'refunded') return null;

            usage.status = 'refunded';
            usage.refundedAt = new Date();
            usage.refundReason = reason;
            await usage.save();

            // Decrement coupon usage count
            const coupon = await Coupon.findById(usage.coupon);
            if (coupon && coupon.currentUsageCount > 0) {
                coupon.currentUsageCount -= 1;
                await coupon.save();
            }

            // Deduct cashback if it was credited
            if (usage.cashbackCredited && usage.cashbackAmount > 0) {
                const wallet = await Wallet.findOne({ customer: usage.customer });
                if (wallet && wallet.balance >= usage.cashbackAmount) {
                    await wallet.debit(usage.cashbackAmount, 'refund', {
                        orderId: usage.order,
                        description: `Cashback reversed - order refund`
                    });
                }
            }

            console.log(`[CouponService] Coupon usage refunded for order ${orderId}`);

            return usage;

        } catch (error) {
            console.error('[CouponService] Error refunding coupon:', error);
            throw error;
        }
    }

    /**
     * Get available coupons for a customer
     */
    async getAvailableCoupons(customerId, cartTotal = 0) {
        try {
            const now = new Date();

            // Get all active, non-hidden coupons
            const coupons = await Coupon.find({
                isActive: true,
                isHidden: false,
                validFrom: { $lte: now },
                validUntil: { $gte: now },
                $or: [
                    { totalUsageLimit: null },
                    { $expr: { $lt: ['$currentUsageCount', '$totalUsageLimit'] } }
                ]
            }).sort({ displayPriority: -1, createdAt: -1 });

            // Filter coupons based on user eligibility
            const availableCoupons = [];

            for (const coupon of coupons) {
                // Check if user is blocked
                if (coupon.blockedUsers?.includes(customerId)) continue;

                // Check eligibility
                const eligibility = await this.checkEligibility(coupon, customerId);
                if (!eligibility.valid) continue;

                // Check usage count
                const usageCount = await CouponUsage.getUserUsageCount(coupon._id, customerId);
                if (usageCount >= coupon.maxUsagePerUser) continue;

                // Add coupon with applicable status
                const canApply = cartTotal >= coupon.minOrderValue;

                availableCoupons.push({
                    _id: coupon._id,
                    code: coupon.code,
                    name: coupon.name,
                    description: coupon.description,
                    type: coupon.type,
                    displayDiscount: coupon.discountDisplay,
                    minOrderValue: coupon.minOrderValue,
                    validUntil: coupon.validUntil,
                    terms: coupon.terms,
                    bannerImage: coupon.bannerImage,
                    canApply,
                    amountNeeded: canApply ? 0 : coupon.minOrderValue - cartTotal
                });
            }

            return availableCoupons;

        } catch (error) {
            console.error('[CouponService] Error getting available coupons:', error);
            throw error;
        }
    }

    /**
     * Get user's coupon usage history
     */
    async getUserCouponHistory(customerId, page = 1, limit = 20) {
        try {
            const skip = (page - 1) * limit;

            const usages = await CouponUsage.find({ customer: customerId })
                .populate('coupon', 'code name type')
                .populate('order', 'orderId totalPrice')
                .sort({ usedAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await CouponUsage.countDocuments({ customer: customerId });

            return {
                usages,
                total,
                page,
                totalPages: Math.ceil(total / limit)
            };

        } catch (error) {
            console.error('[CouponService] Error getting coupon history:', error);
            throw error;
        }
    }
}

// Export singleton instance
export default new CouponService();
