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

const homeOfferSectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  titleVariant: { type: String, enum: ['h3', 'h4', 'h5'], default: 'h4' },
  titleColor: { type: String, default: '#222222' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  productIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  seeAllLabel: { type: String, default: 'See all' },
  seeAllDeepLink: { type: String },
  showAddButton: { type: Boolean, default: true },
  showDiscountBadge: { type: Boolean, default: true },
}, { _id: false });

const homeBannerStripSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  deepLink: { type: String },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { _id: false });

// Flash Deals Section - Products with countdown timer
const homeFlashDealsSectionSchema = new mongoose.Schema({
  title: { type: String, required: true, default: '⚡ Flash Deals' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  endTime: { type: Date, required: true }, // Countdown target
  productIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
}, { _id: false });

// Trending Section - Best sellers/popular products
const homeTrendingSectionSchema = new mongoose.Schema({
  title: { type: String, required: true, default: '🔥 Trending Now' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  productIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  // Optional: manual sold counts per product (index matches productIds)
  soldCounts: { type: [Number], default: [] },
}, { _id: false });

const homeConfigSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: true },
  layoutVersion: { type: Number, default: 1 },
  bannerCarousel: { type: [homeBannerSchema], default: [] },
  bannerStrips: { type: [homeBannerStripSchema], default: [] },
  offerSections: { type: [homeOfferSectionSchema], default: [] },
  categoryGrids: { type: [homeCategoryGridSchema], default: [] },
  flashDealsSections: { type: [homeFlashDealsSectionSchema], default: [] },
  trendingSections: { type: [homeTrendingSectionSchema], default: [] },
}, { timestamps: true });

homeConfigSchema.index({ isActive: 1, updatedAt: -1 });

const HomeConfig = mongoose.model('HomeConfig', homeConfigSchema);
export default HomeConfig;

