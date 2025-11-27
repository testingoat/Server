import OTPService from '../../services/otp.js';
import Fast2SMSService from '../../services/fast2sms.js';
import jwt from 'jsonwebtoken';
import { Customer } from '../../models/index.js';
/**
 * Request OTP for phone number
 * @param {Object} req - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<Object>} Response object
 */
export const requestOTP = async (req, reply) => {
    try {
        const { phone } = req.body;
        // Validate phone number
        if (!phone) {
            return reply.status(400).send({
                success: false,
                message: 'Phone number is required',
            });
        }
        // Check rate limiting
        const clientIP = req.ip || req.ips || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const rateLimit = await OTPService.isRateLimited(phone, clientIP, 'request');
        if (rateLimit.isLimited) {
            return reply.status(429).send({
                success: false,
                message: 'Too many OTP requests. Please try again later.',
            });
        }
        // If a previous backoff exists but window has passed, clear request attempts to allow resend UX
        try {
            await OTPService.resetRequestAttempts(phone, clientIP);
        }
        catch { }
        // Record OTP attempt (request context)
        await OTPService.recordOTPAttempt(phone, clientIP, 'request');
        // Generate OTP
        const otpLength = parseInt(process.env.OTP_LENGTH, 10) || 6;
        const otp = OTPService.generateOTP(otpLength);
        // Store OTP token
        const otpToken = await OTPService.storeOTPToken(phone, otp);
        // Send OTP via FAST2SMS (in production, this would be done asynchronously)
        const sendResult = await Fast2SMSService.sendConfiguredOTP(phone, otp);
        if (!sendResult.success) {
            console.error('Failed to send OTP via SMS:', sendResult.message);
            // Still return success but with warning message
            return reply.send({
                success: true,
                message: 'OTP generated successfully. Note: There might be a delay in receiving the SMS.',
                requestId: otpToken._id,
            });
        }
        // Return success response (don't include OTP in response for security)
        return reply.send({
            success: true,
            message: 'OTP sent successfully',
            requestId: otpToken._id,
        });
    }
    catch (error) {
        console.error('OTP Request Error:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to process OTP request',
        });
    }
};
/**
 * Verify OTP for phone number
 * @param {Object} req - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<Object>} Response object
 */
export const verifyOTP = async (req, reply) => {
    try {
        const { phone, otp } = req.body;
        // Validate input
        if (!phone || !otp) {
            return reply.status(400).send({
                success: false,
                message: 'Phone number and OTP are required',
            });
        }
        // Check rate limiting for verification attempts
        const clientIP = req.ip || req.ips || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const rateLimit = await OTPService.isRateLimited(phone, clientIP, 'verify');
        if (rateLimit.isLimited) {
            return reply.status(429).send({
                success: false,
                message: 'Too many verification attempts. Please try again later.',
            });
        }
        // Get valid OTP token
        const otpToken = await OTPService.getValidOTPToken(phone);
        if (!otpToken) {
            // Record failed attempt for rate limiting (verify context)
            await OTPService.recordOTPAttempt(phone, clientIP, 'verify');
            return reply.status(400).send({
                success: false,
                message: 'Invalid or expired OTP',
            });
        }
        // Verify OTP
        const isValid = await OTPService.verifyOTP(otp, otpToken.otpHash);
        if (!isValid) {
            // Record failed attempt for rate limiting (verify context)
            await OTPService.recordOTPAttempt(phone, clientIP, 'verify');
            return reply.status(400).send({
                success: false,
                message: 'Invalid OTP. Please check the code and try again.',
            });
        }
        // Consume OTP token
        // Reset verification attempts after success to prevent lockouts on next try
        await OTPService.resetVerifyAttempts(phone, clientIP);
        await OTPService.consumeOTPToken(otpToken._id);
        // Find or create customer by phone
        let customer = await Customer.findOne({ phone: Number(phone) });
        if (!customer) {
            customer = new Customer({ phone: Number(phone), role: 'Customer', isActivated: true });
            await customer.save();
        }
        // Issue JWT tokens to complete login
        const accessToken = jwt.sign({ userId: customer._id, role: 'Customer' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
        const refreshToken = jwt.sign({ userId: customer._id, role: 'Customer' }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
        return reply.send({
            success: true,
            message: 'OTP verified successfully',
            token: { accessToken, refreshToken },
            user: customer,
        });
    }
    catch (error) {
        console.error('OTP Verification Error:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to verify OTP',
        });
    }
};
/**
 * Test OTP endpoint (for development/testing only)
 * @param {Object} req - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Promise<Object>} Response object
 */
export const testOTP = async (req, reply) => {
    try {
        // This endpoint should be protected and only available in non-production environments
        if (process.env.NODE_ENV === 'production') {
            return reply.status(403).send({
                success: false,
                message: 'Test endpoint not available in production',
            });
        }
        const { phone } = req.body;
        if (!phone) {
            return reply.status(400).send({
                success: false,
                message: 'Phone number is required',
            });
        }
        // For testing, we'll just return a mock success
        return reply.send({
            success: true,
            message: 'Test OTP endpoint working',
            phone: phone,
        });
    }
    catch (error) {
        console.error('Test OTP Error:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to process test request',
        });
    }
};
