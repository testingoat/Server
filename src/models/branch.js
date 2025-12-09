import mongoose from 'mongoose';
const branchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    city: {
        type: String,
        trim: true,
        uppercase: true,
    },
    location: {
        latitude: { type: Number },
        longitude: { type: Number },
    },
    address: { type: String },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: true,
    },
    deliveryPartners: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryPartner',
        },
    ],
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    serviceRadiusKm: {
        type: Number,
        min: 0,
    },
    prepTimeMin: {
        type: Number,
        min: 0,
    },
    averageSpeedKmph: {
        type: Number,
        min: 1,
    },
}, { timestamps: true });
const Branch = mongoose.model('Branch', branchSchema);
export default Branch;
