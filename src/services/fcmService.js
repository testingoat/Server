import { admin } from '../config/firebase-admin.js';
import { Customer, DeliveryPartner } from '../models/index.js';

const pruneInvalidTokenForModel = async (Model, token, timestamp) => {
    const docs = await Model.find({
        $or: [
            { 'fcmTokens.token': token },
            { fcmToken: token }
        ]
    }).select('fcmTokens fcmToken fcmTokenUpdatedAt');

    if (!docs.length) {
        return;
    }

    await Promise.all(
        docs.map(async (doc) => {
            const tokenEntries = Array.isArray(doc.fcmTokens) ? doc.fcmTokens : [];
            const filteredEntries = tokenEntries.filter(entry => entry?.token && entry.token !== token);
            const tokensChanged = filteredEntries.length !== tokenEntries.length;
            const primaryChanged = doc.fcmToken === token;

            if (!tokensChanged && !primaryChanged) {
                return;
            }

            doc.fcmTokens = filteredEntries;
            if (primaryChanged) {
                doc.fcmToken = filteredEntries[0]?.token || null;
            }
            doc.fcmTokenUpdatedAt = timestamp;
            await doc.save();
        })
    );
};

const pruneInvalidUserTokens = async (token) => {
    const timestamp = new Date();
    await Promise.all([
        pruneInvalidTokenForModel(Customer, token, timestamp),
        pruneInvalidTokenForModel(DeliveryPartner, token, timestamp)
    ]);
};
/**
 * Send push notification to a single FCM token
 */
export const sendPushNotification = async (fcmToken, payload) => {
    try {
        if (!admin.apps.length) {
            throw new Error('Firebase Admin not initialized');
        }
        const message = {
            token: fcmToken,
            notification: {
                title: payload.title,
                body: payload.body,
                // Use imageUrl to match existing Customer/Seller implementation
                ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
            },
            data: payload.data || {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'goatgoat_notifications',
                },
            },
        };
        const response = await admin.messaging().send(message);
        console.log('✅ Push notification sent successfully:', response);
        return { success: true, messageId: response };
    }
    catch (error) {
        console.error('❌ Failed to send push notification:', {
            message: error?.message,
            code: error?.code,
        });
        return { success: false, error: error.message, code: error.code };
    }
};
/**
 * Send push notifications to multiple FCM tokens
 */
export const sendBulkPushNotifications = async (fcmTokens, payload) => {
    try {
        if (!admin.apps.length) {
            throw new Error('Firebase Admin not initialized');
        }
        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
                // Use imageUrl so FCM can render rich notifications
                ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
            },
            data: payload.data || {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'goatgoat_notifications',
                },
            },
            tokens: fcmTokens,
        };
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`✅ Bulk notifications sent: ${response.successCount}/${fcmTokens.length}`);

        if (response.failureCount > 0) {
            const errorSummaries = response.responses
                .map((r, idx) => r.error ? { index: idx, code: r.error.code, message: r.error.message } : null)
                .filter(Boolean);
            console.warn('⚠️ FCM bulk send failures:', errorSummaries.slice(0, 5));

            // Prune permanently invalid tokens
            const permanentErrorCodes = new Set([
                'messaging/registration-token-not-registered',
                'messaging/invalid-registration-token'
            ]);

            await Promise.all(
                response.responses.map(async (res, idx) => {
                    if (!res.error) return;
                    if (!permanentErrorCodes.has(res.error.code)) return;

                    const badToken = fcmTokens[idx];
                    try {
                        const tokenPreview = (badToken || '').substring(0, 20);
                        console.warn('[FCM] Removing invalid token:', tokenPreview + '...', res.error.code);
                        await pruneInvalidUserTokens(badToken);
                    } catch (cleanupError) {
                        console.error('[FCM] Failed to prune invalid FCM token:', cleanupError);
                    }
                })
            );
        }

        return {
            success: response.failureCount === 0,
            successCount: response.successCount,
            failureCount: response.failureCount,
            results: response.responses,
        };
    }
    catch (error) {
        console.error('❌ Failed to send bulk push notifications:', error);
        return { success: false, successCount: 0, failureCount: fcmTokens.length, results: [] };
    }
};
/**
 * Send notification to topic subscribers
 */
export const sendTopicNotification = async (topic, payload) => {
    try {
        if (!admin.apps.length) {
            throw new Error('Firebase Admin not initialized');
        }
        const message = {
            topic,
            notification: {
                title: payload.title,
                body: payload.body,
                ...(payload.imageUrl && { image: payload.imageUrl }),
            },
            data: payload.data || {},
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'goatgoat_notifications',
                },
            },
        };
        const response = await admin.messaging().send(message);
        console.log('✅ Topic notification sent successfully:', response);
        return { success: true, messageId: response };
    }
    catch (error) {
        console.error('❌ Failed to send topic notification:', error);
        return { success: false, error: error.message };
    }
};
/**
 * Subscribe tokens to a topic
 */
export const subscribeToTopic = async (fcmTokens, topic) => {
    try {
        if (!admin.apps.length) {
            throw new Error('Firebase Admin not initialized');
        }
        const response = await admin.messaging().subscribeToTopic(fcmTokens, topic);
        console.log(`✅ Subscribed ${response.successCount}/${fcmTokens.length} tokens to topic: ${topic}`);
        return {
            success: true,
            successCount: response.successCount,
            errors: response.errors,
        };
    }
    catch (error) {
        console.error('❌ Failed to subscribe to topic:', error);
        return { success: false, successCount: 0, errors: [error] };
    }
};
/**
 * Get FCM tokens for users by role and IDs
 */
export const getUserFCMTokens = async (userIds, role) => {
    try {
        const Model = role === 'Customer' ? Customer : DeliveryPartner;
        const users = await Model.find({ _id: { $in: userIds }, fcmToken: { $exists: true, $ne: null } }, { fcmToken: 1 });
        return users.map((user) => user.fcmToken).filter((token) => token);
    }
    catch (error) {
        console.error('❌ Failed to get user FCM tokens:', error);
        return [];
    }
};
/**
 * Validate FCM token format
 */
export const validateFCMToken = (token) => {
    // Basic FCM token validation (tokens are typically 152+ characters)
    return typeof token === 'string' && token.length > 100 && /^[A-Za-z0-9_-]+$/.test(token);
};
