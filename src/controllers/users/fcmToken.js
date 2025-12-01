import { Customer, DeliveryPartner } from '../../models/index.js';

export const upsertFcmToken = async (req, reply) => {
    try {
        const { fcmToken, platform = 'android', deviceInfo = {} } = req.body || {};
        
        if (!fcmToken) {
            return reply.status(400).send({ success: false, message: 'fcmToken is required' });
        }

        const { userId, role } = req.user || {};
        
        if (!userId || !role) {
            return reply.status(401).send({ success: false, message: 'Unauthorized' });
        }

        const Model = role === 'Customer' ? Customer : role === 'DeliveryPartner' ? DeliveryPartner : null;
        
        if (!Model) {
            return reply.status(400).send({ success: false, message: 'Unsupported user role' });
        }

        // Find the user
        const user = await Model.findById(userId);
        
        if (!user) {
            return reply.status(404).send({ success: false, message: 'User not found' });
        }

        user.fcmToken = fcmToken;
        user.fcmTokenUpdatedAt = new Date();

        // Check if token already exists
        const existingTokenIndex = user.fcmTokens?.findIndex(t => t.token === fcmToken);
        
        if (existingTokenIndex !== undefined && existingTokenIndex >= 0) {
            // Update existing token
            user.fcmTokens[existingTokenIndex] = {
                token: fcmToken,
                platform,
                deviceInfo,
                createdAt: user.fcmTokens[existingTokenIndex].createdAt,
                updatedAt: new Date()
            };
        } else {
            // Add new token
            if (!user.fcmTokens) {
                user.fcmTokens = [];
            }
            user.fcmTokens.push({
                token: fcmToken,
                platform,
                deviceInfo,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        await user.save();

        return reply.send({ 
            success: true, 
            message: 'FCM token updated',
            tokenCount: user.fcmTokens.length
        });
    }
    catch (err) {
        console.error('FCM token update error:', err);
        return reply.status(500).send({ success: false, message: 'Internal server error' });
    }
};
