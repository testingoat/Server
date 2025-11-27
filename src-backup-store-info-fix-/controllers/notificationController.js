import Notification from '../models/notification.js';

// Get all notifications for a seller
export const getSellerNotifications = async (request, reply) => {
  try {
    const { sellerId } = request.params;
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ sellerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments({ sellerId });
    const unreadCount = await Notification.countDocuments({ 
      sellerId, 
      isRead: false 
    });

    return reply.send({
      status: 'success',
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error getting seller notifications:', error);
    return reply.code(500).send({
      status: 'error',
      message: 'Failed to fetch notifications'
    });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (request, reply) => {
  try {
    const { notificationId } = request.params;
    
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return reply.code(404).send({
        status: 'error',
        message: 'Notification not found'
      });
    }

    return reply.send({
      status: 'success',
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return reply.code(500).send({
      status: 'error',
      message: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read for a seller
export const markAllNotificationsAsRead = async (request, reply) => {
  try {
    const { sellerId } = request.params;
    
    await Notification.updateMany(
      { sellerId, isRead: false },
      { isRead: true }
    );

    return reply.send({
      status: 'success',
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return reply.code(500).send({
      status: 'error',
      message: 'Failed to mark all notifications as read'
    });
  }
};

// Get unread notification count for a seller
export const getUnreadCount = async (request, reply) => {
  try {
    const { sellerId } = request.params;
    
    const count = await Notification.countDocuments({ 
      sellerId, 
      isRead: false 
    });

    return reply.send({
      status: 'success',
      data: { unreadCount: count }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return reply.code(500).send({
      status: 'error',
      message: 'Failed to get unread count'
    });
  }
};

// Delete a notification
export const deleteNotification = async (request, reply) => {
  try {
    const { notificationId } = request.params;
    
    const notification = await Notification.findByIdAndDelete(notificationId);

    if (!notification) {
      return reply.code(404).send({
        status: 'error',
        message: 'Notification not found'
      });
    }

    return reply.send({
      status: 'success',
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return reply.code(500).send({
      status: 'error',
      message: 'Failed to delete notification'
    });
  }
};

// Create a new notification (for testing/admin use)
export const createNotification = async (request, reply) => {
  try {
    const { sellerId, title, message, type, icon, data } = request.body;
    
    const notification = new Notification({
      sellerId,
      title,
      message,
      type,
      icon,
      data
    });

    await notification.save();

    return reply.code(201).send({
      status: 'success',
      data: notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return reply.code(500).send({
      status: 'error',
      message: 'Failed to create notification'
    });
  }
};