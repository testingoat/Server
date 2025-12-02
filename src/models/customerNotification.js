import mongoose from 'mongoose';

const customerNotificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    imageUrl: { type: String },
    type: {
        type: String,
        enum: ['order', 'delivery', 'promotion', 'system', 'general'],
        default: 'general'
    },
    read: { type: Boolean, default: false },
    data: { type: mongoose.Schema.Types.Mixed },
    source: { type: String, default: 'system' },
    actionUrl: { type: String },
    fcmMessageId: { type: String },
    logId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationLog'
    }
}, {
    timestamps: true
});

customerNotificationSchema.index({ user: 1, createdAt: -1 });

export const CustomerNotification = mongoose.model('CustomerNotification', customerNotificationSchema);
