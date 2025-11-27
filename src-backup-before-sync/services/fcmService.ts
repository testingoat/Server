import { admin } from '../config/firebase-admin.js';
import { Customer, DeliveryPartner } from '../models/index.js';

export interface FCMNotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
}

export interface FCMMessage {
  token?: string;
  tokens?: string[];
  topic?: string;
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data?: { [key: string]: string };
  android?: {
    priority: 'normal' | 'high';
    notification: {
      sound: string;
      channelId: string;
    };
  };
}

/**
 * Send push notification to a single FCM token
 */
export const sendPushNotification = async (
  fcmToken: string, 
  payload: FCMNotificationPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }

    const message: any = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
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
  } catch (error: any) {
    console.error('❌ Failed to send push notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notifications to multiple FCM tokens
 */
export const sendBulkPushNotifications = async (
  fcmTokens: string[],
  payload: FCMNotificationPayload
): Promise<{ success: boolean; successCount: number; failureCount: number; results: any[] }> => {
  try {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }

    const message: any = {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
      },
      data: payload.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'goatgoat_notifications',
        },
      },
      tokens: fcmTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Bulk notifications sent: ${response.successCount}/${fcmTokens.length}`);
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      results: response.responses,
    };
  } catch (error: any) {
    console.error('❌ Failed to send bulk push notifications:', error);
    return { success: false, successCount: 0, failureCount: fcmTokens.length, results: [] };
  }
};

/**
 * Send notification to topic subscribers
 */
export const sendTopicNotification = async (
  topic: string,
  payload: FCMNotificationPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    if (!admin.apps.length) {
      throw new Error('Firebase Admin not initialized');
    }

    const message: any = {
      topic,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
      },
      data: payload.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'goatgoat_notifications',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Topic notification sent successfully:', response);
    
    return { success: true, messageId: response };
  } catch (error: any) {
    console.error('❌ Failed to send topic notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe tokens to a topic
 */
export const subscribeToTopic = async (
  fcmTokens: string[],
  topic: string
): Promise<{ success: boolean; successCount: number; errors: any[] }> => {
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
  } catch (error: any) {
    console.error('❌ Failed to subscribe to topic:', error);
    return { success: false, successCount: 0, errors: [error] };
  }
};

/**
 * Get FCM tokens for users by role and IDs
 */
export const getUserFCMTokens = async (
  userIds: string[],
  role: 'Customer' | 'DeliveryPartner'
): Promise<string[]> => {
  try {
    const Model = role === 'Customer' ? Customer : DeliveryPartner;
    const users = await (Model as any).find(
      { _id: { $in: userIds }, fcmToken: { $exists: true, $ne: null } },
      { fcmToken: 1 }
    );

    return users.map((user: any) => user.fcmToken).filter((token: any) => token);
  } catch (error: any) {
    console.error('❌ Failed to get user FCM tokens:', error);
    return [];
  }
};

/**
 * Validate FCM token format
 */
export const validateFCMToken = (token: string): boolean => {
  // Basic FCM token validation (tokens are typically 152+ characters)
  return typeof token === 'string' && token.length > 100 && /^[A-Za-z0-9_-]+$/.test(token);
};
