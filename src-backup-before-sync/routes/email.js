import { sendEmailOTP, testEmailService, sendTestEmail } from '../controllers/auth/emailOtp.js';

async function emailRoutes(fastify, options) {
  fastify.post('/send-otp', sendEmailOTP);
  fastify.get('/test-service', testEmailService);
  fastify.post('/send-test', sendTestEmail);
}

export default emailRoutes;
