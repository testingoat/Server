import mongoose from 'mongoose';
const notificationLogSchema = new mongoose.Schema({
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: () => new mongoose.Types.ObjectId('000000000000000000000000')
    },
    sentByEmail: { type: String, default: 'system@goatgoat.com' },
    targeting: {
        type: String,
        enum: ['all', 'buyers', 'sellers', 'delivery', 'custom'],
        required: true
    },
    filters: {
        roles: [{ type: String }],
        userIds: [{ type: String }],
        customQuery: { type: mongoose.Schema.Types.Mixed }
    },
    payload: {
        title: { type: String, required: true },
        body: { type: String, required: true },
        imageUrl: { type: String },
        data: { type: mongoose.Schema.Types.Mixed },
        clickAction: { type: String }
    },
    options: {
        dryRun: { type: Boolean, default: false },
        batchSize: { type: Number, default: 500 },
        scheduleAt: { type: Date }
    },
    status: {
        type: String,
        enum: ['queued', 'running', 'success', 'partial', 'failed', 'cancelled'],
        default: 'queued'
    },
    totals: {
        intendedCount: { type: Number, default: 0 },
        sentCount: { type: Number, default: 0 },
        failureCount: { type: Number, default: 0 }
    },
    errorSummary: { type: String },
    errors: [{
            message: String,
            count: Number,
            timestamp: Date
        }],
    startedAt: { type: Date },
    completedAt: { type: Date },
    queueJobId: { type: String }
}, {
    timestamps: true
});
notificationLogSchema.index({ status: 1, createdAt: -1 });
notificationLogSchema.index({ sentBy: 1, createdAt: -1 });
notificationLogSchema.index({ targeting: 1, createdAt: -1 });
export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
