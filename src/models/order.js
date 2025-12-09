import mongoose from 'mongoose';
import Counter from './counter.js';
const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
    },
    deliveryPartner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryPartner',
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true,
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: true,
    },
    items: [
        {
            id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true,
            },
            item: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true,
            },
            count: { type: Number, required: true },
        },
    ],
    deliveryLocation: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        address: { type: String },
    },
    pickupLocation: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
        address: { type: String },
    },
    deliveryPersonLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        address: { type: String },
    },
    deliveryAddressSnapshot: {
        addressId: { type: mongoose.Schema.Types.ObjectId },
        label: { type: String },
        houseNumber: { type: String },
        street: { type: String },
        landmark: { type: String },
        city: { type: String },
        state: { type: String },
        pincode: { type: String },
    },
    sellerResponse: {
        status: {
            type: String,
            enum: ['pending', 'accepted', 'rejected'],
            default: 'pending'
        },
        responseTime: { type: Date },
        rejectionReason: { type: String }
    },
    status: {
        type: String,
        enum: ['pending_seller_approval', 'seller_rejected', 'available', 'confirmed', 'arriving', 'delivered', 'cancelled'],
        default: 'pending_seller_approval',
    },
    delivery_charges: {
        final_fee: { type: Number, required: true },
        agent_payout: { type: Number, required: true },
        platform_margin: { type: Number, required: true },
        applied_config_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryConfiguration' },

        breakdown: {
            type: {
                type: String,
                enum: ['calculated', 'fallback', 'manual_override'],
                default: 'calculated'
            },
            base_fare: { type: Number, default: 0 },
            distance_surcharge: { type: Number, default: 0 },
            small_order_surcharge: { type: Number, default: 0 },
            surge_applied: { type: Number, default: 1.0 },
            distance_km: { type: Number, default: 0 }
        }
    },
    totalPrice: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    deliveryPartnerEarnings: { type: Number, default: 0 },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findOneAndUpdate({ name: sequenceName }, { $inc: { sequence_value: 1 } }, { new: true, upsert: true });
    return sequenceDocument.sequence_value;
}
orderSchema.pre('save', async function (next) {
    if (this.isNew) {
        const sequenceValue = await getNextSequenceValue('orderId');
        this.orderId = `ORDR${sequenceValue.toString().padStart(5, '0')}`;
    }
    next();
});
const Order = mongoose.model('Order', orderSchema);
export default Order;
