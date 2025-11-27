import { Seller } from '../../models/user.js';
import jwt from 'jsonwebtoken';
import OTPService from '../../services/otp.js';
import Fast2SMSService from '../../services/fast2sms.js';
const generateTokens = (user) => {
    // Check if JWT secrets are loaded
    console.log('🔍 DEBUG - Seller JWT Environment Variables:');
    console.log('ACCESS_TOKEN_SECRET exists:', !!process.env.ACCESS_TOKEN_SECRET);
    console.log('REFRESH_TOKEN_SECRET exists:', !!process.env.REFRESH_TOKEN_SECRET);
    if (!process.env.ACCESS_TOKEN_SECRET) {
        console.error('❌ CRITICAL: ACCESS_TOKEN_SECRET is undefined!');
        throw new Error('ACCESS_TOKEN_SECRET environment variable is missing');
    }
    const accessToken = jwt.sign({ userId: user._id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
    const refreshToken = jwt.sign({ userId: user._id, role: user.role }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    return { accessToken, refreshToken };
};
/**
 * Send OTP to seller's phone for login
 * POST /api/seller/login
 */
export const loginSeller = async (req, reply) => {
    try {
        const { phone } = req.body;
        // Validate phone number
        if (!phone) {
            return reply.status(400).send({
                success: false,
                message: 'Phone number is required'
            });
        }
        // Normalize phone number (remove any non-digits and ensure it's a number)
        const normalizedPhone = phone.toString().replace(/\D/g, '');
        if (normalizedPhone.length < 10) {
            return reply.status(400).send({
                success: false,
                message: 'Please enter a valid phone number'
            });
        }
        // Check rate limiting
        const clientIP = req.ip || req.ips || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const rateLimit = await OTPService.isRateLimited(normalizedPhone, clientIP, 'request');
        if (rateLimit.isLimited) {
            return reply.status(429).send({
                success: false,
                message: 'Too many OTP requests. Please try again later.'
            });
        }
        // Reset previous attempts if backoff window has passed
        try {
            await OTPService.resetRequestAttempts(normalizedPhone, clientIP);
        }
        catch (error) {
            console.log('Error resetting attempts:', error);
        }
        // Record OTP attempt
        await OTPService.recordOTPAttempt(normalizedPhone, clientIP, 'request');
        // Check if seller exists (for determining new user flow)
        let seller = await Seller.findOne({ phone: Number(normalizedPhone) });
        const isNewUser = !seller;
        // Generate OTP
        const otpLength = parseInt(process.env.OTP_LENGTH, 10) || 6; // 6-digit OTP consistent with existing system
        const otp = OTPService.generateOTP(otpLength);
        // Store OTP token
        const otpToken = await OTPService.storeOTPToken(normalizedPhone, otp);
        // Send OTP via SMS
        const sendResult = await Fast2SMSService.sendConfiguredOTP(normalizedPhone, otp);
        if (!sendResult.success) {
            console.error('Failed to send OTP via SMS:', sendResult.message);
            // Return success but with warning
            return reply.send({
                success: true,
                message: 'OTP generated successfully. Note: There might be a delay in receiving the SMS.',
                isNewUser: isNewUser,
                requestId: otpToken._id
            });
        }
        return reply.send({
            success: true,
            message: `OTP sent successfully to ${normalizedPhone}`,
            isNewUser: isNewUser,
            requestId: otpToken._id
        });
    }
    catch (error) {
        console.error('Seller Login Error:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to process login request'
        });
    }
};
/**
 * Verify OTP and complete seller login
 * POST /api/seller/verify-otp
 */
export const verifySellerOTP = async (req, reply) => {
    try {
        const { phone, otp } = req.body;
        // Validate input
        if (!phone || !otp) {
            return reply.status(400).send({
                success: false,
                message: 'Phone number and OTP are required'
            });
        }
        // Normalize phone number
        const normalizedPhone = phone.toString().replace(/\D/g, '');
        // Check rate limiting for verification attempts
        const clientIP = req.ip || req.ips || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const rateLimit = await OTPService.isRateLimited(normalizedPhone, clientIP, 'verify');
        if (rateLimit.isLimited) {
            return reply.status(429).send({
                success: false,
                message: 'Too many verification attempts. Please try again later.'
            });
        }
        // Get valid OTP token
        const otpToken = await OTPService.getValidOTPToken(normalizedPhone);
        if (!otpToken) {
            // Record failed attempt
            await OTPService.recordOTPAttempt(normalizedPhone, clientIP, 'verify');
            return reply.status(400).send({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }
        // Verify OTP
        const isValid = await OTPService.verifyOTP(otp, otpToken.otpHash);
        if (!isValid) {
            // Record failed attempt
            await OTPService.recordOTPAttempt(normalizedPhone, clientIP, 'verify');
            return reply.status(400).send({
                success: false,
                message: 'Invalid OTP. Please check the code and try again.'
            });
        }
        // Reset verification attempts after success
        await OTPService.resetVerifyAttempts(normalizedPhone, clientIP);
        // Consume OTP token
        await OTPService.consumeOTPToken(otpToken._id);
        // Find or create seller
        let seller = await Seller.findOne({ phone: Number(normalizedPhone) });
        let isNewUser = false;
        if (!seller) {
            // Create new seller with minimal data
            seller = new Seller({
                phone: Number(normalizedPhone),
                role: 'Seller',
                isActivated: true,
                isVerified: true,
                profileCompleted: false
            });
            await seller.save();
            isNewUser = true;
        }
        // Generate JWT tokens
        const { accessToken, refreshToken } = generateTokens(seller);
        return reply.send({
            success: true,
            message: 'OTP verified successfully',
            token: accessToken,
            refreshToken: refreshToken,
            user: {
                id: seller._id,
                name: seller.name,
                phone: seller.phone,
                email: seller.email,
                role: seller.role,
                storeName: seller.storeName,
                isVerified: seller.isVerified,
                profileCompleted: seller.profileCompleted
            },
            isNewUser: isNewUser
        });
    }
    catch (error) {
        console.error('Seller OTP Verification Error:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to verify OTP'
        });
    }
};
/**
 * Resend OTP to seller
 * POST /api/seller/resend-otp
 */
export const resendSellerOTP = async (req, reply) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return reply.status(400).send({
                success: false,
                message: 'Phone number is required'
            });
        }
        // Use the same logic as loginSeller
        return await loginSeller(req, reply);
    }
    catch (error) {
        console.error('Seller Resend OTP Error:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to resend OTP'
        });
    }
};
/**
 * Complete seller registration/profile
 * POST /api/seller/register
 */
export const registerSeller = async (req, reply) => {
    try {
        const { userId, role } = req.user; // From JWT token
        const { name, email, storeName, storeAddress } = req.body;
        if (role !== 'Seller') {
            return reply.status(403).send({
                success: false,
                message: 'Access denied. Seller role required.'
            });
        }
        // Find seller
        const seller = await Seller.findById(userId);
        if (!seller) {
            return reply.status(404).send({
                success: false,
                message: 'Seller not found'
            });
        }
        // Update seller profile
        seller.name = name || seller.name;
        seller.email = email || seller.email;
        seller.storeName = storeName || seller.storeName;
        seller.storeAddress = storeAddress || seller.storeAddress;
        seller.profileCompleted = !!(name && storeName);
        seller.updatedAt = new Date();
        await seller.save();
        return reply.send({
            success: true,
            message: 'Seller profile updated successfully',
            user: {
                id: seller._id,
                name: seller.name,
                phone: seller.phone,
                email: seller.email,
                role: seller.role,
                storeName: seller.storeName,
                storeAddress: seller.storeAddress,
                isVerified: seller.isVerified,
                profileCompleted: seller.profileCompleted
            }
        });
    }
    catch (error) {
        console.error('Seller Registration Error:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to update seller profile'
        });
    }
};
/**
 * Refresh seller tokens
 * POST /api/seller/refresh-token
 */
export const refreshSellerToken = async (req, reply) => {
    try {
        const { refreshToken: clientRefreshToken } = req.body;
        if (!clientRefreshToken) {
            return reply.status(401).send({
                success: false,
                message: 'Refresh token required'
            });
        }
        const decoded = jwt.verify(clientRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (decoded.role !== 'Seller') {
            return reply.status(403).send({
                success: false,
                message: 'Invalid role for seller endpoint'
            });
        }
        const seller = await Seller.findById(decoded.userId);
        if (!seller) {
            return reply.status(403).send({
                success: false,
                message: 'Seller not found'
            });
        }
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(seller);
        return reply.send({
            success: true,
            message: 'Token refreshed successfully',
            token: accessToken,
            refreshToken: newRefreshToken
        });
    }
    catch (error) {
        console.error('Seller Refresh Token Error:', error);
        return reply.status(403).send({
            success: false,
            message: 'Invalid refresh token'
        });
    }
};
/**
 * Logout seller
 * POST /api/seller/logout
 */
export const logoutSeller = async (req, reply) => {
    try {
        // For now, just return success
        // In future, we could blacklist tokens or handle FCM token cleanup
        return reply.send({
            success: true,
            message: 'Logout successful'
        });
    }
    catch (error) {
        console.error('Seller Logout Error:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to logout'
        });
    }
};
