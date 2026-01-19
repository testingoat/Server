import mongoose from 'mongoose';
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true },
    discountPrice: { type: Number },
    quantity: { type: String, required: true },
    description: { type: String },
    stock: { type: Number, default: 0 },

    // NEW: Additional images (up to 4 more)
    additionalImages: [{ type: String }],

    // NEW: Brand/Manufacturer info
    brand: { type: String },

    // NEW: Product specifications (key-value pairs)
    specifications: [{
        key: { type: String },
        value: { type: String }
    }],

    // NEW: Nutritional info (for food items)
    nutritionalInfo: {
        servingSize: { type: String },
        calories: { type: String },
        protein: { type: String },
        carbs: { type: String },
        fat: { type: String },
        fiber: { type: String },
    },

    // NEW: Additional product details
    highlights: [{ type: String }],
    warnings: { type: String },
    storageInstructions: { type: String },

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
productSchema.index({ name: 1 }); // Index for text-like search
const Product = mongoose.model('Product', productSchema);
export default Product;

