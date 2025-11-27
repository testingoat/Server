export async function testOtpHandler(request, reply) {
    const { phoneNumber, dryRun } = request.body;
    // For now, just log the request
    console.log(`Received test OTP request for ${phoneNumber} with dryRun: ${dryRun}`);
    // TODO: Implement actual OTP sending logic using OTP Manager and Fast2SMS Adapter
    // Ensure to respect the dryRun flag and audit log the request
    return reply.send({ success: true, message: `Test OTP request received for ${phoneNumber}.` });
}
