import mongoose from 'mongoose';

const serverMetricsSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    server: {
        uptime: Number, // in seconds
        memory: {
            rss: Number,      // bytes
            heapUsed: Number, // bytes
            heapTotal: Number // bytes
        },
        cpu: Number // percentage 0-100
    },
    requests: {
        total: Number,
        perMinute: Number
    }
}, {
    timestamps: true
});

// Create a TTL index to automatically delete records older than 7 days
// 7 days * 24 hours * 60 minutes * 60 seconds = 604800 seconds
serverMetricsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

export const ServerMetrics = mongoose.model('ServerMetrics', serverMetricsSchema);

const errorLogSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    level: { type: String, enum: ['error', 'warn', 'critical'], default: 'error' },
    message: String,
    stack: String,
    context: mongoose.Schema.Types.Mixed, // Request details, user ID, etc.
    status: { type: String, enum: ['new', 'investigating', 'resolved', 'ignored'], default: 'new' },
    resolvedBy: String,
    resolvedAt: Date
}, { timestamps: true });

errorLogSchema.index({ status: 1 });
errorLogSchema.index({ level: 1 });

export const ErrorLog = mongoose.model('ErrorLog', errorLogSchema);
