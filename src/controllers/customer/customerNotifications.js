import { CustomerNotification } from '../../models/index.js';

const ensureCustomer = (req, reply) => {
    const { user, userId, role } = req || {};
    const resolvedRole = role || req?.user?.role;
    const resolvedUserId = userId || req?.user?.userId;

    if (!resolvedUserId || resolvedRole !== 'Customer') {
        reply.status(403).send({
            success: false,
            message: 'Access denied. Customer role required'
        });
        return null;
    }
    return resolvedUserId;
};

export const getCustomerNotifications = async (req, reply) => {
    try {
        const customerId = ensureCustomer(req, reply);
        if (!customerId) return;

        const page = Math.max(1, parseInt(req.query?.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            CustomerNotification.find({ user: customerId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CustomerNotification.countDocuments({ user: customerId })
        ]);

        reply.send({
            success: true,
            data: notifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('Get customer notifications error:', error);
        reply.status(500).send({
            success: false,
            message: 'Failed to load notifications'
        });
    }
};

export const markCustomerNotificationRead = async (req, reply) => {
    try {
        const customerId = ensureCustomer(req, reply);
        if (!customerId) return;

        const { notificationId } = req.params || {};
        if (!notificationId) {
            reply.status(400).send({ success: false, message: 'Notification ID is required' });
            return;
        }

        const notification = await CustomerNotification.findOneAndUpdate(
            { _id: notificationId, user: customerId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            reply.status(404).send({ success: false, message: 'Notification not found' });
            return;
        }

        reply.send({ success: true, data: notification });
    } catch (error) {
        console.error('Mark customer notification read error:', error);
        reply.status(500).send({
            success: false,
            message: 'Failed to update notification'
        });
    }
};

export const deleteCustomerNotification = async (req, reply) => {
    try {
        const customerId = ensureCustomer(req, reply);
        if (!customerId) return;

        const { notificationId } = req.params || {};
        if (!notificationId) {
            reply.status(400).send({ success: false, message: 'Notification ID is required' });
            return;
        }

        const result = await CustomerNotification.findOneAndDelete({
            _id: notificationId,
            user: customerId
        });

        if (!result) {
            reply.status(404).send({ success: false, message: 'Notification not found' });
            return;
        }

        reply.send({ success: true });
    } catch (error) {
        console.error('Delete customer notification error:', error);
        reply.status(500).send({
            success: false,
            message: 'Failed to delete notification'
        });
    }
};

export const clearCustomerNotifications = async (req, reply) => {
    try {
        const customerId = ensureCustomer(req, reply);
        if (!customerId) return;

        await CustomerNotification.deleteMany({ user: customerId });
        reply.send({ success: true });
    } catch (error) {
        console.error('Clear customer notifications error:', error);
        reply.status(500).send({
            success: false,
            message: 'Failed to clear notifications'
        });
    }
};

export const markAllCustomerNotificationsRead = async (req, reply) => {
    try {
        const customerId = ensureCustomer(req, reply);
        if (!customerId) return;

        await CustomerNotification.updateMany(
            { user: customerId, read: false },
            { read: true }
        );

        reply.send({ success: true });
    } catch (error) {
        console.error('Mark all customer notifications read error:', error);
        reply.status(500).send({
            success: false,
            message: 'Failed to update notifications'
        });
    }
};
