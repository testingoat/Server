// Simple test for Fast2SMS service
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// FAST2SMS API Configuration
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY;
const FAST2SMS_BASE_URL = 'https://www.fast2sms.com/dev/bulkV2';
const DLT_ENTITY_ID = process.env.DLT_ENTITY_ID;
const DLT_TEMPLATE_ID = process.env.DLT_TEMPLATE_ID;

console.log('🔧 Fast2SMS Configuration:');
console.log('API Key:', FAST2SMS_API_KEY ? 'Set' : 'Not set');
console.log('DLT Entity ID:', DLT_ENTITY_ID);
console.log('DLT Template ID:', DLT_TEMPLATE_ID);

// Check if DLT configuration is available
const useDLT = DLT_ENTITY_ID && DLT_ENTITY_ID !== 'YOUR_DEFAULT_ENTITY_ID' &&
               DLT_TEMPLATE_ID && DLT_TEMPLATE_ID !== 'YOUR_DEFAULT_TEMPLATE_ID';

console.log('Use DLT:', useDLT);
console.log('Route selected:', useDLT ? 'DLT Manual' : 'Standard OTP');

async function testOTPRoute() {
  console.log('\n📱 Testing Standard OTP Route...');
  
  try {
    const otp = '123456';
    const phone = '8888888888';
    
    console.log(`Sending OTP ${otp} to ${phone}`);
    
    const response = await axios.post(
      FAST2SMS_BASE_URL,
      `variables_values=${otp}&route=otp&numbers=${phone}`,
      {
        headers: {
          authorization: FAST2SMS_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('✅ Fast2SMS Response:', response.data);
    
    if (response.data.return) {
      console.log('✅ OTP sent successfully via OTP route (Sender ID: OTP)');
    } else {
      console.log('❌ Failed to send OTP:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Fast2SMS Error:', error.response?.data || error.message);
  }
}

async function testDLTRoute() {
  console.log('\n📱 Testing DLT Manual Route...');
  
  try {
    const otp = '123456';
    const phone = '9999999999';
    const message = `Your OTP for Grocery Delivery App is ${otp}. Please use this code to verify your mobile number.`;
    
    console.log(`Sending OTP ${otp} to ${phone} via DLT`);
    
    const response = await axios.post(
      FAST2SMS_BASE_URL,
      `sender_id=FTWSMS&message=${encodeURIComponent(message)}&template_id=${DLT_TEMPLATE_ID}&entity_id=${DLT_ENTITY_ID}&route=dlt_manual&numbers=${phone}`,
      {
        headers: {
          authorization: FAST2SMS_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('✅ Fast2SMS DLT Response:', response.data);
    
    if (response.data.return) {
      console.log('✅ OTP sent successfully via DLT route (Sender ID: FTWSMS)');
    } else {
      console.log('❌ Failed to send OTP via DLT:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Fast2SMS DLT Error:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Fast2SMS Tests...\n');
  
  if (!FAST2SMS_API_KEY) {
    console.log('❌ FAST2SMS_API_KEY not set, skipping tests');
    return;
  }
  
  await testOTPRoute();
  
  if (useDLT) {
    await testDLTRoute();
  }
  
  console.log('\n✅ Tests completed');
}

runTests();
