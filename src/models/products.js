import mongoose from 'mongoose';
const productSchema = new mongoose.Schema({
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
    timestamps: true
});
// Index for efficient queries
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ status: 1 });
productSchema.index({ category: 1, status: 1 });
const Product = mongoose.model('Product', productSchema);
export default Product;
