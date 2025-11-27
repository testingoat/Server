import axios from 'axios';

class MSG91EmailService {
  constructor() {
    this.baseURL = 'https://control.msg91.com/api/v5/email';
    this.authKey = process.env.MSG91_AUTH_KEY;
    this.domain = process.env.MSG91_EMAIL_DOMAIN;
    this.fromEmail = process.env.MSG91_FROM_EMAIL;
    this.fromName = process.env.MSG91_FROM_NAME || 'GoatGoat App';
  }

  validateConfig() {
    const required = ['MSG91_AUTH_KEY', 'MSG91_EMAIL_DOMAIN', 'MSG91_FROM_EMAIL'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('MSG91 Email Service - Missing required environment variables:', missing);
      return false;
    }
    
    return true;
  }

  async sendEmail(emailData) {
    try {
      if (!this.validateConfig()) {
        throw new Error('MSG91 Email Service configuration is invalid');
      }

      const { to, toName, templateId, variables = {}, attachments = [] } = emailData;

      if (!to || !templateId) {
        throw new Error('Recipient email and template ID are required');
      }

      const payload = {
        recipients: [
          {
            to: [
              {
                name: toName || to.split('@')[0],
                email: to
              }
            ],
            variables: variables
          }
        ],
        from: {
          name: this.fromName,
          email: this.fromEmail
        },
        domain: this.domain,
        template_id: templateId
      };

      if (attachments && attachments.length > 0) {
        payload.attachments = attachments;
      }

      console.log('MSG91 Email - Sending email:', {
        to,
        templateId,
        domain: this.domain,
        from: this.fromEmail
      });

      const response = await axios.post(this.baseURL + '/send', payload, {
        headers: {
          'accept': 'application/json',
          'authkey': this.authKey,
          'content-type': 'application/json'
        },
        timeout: 30000
      });

      console.log('MSG91 Email - Email sent successfully:', {
        to,
        templateId,
        messageId: response.data?.data?.message_id,
        threadId: response.data?.data?.thread_id
      });

      return {
        success: true,
        message: 'Email sent successfully',
        data: response.data?.data,
        messageId: response.data?.data?.message_id,
        threadId: response.data?.data?.thread_id
      };

    } catch (error) {
      console.error('MSG91 Email - Send failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return {
        success: false,
        message: error.response?.data?.message || error.message,
        error: error.response?.data || error.message
      };
    }
  }

  async sendOTPEmail(email, otp, name = null) {
    const templateId = process.env.MSG91_OTP_TEMPLATE_ID || 'global_otp';
    
    return await this.sendEmail({
      to: email,
      toName: name,
      templateId: templateId,
      variables: {
        otp: otp,
        company_name: process.env.COMPANY_NAME || 'GoatGoat App',
        app_name: process.env.APP_NAME || 'GoatGoat'
      }
    });
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getStatus() {
    return {
      service: 'MSG91 Email Service',
      configured: this.validateConfig(),
      baseURL: this.baseURL,
      domain: this.domain,
      fromEmail: this.fromEmail,
      fromName: this.fromName
    };
  }
}

export default MSG91EmailService;
