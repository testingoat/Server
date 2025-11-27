import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OTPToken, OTPAttempt } from '../models/otp.js';
import Fast2SMSService from './fast2sms.js';
class OTPService {
    /**
     * Generate a random OTP
     * @param {number} length - Length of OTP to generate
     * @returns {string} Generated OTP
     */
    static generateOTP(length = 6) {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * 10)];
        }
        return otp;
    }
    /**
     * Hash OTP using bcrypt
     * @param {string} otp - OTP to hash
     * @returns {Promise<string>} Hashed OTP
     */
    static async hashOTP(otp) {
        const saltRounds = 10;
        return await bcrypt.hash(otp, saltRounds);
    }
    /**
     * Verify OTP against hashed version
     * @param {string} otp - OTP to verify
     * @param {string} hashedOTP - Hashed OTP to compare against
     * @returns {Promise<boolean>} Whether OTP is valid
     */
    static async verifyOTP(otp, hashedOTP) {
        return await bcrypt.compare(otp, hashedOTP);
    }
    /**
     * Store OTP token in database
     * @param {string} phone - Phone number
     * @param {string} otp - OTP to store
     * @param {string} requestId - Optional request ID from provider
     * @returns {Promise<Object>} Stored OTP token
     */
    static async storeOTPToken(phone, otp, requestId = null) {
        // Hash the OTP before storing
        const hashedOTP = await this.hashOTP(otp);
        // Calculate expiration time (5 minutes by default)
        const ttl = parseInt(process.env.OTP_TTL, 10) || 300;
        const expiresAt = new Date(Date.now() + ttl * 1000);
        // Create and save OTP token
        const otpToken = new OTPToken({
            phone,
            otpHash: hashedOTP,
            expiresAt,
            requestId,
        });
        return await otpToken.save();
    }
    /**
     * Get valid OTP token for phone number
     * @param {string} phone - Phone number
     * @returns {Promise<Object|null>} Valid OTP token or null
     */
    static async getValidOTPToken(phone) {
        const now = new Date();
        return await OTPToken.findOne({
            phone,
            expiresAt: { $gt: now },
            consumedAt: { $exists: false },
        }).sort({ createdAt: -1 });
    }
    /**
     * Mark OTP token as consumed
     * @param {string} tokenId - OTP token ID
     * @returns {Promise<Object>} Updated OTP token
     */
    static async consumeOTPToken(tokenId) {
        return await OTPToken.findByIdAndUpdate(tokenId, { consumedAt: new Date() }, { new: true });
    }
    /**
     * Parse rate limits safely with sensible defaults per context
     */
    static parseLimits(context) {
        try {
            const shared = process.env.OTP_RATE_LIMITS || '';
            const limitsEnv = context === 'request'
                ? (process.env.OTP_REQUEST_RATE_LIMITS || shared)
                : (process.env.OTP_VERIFY_RATE_LIMITS || shared);
            const parsed = limitsEnv ? JSON.parse(limitsEnv) : {};
            const defaults = context === 'request'
                ? { window: 300, maxRequests: 5 }
                : { window: 300, maxRequests: 3 };
            const windowSec = Number(parsed.window) > 0 ? Number(parsed.window) : defaults.window;
            // Enforce minimum thresholds to avoid over-restrictive envs
            const minMax = defaults.maxRequests;
            const candidate = Number(parsed.maxRequests);
            const maxReq = Number.isFinite(candidate) && candidate > 0 ? Math.max(candidate, minMax) : minMax;
            return { window: windowSec, maxRequests: maxReq };
        }
        catch (e) {
            // Fallback to safe defaults
            return context === 'request'
                ? { window: 300, maxRequests: 5 }
                : { window: 300, maxRequests: 3 };
        }
    }
    /**
     * Record OTP attempt for rate limiting
     * @param {string} phone - Phone number
     * @param {string} ip - IP address
     * @returns {Promise<Object>} OTP attempt record
     */
    static async recordOTPAttempt(phone, ip, context = 'verify') {
        const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
        const now = new Date();
        // Get rate limit configuration based on context (safe defaults)
        const rateLimits = this.parseLimits(context);
        // Find existing attempt record or create new one
        let attemptRecord = await OTPAttempt.findOne({
            phone,
            ipHash,
            context,
            lastAttemptAt: { $gt: new Date(now.getTime() - rateLimits.window * 1000) },
        });
        if (!attemptRecord) {
            attemptRecord = new OTPAttempt({
                phone,
                ipHash,
                context,
                attemptCount: 1,
                lastAttemptAt: now,
                windowStart: now,
            });
        }
        else {
            attemptRecord.attemptCount += 1;
            attemptRecord.lastAttemptAt = now;
        }
        return await attemptRecord.save();
    }
    /**
     * Check if phone number is rate limited
     * @param {string} phone - Phone number
     * @param {string} ip - IP address
     * @returns {Promise<{isLimited: boolean, blockedUntil?: Date}>} Rate limit status
     */
    static async isRateLimited(phone, ip, context = 'verify') {
        const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
        const now = new Date();
        // Get rate limit configuration based on context (safe defaults)
        const rateLimits = this.parseLimits(context);
        // Check for existing attempt record
        const attemptRecord = await OTPAttempt.findOne({
            phone,
            ipHash,
            context,
            lastAttemptAt: { $gt: new Date(now.getTime() - rateLimits.window * 1000) },
        });
        if (!attemptRecord) {
            return { isLimited: false };
        }
        // Check if blocked due to backoff
        if (attemptRecord.blockedUntil && attemptRecord.blockedUntil > now) {
            return { isLimited: true, blockedUntil: attemptRecord.blockedUntil };
        }
        // Check if rate limit exceeded
        if (attemptRecord.attemptCount >= rateLimits.maxRequests) {
            // Calculate backoff delay
            const backoffPolicy = JSON.parse(process.env.OTP_BACKOFF_POLICY || '{"baseDelay": 1000, "maxDelay": 300000, "multiplier": 2}');
            const delay = Math.min(backoffPolicy.baseDelay * Math.pow(backoffPolicy.multiplier, attemptRecord.attemptCount - rateLimits.maxRequests), backoffPolicy.maxDelay);
            const blockedUntil = new Date(now.getTime() + delay);
            // Update record with backoff
            await OTPAttempt.findByIdAndUpdate(attemptRecord._id, {
                blockedUntil,
            });
            return { isLimited: true, blockedUntil };
        }
        return { isLimited: false };
    }
    /**
     * Send OTP via FAST2SMS
     * @param {string} phone - Phone number
     * @param {string} otp - OTP to send
     * @returns {Promise<{success: boolean, message: string, requestId?: string}>} Send result
     */
    static async sendOTP(phone, otp) {
        return await Fast2SMSService.sendConfiguredOTP(phone, otp);
    }
    /**
     * Clear request attempts helper (admin/debug or after resend policy)
     */
    static async resetRequestAttempts(phone, ip) {
        const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
        await OTPAttempt.deleteMany({ phone, ipHash, context: 'request' });
    }
    /**
     * Reset verification attempts after success to prevent lockouts
     */
    static async resetVerifyAttempts(phone, ip) {
        const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
        await OTPAttempt.deleteMany({ phone, ipHash, context: 'verify' });
    }
    /**
     * Clean up expired OTP tokens
     * @returns {Promise<number>} Number of deleted tokens
     */
    static async cleanupExpiredTokens() {
        const result = await OTPToken.deleteMany({
            expiresAt: { $lt: new Date() },
        });
        return result.deletedCount;
    }
}
export default OTPService;
