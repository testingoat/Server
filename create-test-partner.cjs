const mongoose = require('mongoose');
require('dotenv').config({ path: '/var/www/goatgoat-staging/server/.env.staging' });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const { DeliveryPartner } = require('/var/www/goatgoat-staging/server/dist/models/index.js');
  
  // Create a test delivery partner
  const testPartner = new DeliveryPartner({
    phone: '8050343816',
    email: 'test@delivery.com',
    name: 'Test Delivery Partner',
    role: 'DeliveryPartner',
    password: 'hashedpassword123',
    isActivated: true,
    fcmTokens: [],
    bankAccounts: [],
    rating: 5.0,
    totalDeliveries: 0
  });
  
  try {
    await testPartner.save();
    console.log('Test delivery partner created:', testPartner.phone, testPartner.name);
  } catch (error) {
    if (error.code === 11000) {
      console.log('Delivery partner already exists for phone:', testPartner.phone);
    } else {
      console.error('Error creating delivery partner:', error.message);
    }
  }
  
  mongoose.disconnect();
}).catch(console.error);
