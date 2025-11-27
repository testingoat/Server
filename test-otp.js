// Test script for backend OTP implementation
import axios from 'axios';
import OTPService from './src/services/otp.js';
import Fast2SMSService from './src/services/fast2sms.js';

// Test OTP service
const testOTPService = async () => {
  console.log('Testing OTP service...');

  try {
    // Generate OTP
    const otp = OTPService.generateOTP(6);
    console.log('Generated OTP:', otp);

    // Hash OTP
    const hashedOTP = await OTPService.hashOTP(otp);
    console.log('Hashed OTP:', hashedOTP);

    // Verify OTP
    const isValid = await OTPService.verifyOTP(otp, hashedOTP);
    console.log('OTP verification result:', isValid);

    // Test invalid OTP
    const isInvalid = await OTPService.verifyOTP('000000', hashedOTP);
    console.log('Invalid OTP verification result:', isInvalid);

    // Test rate limiting
    const phone = '9999999999';
    const ip = '127.0.0.1';

    // Record some attempts
    for (let i = 0; i < 3; i++) {
      await OTPService.recordOTPAttempt(phone, ip);
      console.log(`Recorded attempt ${i + 1}`);
    }

    // Check if rate limited
    const rateLimit = await OTPService.isRateLimited(phone, ip);
    console.log('Rate limit status:', rateLimit);

    console.log('OTP service tests completed successfully');
  } catch (error) {
    console.error('OTP service error:', error);
  }
};

// Test Fast2SMS service
const testFast2SMSService = async () => {
  console.log('Testing Fast2SMS service...');

  try {
    // Test sending OTP (this will fail without valid credentials)
    const result = await Fast2SMSService.sendOTP('9999999999', '123456');
    console.log('Fast2SMS send result:', result);

    // Test sending DLT Manual OTP (this will also fail without valid credentials)
    const dltResult = await Fast2SMSService.sendDLTManualOTP('9999999999', '123456');
    console.log('Fast2SMS DLT send result:', dltResult);

    // Test sending configured OTP
    const configuredResult = await Fast2SMSService.sendConfiguredOTP('9999999999', '123456');
    console.log('Fast2SMS configured send result:', configuredResult);

    // Test checking balance
    const balanceResult = await Fast2SMSService.checkBalance();
    console.log('Fast2SMS balance result:', balanceResult);

    console.log('Fast2SMS service tests completed');
  } catch (error) {
    console.error('Fast2SMS service error:', error);
  }
};

// Test OTP endpoints
const testOTPEndpoints = async () => {
  console.log('Testing OTP endpoints...');

  try {
    // Test request OTP endpoint
    const requestResult = await axios.post('http://localhost:3000/api/auth/otp/request', {
      phone: '9999999999',
    });
    console.log('OTP request result:', requestResult.data);

    // Test verify OTP endpoint
    const verifyResult = await axios.post('http://localhost:3000/api/auth/otp/verify', {
      phone: '9999999999',
      otp: '123456',
    });
    console.log('OTP verify result:', verifyResult.data);

    // Test test OTP endpoint
    const testResult = await axios.post('http://localhost:3000/api/auth/otp/test', {
      phone: '9999999999',
    });
    console.log('Test OTP result:', testResult.data);

    console.log('OTP endpoint tests completed');
  } catch (error) {
    console.error('OTP endpoint error:', error.response?.data || error.message);
  }
};

// Run all tests
const runAllTests = async () => {
  console.log('Running all OTP tests...');

  await testOTPService();
  await testFast2SMSService();
  // await testOTPEndpoints(); // Uncomment when backend is running

  console.log('All tests completed');
};

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export { testOTPService, testFast2SMSService, testOTPEndpoints, runAllTests };
