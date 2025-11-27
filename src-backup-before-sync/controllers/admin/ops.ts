import { FastifyRequest, FastifyReply } from 'fastify';

export async function testOtpHandler(request: FastifyRequest, reply: FastifyReply) {
  const { phoneNumber, dryRun = true } = request.body as { phoneNumber: string; dryRun?: boolean };

  // Validation
  if (!phoneNumber) {
    return reply.status(400).send({
      success: false,
      message: 'Phone number is required',
    });
  }

  // Validate phone number format (10 digits)
  if (!/^[0-9]{10}$/.test(phoneNumber)) {
    return reply.status(400).send({
      success: false,
      message: 'Phone number must be exactly 10 digits',
    });
  }

  // Log the request with timestamp
  const timestamp = new Date().toISOString();
  const mode = dryRun ? 'DRY_RUN' : 'LIVE';
  const logMessage = `[${timestamp}] OTP_TEST_REQUEST - Phone: ${phoneNumber}, Mode: ${mode}, IP: ${request.ip}`;

  console.log('🧪 ' + logMessage);

  try {
    if (dryRun) {
      // Simulate OTP generation for dry run
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`🔢 Generated mock OTP: ${mockOtp} (not sent)`);

      return reply.send({
        success: true,
        message: `Dry run successful for ${phoneNumber}. Mock OTP: ${mockOtp} (not sent)`,
        data: {
          phoneNumber,
          mode: 'dry_run',
          mockOtp,
          timestamp,
        },
      });
    } else {
      // TODO: Implement actual OTP sending logic
      // For now, return a message indicating live mode would send
      console.log(`📱 LIVE MODE: Would send actual OTP to ${phoneNumber}`);

      return reply.send({
        success: true,
        message: `Live mode: OTP would be sent to ${phoneNumber} (implementation pending)`,
        data: {
          phoneNumber,
          mode: 'live',
          timestamp,
          note: 'Actual SMS sending not yet implemented',
        },
      });
    }
  } catch (error: any) {
    console.error('❌ OTP test error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error during OTP test',
      error: error.message,
    });
  }
}
