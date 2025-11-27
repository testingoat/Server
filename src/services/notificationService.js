// Import required modules
// Note: User models imported only when needed for push notifications
import Fast2SMSService from './fast2sms.js'; // Adjust the path as needed
/**
 * Send SMS notification via Fast2SMS
 * @param {string|string[]} phoneNumbers - Phone number(s) to send SMS to
 * @param {string} message - SMS message content
 * @param {Object} options - Additional options for SMS
 */
export const sendSMSNotification = async (phoneNumbers, message, _options = {}) => {
    try {
        // Convert single phone number to array
        const numbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];
        // Send SMS via Fast2SMS service
        // Using the sendConfiguredOTP method which handles both DLT and standard routes
        const results = [];
        for (const number of numbers) {
            // For bulk sending, we'll send individual messages
            // In a real implementation, you might want to use a bulk sending method if available
            const response = await Fast2SMSService.sendConfiguredOTP(number, message);
            results.push(response);
        }
        // Check if all messages were sent successfully
        const allSuccessful = results.every(result => result.success);
        if (allSuccessful) {
            console.log('SMS sent successfully via Fast2SMS');
            return { success: true, message: 'SMS sent successfully', results };
        }
        else {
            const failedResults = results.filter(result => !result.success);
            console.error('Failed to send some SMS via Fast2SMS:', failedResults);
            return { success: false, message: 'Some SMS failed to send', results };
        }
    }
    catch (error) {
        console.error('Error sending SMS notification:', error);
        return { success: false, message: error.message };
    }
};
/**
 * Send both SMS notifications (placeholder for push notifications)
 * @param {string[]} userIds - Array of user IDs
 * @param {string|string[]} phoneNumbers - Phone number(s)
 * @param {string} title - Notification title (unused for SMS)
 * @param {string} body - Notification body
 * @param {string} smsMessage - SMS message content
 */
export const sendMultiChannelNotification = async (userIds, phoneNumbers, title, body, smsMessage) => {
    try {
        // For now, we'll just send SMS notifications
        // In a full implementation, you would also send push notifications
        // Send SMS notifications
        const smsResult = await sendSMSNotification(phoneNumbers, smsMessage);
        return {
            success: true,
            smsResult,
        };
    }
    catch (error) {
        console.error('Error sending multi-channel notification:', error);
        return { success: false, message: error.message };
    }
};
