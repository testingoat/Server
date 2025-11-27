import EmailOTPService from '../../services/emailOtp.js';

const emailOTPService = new EmailOTPService();

/**
 * Send OTP to email address
 */
export const sendEmailOTP = async (req, reply) => {
  try {
    const { email, name } = req.body;

    // Validate required fields
    if (!email) {
      return reply.status(400).send({
        success: false,
        message: 'Email address is required'
      });
    }

    // Validate email format
    if (!EmailOTPService.validateEmail(email)) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid email address format'
      });
    }

    // Generate OTP
    const otp = EmailOTPService.generateOTP(6);
    console.log(' Generated OTP for', email, ':', otp); // Remove in production

    // Send OTP via email
    const result = await emailOTPService.sendEmailOTP(email, otp, name);

    if (result.success) {
      // Store OTP in database (you can implement this later)
      // await EmailOTPService.storeEmailOTPToken(email, otp, result.requestId);

      return reply.send({
        success: true,
        message: result.message,
        requestId: result.requestId
      });
    } else {
      return reply.status(500).send({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error(' Send Email OTP Error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Test email service configuration
 */
export const testEmailService = async (req, reply) => {
  try {
    const emailService = new EmailOTPService();
    const status = emailService.emailService.getStatus();

    return reply.send({
      success: true,
      message: 'Email service status retrieved',
      status: status
    });

  } catch (error) {
    console.error(' Test Email Service Error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to get email service status',
      error: error.message
    });
  }
};

/**
 * Send test email
 */
export const sendTestEmail = async (req, reply) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return reply.status(400).send({
        success: false,
        message: 'Email address is required'
      });
    }

    if (!EmailOTPService.validateEmail(email)) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid email address format'
      });
    }

    // Generate test OTP
    const testOTP = '123456';
    
    const result = await emailOTPService.sendEmailOTP(email, testOTP, name || 'Test User');

    return reply.send({
      success: result.success,
      message: result.message,
      requestId: result.requestId
    });

  } catch (error) {
    console.error(' Send Test Email Error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
};
