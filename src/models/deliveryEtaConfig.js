import mongoose from 'mongoose';

const deliveryEtaConfigSchema = new mongoose.Schema(
  {
    defaultPrepTimeMin: {
      type: Number,
      required: true,
      min: 0,
      default: 12,
    },
    defaultAverageSpeedKmph: {
      type: Number,
      required: true,
      min: 1,
      default: 25,
    },
    defaultServiceRadiusKm: {
      type: Number,
      required: true,
      min: 0.1,
      default: 5,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure only one active config at a time
deliveryEtaConfigSchema.pre('save', async function (next) {
  try {
    if (this.isActive) {
      await this.constructor.updateMany(
        { _id: { $ne: this._id } },
        { $set: { isActive: false } }
      );
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Static helper to get active config
deliveryEtaConfigSchema.statics.getActiveConfig = function () {
  return this.findOne({ isActive: true });
};

const DeliveryEtaConfig = mongoose.model(
  'DeliveryEtaConfig',
  deliveryEtaConfigSchema
);

export default DeliveryEtaConfig;

