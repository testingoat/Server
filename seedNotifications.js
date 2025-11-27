import mongoose from 'mongoose';
import { connectDB } from './server/src/config/connect.js';

// Import models
import Notification from './server/src/models/notification.js';

const seedNotifications = async () => {
  try {
    console.log('🌱 Starting notification seed...');
    
    // Connect to database
    await connectDB();
    console.log('📄 Connected to database');

    // Sample seller ID (you'll need to replace this with an actual seller ID from your database)
    const sampleSellerId = '66f4dd6b3e0b71b3a4aa4c92'; // This should be replaced with actual seller ID

    // Clear existing notifications for this seller
    await Notification.deleteMany({ sellerId: sampleSellerId });
    console.log('🗑️ Cleared existing notifications');

    // Create sample notifications
    const sampleNotifications = [
      {
        title: 'Welcome to the Platform!',
        message: 'Thank you for joining our seller platform. Start by adding your first product.',
        type: 'system',
        icon: 'welcome',
        sellerId: sampleSellerId,
        isRead: false
      },
      {
        title: 'New Order Received',
        message: 'You have received a new order #12345. Please review and accept it.',
        type: 'order',
        icon: 'shopping_cart',
        sellerId: sampleSellerId,
        isRead: false,
        data: {
          orderId: 'ORD12345',
          amount: 250.50
        }
      },
      {
        title: 'Low Stock Alert',
        message: 'Product "Fresh Apples" is running low on stock. Only 5 items remaining.',
        type: 'stock',
        icon: 'inventory',
        sellerId: sampleSellerId,
        isRead: false,
        data: {
          productId: 'PROD789',
          productName: 'Fresh Apples',
          remainingStock: 5
        }
      },
      {
        title: 'Payment Received',
        message: 'Payment of ₹1,250 has been credited to your account for order #12344.',
        type: 'payment',
        icon: 'payment',
        sellerId: sampleSellerId,
        isRead: true,
        data: {
          orderId: 'ORD12344',
          amount: 1250,
          transactionId: 'TXN567890'
        }
      },
      {
        title: 'Profile Update Required',
        message: 'Please update your business hours and delivery areas in your profile.',
        type: 'update',
        icon: 'edit',
        sellerId: sampleSellerId,
        isRead: false
      }
    ];

    // Insert sample notifications
    const createdNotifications = await Notification.insertMany(sampleNotifications);
    console.log(`✅ Created ${createdNotifications.length} sample notifications`);

    // Display summary
    console.log('\n📊 Notification Summary:');
    console.log(`Seller ID: ${sampleSellerId}`);
    console.log(`Total notifications: ${createdNotifications.length}`);
    console.log(`Unread notifications: ${createdNotifications.filter(n => !n.isRead).length}`);
    
    console.log('\n🎉 Notification seed completed successfully!');
    
    // Close connection
    await mongoose.connection.close();
    console.log('📄 Database connection closed');
    
  } catch (error) {
    console.error('❌ Notification seed failed:', error);
    process.exit(1);
  }
};

// Run the seed
seedNotifications();