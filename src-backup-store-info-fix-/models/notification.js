import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['order', 'stock', 'payment', 'system', 'update'],
    default: 'system',
  },
  icon: {
    type: String,
    default: 'notifications',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  }
}, {
  timestamps: true,
});

// Index for better query performance
notificationSchema.index({ sellerId: 1, createdAt: -1 });
notificationSchema.index({ sellerId: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
