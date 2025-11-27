import mongoose from 'mongoose';

const slabSchema = new mongoose.Schema(
  {
    minOrderValue: { type: Number, required: true },
    maxOrderValue: { type: Number, default: null }, // null = unlimited
    baseFee: { type: Number, required: true, min: 0 },
    percentageFee: { type: Number, required: true, min: 0, max: 1 },
    description: { type: String, required: true },
  },
  { _id: false }
);

const deliveryFeeConfigSchema = new mongoose.Schema(
  {
    slabs: {
      type: [slabSchema],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'At least one slab is required',
      },
      required: true,
    },
    partnerEarningsPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.8,
    },
    isActive: { type: Boolean, required: true, default: false, index: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// Validate slab continuity and overlaps before save
deliveryFeeConfigSchema.pre('save', async function (next) {
  try {
    const slabs = [...this.slabs].sort((a, b) => a.minOrderValue - b.minOrderValue);

    // First slab must start at 0
    if (slabs[0].minOrderValue !== 0) {
      return next(new Error('First slab must start at 0'));
    }

    // Last slab must have maxOrderValue null (unlimited)
    if (slabs[slabs.length - 1].maxOrderValue !== null) {
      return next(new Error('Last slab must have maxOrderValue = null (unlimited)'));
    }

    for (let i = 0; i < slabs.length - 1; i++) {
      const cur = slabs[i];
      const nxt = slabs[i + 1];
      if (cur.maxOrderValue == null) {
        return next(new Error('Only the last slab can have maxOrderValue = null'));
      }
      // No overlaps
      if (cur.maxOrderValue >= nxt.minOrderValue) {
        return next(new Error('Slab ranges must not overlap'));
      }
      // No gaps (next.min === current.max + 1)
      if (nxt.minOrderValue !== cur.maxOrderValue + 1) {
        return next(new Error('Slab ranges must be continuous without gaps'));
      }
    }

    // Warn on extreme partner percentage
    if (this.partnerEarningsPercentage < 0.5 || this.partnerEarningsPercentage > 0.95) {
      console.warn(
        '⚠️ Partner earnings percentage is outside recommended range:',
        this.partnerEarningsPercentage
      );
    }

    // Ensure only one active config
    if (this.isActive) {
      await this.constructor.updateMany({ _id: { $ne: this._id } }, { $set: { isActive: false } });
    }

    next();
  } catch (err) {
    next(err);
  }
});

// Static: get active config
deliveryFeeConfigSchema.statics.getActiveConfig = function () {
  return this.findOne({ isActive: true });
};

// Instance helpers
deliveryFeeConfigSchema.methods.activate = async function () {
  await this.constructor.updateMany({}, { $set: { isActive: false } });
  this.isActive = true;
  await this.save();
  return this;
};

const DeliveryFeeConfig = mongoose.model('DeliveryFeeConfig', deliveryFeeConfigSchema);
export default DeliveryFeeConfig;
