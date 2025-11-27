import mongoose from mongoose;
import dotenv from dotenv;
import { Notification, Seller } from ./src/models/index.js;

// Load environment variables
dotenv.config({ path: .env.staging });

async function createTestNotifications() {
  try {
    // Connect to MongoDB
    const MONGO_URI = process.env.MONGO_URI || your-mongo-connection-string;
    await mongoose.connect(MONGO_URI);
    console.log(Connected to MongoDB);

    // Find a seller to add notifications to (or use a test seller ID)
    const seller = await Seller.findOne();
    if (!seller) {
      console.log(No sellers found. Please create a seller first.);
      return;
    }

    console.log(`Adding test notifications for seller: ${seller._id}`);

    // Test notifications data
    const testNotifications = [
      {
        title: Welcome to SellerApp2!,
        message: Start managing your store efficiently with our new features,
        type: system,
        icon: celebration,
        sellerId: seller._id,
        isRead: false,
      },
      {
        title: New Order Received,
        message: Order #12345 has been placed by John Doe,
        type: order, 
        icon: receipt,
        sellerId: seller._id,
        isRead: false,
        data: {
          orderId: 12345,
          customerName: John Doe,
        },
      },
      {
        title: Low Stock Alert,
        message: Organic Bananas are running low in stock,
        type: stock,
        icon: warning,
        sellerId: seller._id,
        isRead: true,
        data: {
          productName: Organic Bananas,
          currentStock: 5,
        },
      },
      {
        title: Payment Received,
        message: Payment of ₹245 received for Order #12344,
        type: payment,
        icon: payment,
        sellerId: seller._id,
        isRead: true,
        data: {
          amount: 245,
          orderId: 12344,
        },
      },
      {
        title: App Update Available,
        message: Version 2.1.0 is now available with bug fixes and improvements,
        type: update,
        icon: system-update,
        sellerId: seller._id,
        isRead: true,
      },
    ];

    // Insert test notifications
    const result = await Notification.insertMany(testNotifications);
    console.log(`✅ Created ${result.length} test notifications`);
    
    // Display created notifications
    result.forEach((notification, index) => {
      console.log(`  ${index + 1}. ${notification.title} (Type: ${notification.type}, Read: ${notification.isRead})`);
    });

  } catch (error) {
    console.error(Error creating test notifications:, error);
  } finally {
    await mongoose.connection.close();
    console.log(Database connection closed);
  }
}

createTestNotifications();
