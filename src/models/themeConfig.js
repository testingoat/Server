import mongoose from 'mongoose';

const themeConfigSchema = new mongoose.Schema({
  isActive: { type: Boolean, default: true },
  headerGradientTop: { type: String, default: '#2D3875' },
  headerGradientBottom: { type: String, default: '#5B6EA7' },
}, { timestamps: true });

themeConfigSchema.index({ isActive: 1, updatedAt: -1 });

const ThemeConfig = mongoose.model('ThemeConfig', themeConfigSchema);
export default ThemeConfig;

