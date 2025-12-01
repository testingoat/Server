import mongoose from "mongoose";

// Base User Schema

const userSchema = new mongoose.Schema({
    name: { type: String },
    role: {
        type: String,
        enum: ["Customer", "Admin", "DeliveryPartner", "Seller"],
        required: true,
    },
    isActivated: { type: Boolean, default: false }
})

// Customer Schema

const customerSchema = new mongoose.Schema({
    ...userSchema.obj,
    phone: { type: Number, required: true, unique: true },
    role: { type: String, enum: ["Customer"], default: "Customer" },
    fcmToken: { type: String },
    fcmTokenUpdatedAt: { type: Date },
    fcmTokens: [{
        token: { type: String, required: true },
        platform: { type: String, enum: ['android', 'ios'], default: 'android' },
        deviceInfo: { type: mongoose.Schema.Types.Mixed },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],
    liveLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
    },
    address: { type: String },
}, {
    timestamps: true
})

// Delivery Partner Schema
const deliveryPartnerSchema = new mongoose.Schema({
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: false },
    phone: { type: Number, required: true, unique: true },
    role: { type: String, enum: ["DeliveryPartner"], default: "DeliveryPartner" },
    liveLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
    },
    address: { type: String },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
    },
    // Approval fields (similar to Seller)
    isVerified: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
    approvedAt: { type: Date },
    approvedBy: { type: String },
    rejectionReason: { type: String },
    // Additional profile fields for delivery partners
    vehicleType: { type: String, enum: ['bike', 'scooter', 'car', 'bicycle'], default: 'bike' },
    vehicleNumber: { type: String },
    drivingLicenseNumber: { type: String },
    bloodGroup: { type: String },
    aadharNumber: { type: String },
    panNumber: { type: String },
    bankAccountNumber: { type: String },
    ifscCode: { type: String },
    bankName: { type: String },
    fcmToken: { type: String },
    fcmTokenUpdatedAt: { type: Date },
    emergencyContact: {
        name: { type: String },
        phone: { type: String },
        relation: { type: String }
    },
    fcmTokens: [{
        token: { type: String, required: true },
        platform: { type: String, enum: ['android', 'ios'], default: 'android' },
        deviceInfo: { type: mongoose.Schema.Types.Mixed },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],
}, {
    timestamps: true
});

// Admin Schema
const adminSchema = new mongoose.Schema({
    ...userSchema.obj,
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: false },
    role: { type: String, enum: ["Admin"], default: "Admin" },
}, {
    timestamps: true
});

// Seller Schema
const sellerSchema = new mongoose.Schema({
    ...userSchema.obj,
    phone: { type: Number, required: true, unique: true },
    email: { type: String },
    role: { type: String, enum: ['Seller'], default: 'Seller' },
    storeName: { type: String },
    storeAddress: { type: String },
    city: { type: String },
    pincode: { type: String },
    gstNumber: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    storeContact: { type: String },
    storeWebsite: { type: String },
    businessHours: {
        open: { type: String },
        close: { type: String }
    },
    deliveryAreas: [{ type: String }],
    isVerified: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
    fcmToken: { type: String },
    fcmTokenUpdatedAt: { type: Date },
    fcmTokens: [{
        token: { type: String, required: true },
        platform: { type: String, enum: ['android', 'ios'], default: 'android' },
        deviceInfo: { type: mongoose.Schema.Types.Mixed },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],
    liveLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
    },
    address: { type: String },
    storeLocation: {
        latitude: { type: Number },
        longitude: { type: Number },
        address: { type: String },
        isSet: { type: Boolean, default: false }
    },
    deliveryArea: {
        radius: {
            type: Number,
            min: 0,
            max: 20,
            default: 5, // Default 5 km radius
            required: false
        },
        unit: {
            type: String,
            enum: ['km', 'miles'],
            default: 'km'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    // PLACEHOLDER for future polygon-based delivery areas
    deliveryPolygon: {
        type: {
            type: String,
            enum: ['Polygon'],
            default: 'Polygon'
        },
        coordinates: {
            type: [[[Number]]], // GeoJSON polygon format
            required: false
        }
    },
}, {
    timestamps: true
});

// Add geospatial index for location-based queries (future use)
sellerSchema.index({ 'storeLocation.coordinates': '2dsphere' });

export const Customer = mongoose.model("Customer", customerSchema);
export const DeliveryPartner = mongoose.model(
    "DeliveryPartner",
    deliveryPartnerSchema
);
export const Admin = mongoose.model("Admin", adminSchema);
export const Seller = mongoose.model('Seller', sellerSchema);

