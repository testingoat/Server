import mongoose from 'mongoose';

const deliveryConfigurationSchema = new mongoose.Schema({
    city: {
        type: String,
        required: true,
        index: true,
        trim: true,
        uppercase: true
    },
    vehicle_type: {
        type: String,
        enum: ['Bike', 'Scooter', 'Electric Bike', 'Van', 'Truck'],
        default: 'Bike',
        required: true
    },

    // --- Platform Earnings (Customer Charge) ---
    base_fare: {
        type: Number,
        required: true,
        min: 0,
        comment: "Fixed fee for the initial distance"
    },
    base_distance: {
        type: Number,
        required: true,
        min: 0,
        comment: "Distance in KM covered by base_fare"
    },
    extra_per_km: {
        type: Number,
        required: true,
        min: 0,
        comment: "Charge per KM after base_distance"
    },

    // --- Agent Earnings (Driver Pay) ---
    agent_base_payout: {
        type: Number,
        required: true,
        min: 20, // Wage protection
        comment: "Fixed amount paid to driver per order"
    },
    agent_per_km: {
        type: Number,
        default: 5,
        comment: "Additional payment per KM to driver"
    },

    // --- Modifiers ---
    surge_multiplier: {
        type: Number,
        default: 1.0,
        min: 1.0,
        max: 2.0, // HARD SAFETY CAP
        comment: "Multiplies total delivery fee. 1.0 = Normal, 1.5 = Rain"
    },

    // --- Constraints ---
    max_delivery_distance: {
        type: Number,
        default: 15,
        comment: "Orders beyond this distance are rejected"
    },

    // --- Unit Economics ---
    min_order_value: {
        type: Number,
        default: 0,
        comment: "Cart value below which small_order_fee applies"
    },
    small_order_fee: {
        type: Number,
        default: 0,
        comment: "Surcharge added if cart < min_order_value"
    },

    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'delivery_configurations'
});

// Prevent duplicate active rules for same City + Vehicle
deliveryConfigurationSchema.index({ city: 1, vehicle_type: 1 }, { unique: true });

const DeliveryConfiguration = mongoose.model('DeliveryConfiguration', deliveryConfigurationSchema);
export default DeliveryConfiguration;
