async function testImports() {
  try {
    const sellerNotifications = await import(./src/controllers/seller/sellerNotifications.js);
    console.log(✅ Seller notifications imported successfully);
    console.log(Exports:, Object.keys(sellerNotifications));
  } catch (error) {
    console.log(❌ Error importing seller notifications:, error.message);
  }
}

testImports();
