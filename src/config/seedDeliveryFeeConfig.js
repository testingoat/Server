import DeliveryFeeConfig from '../models/deliveryFeeConfig.js';

export async function seedDefaultDeliveryFeeConfig() {
  try {
    const existing = await DeliveryFeeConfig.findOne({ isActive: true });
    if (existing) {
      console.log('ℹ️ Active delivery fee configuration already exists, skipping seed');
      return false;
    }

    const defaultConfig = {
      slabs: [
        { minOrderValue: 0, maxOrderValue: 200, baseFee: 20, percentageFee: 0, description: 'Small orders (₹0-₹200)' },
        { minOrderValue: 201, maxOrderValue: 500, baseFee: 15, percentageFee: 0.05, description: 'Medium orders (₹201-₹500)' },
        { minOrderValue: 501, maxOrderValue: null, baseFee: 10, percentageFee: 0.03, description: 'Large orders (₹501+)' },
      ],
      partnerEarningsPercentage: 0.8,
      isActive: true,
      createdBy: 'system',
    };

    await DeliveryFeeConfig.create(defaultConfig);
    console.log('✅ Default delivery fee configuration seeded successfully');
    return true;
  } catch (err) {
    console.error('❌ Failed to seed default delivery fee configuration:', err.message || err);
    return false;
  }
}
