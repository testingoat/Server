import MSG91EmailService from './msg91Email.js';
class EmailOTPService {
    constructor() {
        this.emailService = new MSG91EmailService();
    }
    static generateOTP(length = 6) {
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * 10)];
        }
        return otp;
    }
    async sendEmailOTP(email, otp, name = null) {
        try {
            console.log(' EmailOTP - Sending OTP to:', email);
            const result = await this.emailService.sendOTPEmail(email, otp, name);
            if (result.success) {
                console.log(' EmailOTP - OTP sent successfully to:', email);
                return {
                    success: true,
                    message: 'OTP sent successfully to your email',
                    requestId: result.messageId
                };
            }
            else {
                console.error(' EmailOTP - Failed to send OTP to:', email, result.message);
                return {
                    success: false,
                    message: result.message || 'Failed to send OTP email'
                };
            }
        }
        catch (error) {
            console.error(' EmailOTP - Error sending OTP:', error);
            return {
                success: false,
                message: 'Failed to send OTP email due to server error'
            };
        }
    }
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}
export default EmailOTPService;
