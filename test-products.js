const mongoose = require(" mongoose\);

async function testSellerProducts() {
 try {
 await mongoose.connect(\mongodb://localhost:27017/goatgoat\);
 console.log(" Connected to MongoDB\);
    
    // Import the Product model
    const { Product } = await import(\./dist/models/index.js\);
    
    // Find products to test
    const products = await Product.find({})
      .populate(\category\, \name image\)
      .populate(\seller\, \name storeName\)
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log(" Sample products from database:\);
 products.forEach(product => {
 console.log({
 id: product._id.toString(),
 name: product.name,
 status: product.status,
 seller: product.seller?.storeName || product.seller?.name,
 approvedBy: product.approvedBy ? product.approvedBy.toString() : null,
 approvedAt: product.approvedAt
 });
 });
 
 await mongoose.disconnect();
 } catch (error) {
 console.error(" Error:\, error);
  }
}

testSellerProducts();
