import mongoose from 'mongoose';

const homeBannerSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  deepLink: { type: String },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { _id: false });

const homeCategoryTileSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  labelOverride: { type: String },
  imageOverrideUrl: { type: String },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { _id: false });

const homeCategoryGridSchema = new mongoose.Schema({
  title: { type: String, required: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  tiles: { type: [homeCategoryTileSchema], default: [] },
}, { _id: false });

const homeConfigSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: true },
  layoutVersion: { type: Number, default: 1 },
  bannerCarousel: { type: [homeBannerSchema], default: [] },
  categoryGrids: { type: [homeCategoryGridSchema], default: [] },
}, { timestamps: true });

homeConfigSchema.index({ isActive: 1, updatedAt: -1 });

const HomeConfig = mongoose.model('HomeConfig', homeConfigSchema);
export default HomeConfig;

