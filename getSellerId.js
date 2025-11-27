import mongoose from mongoose;
import { connectDB } from ./src/config/connect.js;

const getSellerId = async () => {
  try {
    await connectDB();
    console.log(Connected to database);
    
    // Import Seller model
    const { Seller } = await import(./src/models/user.js);
    
    // Get first seller
    const seller = await Seller.findOne().select(_id name phone storeName);
    
    if (seller) {
      console.log(Found seller:, JSON.stringify({
        id: seller._id,
        name: seller.name,
        phone: seller.phone,
        storeName: seller.storeName
      }));
    } else {
      console.log(No sellers found in database);
    }
    
    await mongoose.connection.close();
  } catch (error) {
    console.error(Error:, error);
  }
};

getSellerId();
