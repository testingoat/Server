import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://testingoat24:Goat%402024@cluster6.l5jkmi9.mongodb.net/goatgoatStaging';

async function checkDeliveryPartners() {
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db();
        const partners = await db.collection('deliverypartners').find({}).limit(5).toArray();
        
        console.log('\nDelivery Partners found:', partners.length);
        
        if (partners.length > 0) {
            console.log('\nFirst delivery partner:');
            console.log('- ID:', partners[0]._id);
            console.log('- Phone:', partners[0].phone);
            console.log('- Name:', partners[0].name);
            console.log('- Role:', partners[0].role);
        } else {
            console.log('\nNo delivery partners found in database');
        }
        
        // Check orders
        const orders = await db.collection('orders').find({}).limit(5).toArray();
        console.log('\nOrders found:', orders.length);
        
        if (orders.length > 0) {
            const deliveredOrders = await db.collection('orders').countDocuments({ status: 'delivered' });
            console.log('Delivered orders:', deliveredOrders);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

checkDeliveryPartners();

