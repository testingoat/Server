import mongoose from 'mongoose';
// Create a simple monitoring schema for AdminJS integration
const monitoringSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'Server Monitoring Dashboard'
    },
    description: {
        type: String,
        default: 'Real-time server health and performance metrics'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        default: 'active'
    }
}, {
    timestamps: true
});
// Create a virtual monitoring entry
monitoringSchema.statics.getMonitoringData = function () {
    return {
        _id: '507f1f77bcf86cd799439011', // Fixed ID for consistency
        name: 'Server Monitoring Dashboard',
        description: 'Click "View Dashboard" to access real-time monitoring',
        lastUpdated: new Date(),
        status: 'active'
    };
};
export const Monitoring = mongoose.model('Monitoring', monitoringSchema);
