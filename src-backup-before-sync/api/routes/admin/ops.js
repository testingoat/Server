import { testOtpHandler } from '../../../controllers/admin/ops.js';
import NotificationService from '../../../services/notificationService.js'; // Add this import

export default async function adminOpsRoutes(fastify) {
    fastify.post('/ops/test-otp', testOtpHandler);

    // New endpoint for sending notifications
    fastify.post('/api/notifications/send', async (request, reply) => {
        try {
            const { type, target, message } = request.body;

            // Basic validation
            if (!type || !target || !message) {
                return reply.status(400).send({ success: false, message: 'Missing required fields: type, target, message' });
            }
            if (!message.body) {
                return reply.status(400).send({ success: false, message: 'Message body is required.' });
            }

            let result;
            if (type === 'push') {
                if (!message.title) {
                    return reply.status(400).send({ success: false, message: 'Push notification requires a title.' });
                }
                result = await NotificationService.sendPushNotification(
                    target.type,
                    target.value,
                    message
                );
            } else if (type === 'sms') {
                if (!Array.isArray(target.value) || target.value.length === 0) {
                    return reply.status(400).send({ success: false, message: 'SMS notification requires an array of phone numbers.' });
                }
                result = await NotificationService.sendSmsNotification(
                    target.value,
                    message.body
                );
            } else {
                return reply.status(400).send({ success: false, message: 'Invalid notification type. Must be "push" or "sms".' });
            }

            if (result.success) {
                return reply.send(result);
            } else {
                return reply.status(500).send(result);
            }
        } catch (error) {
            console.error('Error sending notification:', error);
            return reply.status(500).send({ success: false, message: 'Failed to send notification.', error: error.message });
        }
    });
}
