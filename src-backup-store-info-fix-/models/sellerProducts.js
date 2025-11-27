import mongoose from 'mongoose';
// This is a virtual model for AdminJS to show seller products with approval workflow
const sellerProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    discountPrice: { type: Number },
    quantity: { type: String, required: true },
    description: { type: String },
    stock: { type: Number, default: 0 },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    isActive: { type: Boolean, default: true },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    approvedAt: { type: Date },
    rejectionReason: { type: String }
}, {
    timestamps: true,
    collection: 'products' // Use the same collection as products
});
// Index for efficient queries
sellerProductSchema.index({ seller: 1, status: 1 });
sellerProductSchema.index({ status: 1 });
const SellerProduct = mongoose.model('SellerProduct', sellerProductSchema);
export default SellerProduct;
