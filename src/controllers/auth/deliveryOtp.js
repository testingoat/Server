import { DeliveryPartner } from '../../models/index.js';
import OTPService from '../../services/otp.js';
import jwt from 'jsonwebtoken';

// Generate JWT tokens (copied from auth.js)
const generateTokens = (user) => {
    console.log(' DEBUG - JWT Environment Variables:');
    console.log('ACCESS_TOKEN_SECRET exists:', !!process.env.ACCESS_TOKEN_SECRET);
    console.log('ACCESS_TOKEN_SECRET length:', process.env.ACCESS_TOKEN_SECRET?.length);
    console.log('REFRESH_TOKEN_SECRET exists:', !!process.env.REFRESH_TOKEN_SECRET);
    console.log('REFRESH_TOKEN_SECRET length:', process.env.REFRESH_TOKEN_SECRET?.length);
    
    const payload = {
        userId: user._id,
        role: user.role,
    };
    
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '15m',
    });
    
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '7d',
    });
    
    return { accessToken, refreshToken };
};

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();

export const requestDeliveryOtp = async (req, reply) => {
    try {
        const { phone } = req.body;
        console.log('Delivery OTP request for phone:', phone);

        if (!phone) {
            return reply.status(400).send({
                success: false,
                message: 'Phone number is required',
            });
        }

        // Normalize phone number (same logic as registration)
        const phoneStr = phone.toString().replace(/\D/g, '');
        if (phoneStr.length < 10) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid phone number format',
            });
        }
        const normalizedPhone = Number(phoneStr);

        // Check if delivery partner exists
        const deliveryPartner = await DeliveryPartner.findOne({ phone: normalizedPhone });

        if (!deliveryPartner) {
            console.log('Delivery Partner not found for phone:', normalizedPhone);
            return reply.status(404).send({
                success: false,
                message: 'Phone number not registered as Delivery Partner',
                needsRegistration: true,
            });
        }

        // Generate and store OTP
        const otp = OTPService.generateOTP();
        otpStore.set(normalizedPhone, {
            otp,
            timestamp: Date.now(),
            attempts: 0,
        });

        // Send OTP (implement your SMS service)
        try {
            await OTPService.sendOTP(normalizedPhone, otp);
            console.log('✅ OTP sent successfully to:', normalizedPhone);
            
            return reply.status(200).send({
                success: true,
                message: 'OTP sent successfully',
            });
        } catch (smsError) {
            console.error('❌ Failed to send OTP:', smsError);
            return reply.status(500).send({
                success: false,
                message: 'Failed to send OTP. Please try again.',
            });
        }

    } catch (error) {
        console.error('Delivery OTP request error:', error);
        return reply.status(500).send({
            success: false,
            message: 'An error occurred while sending OTP',
        });
    }
};

export const verifyDeliveryOtp = async (req, reply) => {
    try {
        const { phone, otp } = req.body;
        console.log('Delivery OTP verification for phone:', phone);

        if (!phone || !otp) {
            return reply.status(400).send({
                success: false,
                message: 'Phone number and OTP are required',
            });
        }

        // Normalize phone number (same logic as registration and request)
        const phoneStr = phone.toString().replace(/\D/g, '');
        if (phoneStr.length < 10) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid phone number format',
            });
        }
        const normalizedPhone = Number(phoneStr);

        // Check stored OTP (use normalized phone as key)
        const storedOtpData = otpStore.get(normalizedPhone);
        if (!storedOtpData) {
            return reply.status(400).send({
                success: false,
                message: 'OTP not found or expired. Please request a new OTP.',
            });
        }

        // Check OTP expiry (5 minutes)
        const otpAge = Date.now() - storedOtpData.timestamp;
        if (otpAge > 5 * 60 * 1000) {
            otpStore.delete(normalizedPhone);
            return reply.status(400).send({
                success: false,
                message: 'OTP has expired. Please request a new OTP.',
            });
        }

        // Verify OTP
        if (storedOtpData.otp !== otp) {
            storedOtpData.attempts += 1;
            if (storedOtpData.attempts >= 3) {
                otpStore.delete(normalizedPhone);
                return reply.status(400).send({
                    success: false,
                    message: 'Too many incorrect attempts. Please request a new OTP.',
                });
            }
            return reply.status(400).send({
                success: false,
                message: 'Invalid OTP. Please try again.',
            });
        }

        // Find delivery partner (use normalized phone)
        const deliveryPartner = await DeliveryPartner.findOne({ phone: normalizedPhone });
        if (!deliveryPartner) {
            otpStore.delete(normalizedPhone);
            return reply.status(404).send({
                success: false,
                message: 'Delivery Partner not found',
                needsRegistration: true,
            });
        }

        // Check if delivery partner is approved
        if (!deliveryPartner.isVerified) {
            otpStore.delete(normalizedPhone);
            console.log('❌ DeliveryPartner not approved yet:', deliveryPartner.email);
            return reply.status(403).send({
                success: false,
                message: 'Your application is pending approval. You will be notified once approved.',
                error: 'PENDING_APPROVAL',
                needsApproval: true
            });
        }

        // Clear OTP after successful verification
        otpStore.delete(normalizedPhone);

        // Generate JWT tokens
        const tokens = generateTokens(deliveryPartner);
        console.log('✅ Delivery Partner authenticated successfully:', deliveryPartner.email);

        return reply.status(200).send({
            success: true,
            message: 'Login successful',
            token: tokens,
            user: {
                _id: deliveryPartner._id,
                name: deliveryPartner.name,
                email: deliveryPartner.email,
                phone: deliveryPartner.phone,
                role: deliveryPartner.role,
                isVerified: deliveryPartner.isVerified,
                profileCompleted: deliveryPartner.profileCompleted
            }
        });

    } catch (error) {
        console.error('Delivery OTP verification error:', error);
        return reply.status(500).send({
            success: false,
            message: 'An error occurred during verification',
        });
    }
};

export const registerDeliveryPartner = async (req, reply) => {
    try {
        const {
            name,
            email,
            phone,
            vehicleNumber,
            vehicleType,
            drivingLicenseNumber,
            bloodGroup,
            bankAccountNumber,
            ifscCode,
            bankName,
            emergencyContact
        } = req.body;

        console.log('Delivery Partner registration request for:', { name, email, phone });

        // Input Validation
        if (!name || !email || !phone || !vehicleNumber || !vehicleType || !drivingLicenseNumber) {
            return reply.status(400).send({
                success: false,
                message: 'Required fields missing: name, email, phone, vehicleNumber, vehicleType, drivingLicenseNumber',
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid email format',
            });
        }

        // Validate and normalize phone number
        const phoneStr = phone.toString().replace(/\D/g, '');
        if (phoneStr.length < 10) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid phone number format',
            });
        }
        const normalizedPhone = Number(phoneStr);

        // Validate vehicle type
        const validVehicleTypes = ['bike', 'scooter', 'bicycle', 'car'];
        if (!validVehicleTypes.includes(vehicleType)) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid vehicle type. Must be one of: bike, scooter, bicycle, car',
            });
        }

        // Normalize email to lowercase
        const normalizedEmail = email.toLowerCase();

        // Check for duplicate phone number
        const existingPhonePartner = await DeliveryPartner.findOne({ phone: normalizedPhone });
        if (existingPhonePartner) {
            return reply.status(409).send({
                success: false,
                message: 'Phone number already registered',
            });
        }

        // Check for duplicate email
        const existingEmailPartner = await DeliveryPartner.findOne({ email: normalizedEmail });
        if (existingEmailPartner) {
            return reply.status(409).send({
                success: false,
                message: 'Email already registered',
            });
        }

        // Create new DeliveryPartner
        const deliveryPartner = new DeliveryPartner({
            name,
            email: normalizedEmail,
            phone: normalizedPhone,
            vehicleNumber,
            vehicleType,
            drivingLicenseNumber,
            bloodGroup,
            bankAccountNumber,
            ifscCode,
            bankName,
            emergencyContact,
            role: 'DeliveryPartner',
            isVerified: false,
            profileCompleted: true,
            isActivated: false
            // password field is left undefined (not needed for OTP authentication)
        });

        try {
            await deliveryPartner.save();
        } catch (saveError) {
            // Handle duplicate key errors (race condition)
            if (saveError.code === 11000) {
                const field = Object.keys(saveError.keyPattern)[0];
                const message = field === 'phone' ? 'Phone number already registered' : 
                               field === 'email' ? 'Email already registered' : 
                               'Duplicate entry detected';
                return reply.status(409).send({
                    success: false,
                    message: message,
                });
            }
            throw saveError; // Re-throw if not a duplicate key error
        }

        console.log('✅ Delivery Partner registered successfully:', deliveryPartner._id);

        return reply.status(201).send({
            success: true,
            message: 'Registration successful. Your application is pending admin approval. You will be notified once approved.',
            user: {
                _id: deliveryPartner._id,
                name: deliveryPartner.name,
                email: deliveryPartner.email,
                phone: deliveryPartner.phone,
                role: deliveryPartner.role,
                isVerified: deliveryPartner.isVerified,
                profileCompleted: deliveryPartner.profileCompleted
            }
        });

    } catch (error) {
        console.error('Delivery Partner registration error:', error);
        return reply.status(500).send({
            success: false,
            message: 'An error occurred during registration',
        });
    }
};
