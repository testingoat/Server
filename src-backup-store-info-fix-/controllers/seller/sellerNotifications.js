import Notification from '../../models/notification.js';

export const getSellerNotifications = async (request, reply) => {
  try {
    const { userId, role } = request.user;
    
    if (role !== 'Seller') {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. Only sellers can access notifications.',
      });
    }

    const notifications = await Notification.find({ sellerId: userId })
      .sort({ createdAt: -1 })
      .select('title message type icon isRead createdAt data');

    const unreadCount = await Notification.countDocuments({ 
      sellerId: userId, 
      isRead: false 
    });

    return reply.send({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('Get seller notifications error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const markNotificationAsRead = async (request, reply) => {
  try {
    const { userId, role } = request.user;
    const { id } = request.params;

    if (role !== 'Seller') {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. Only sellers can modify notifications.',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, sellerId: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return reply.status(404).send({
        success: false,
        message: 'Notification not found.',
      });
    }

    return reply.send({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteNotification = async (request, reply) => {
  try {
    const { userId, role } = request.user;
    const { id } = request.params;

    if (role !== 'Seller') {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. Only sellers can delete notifications.',
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      sellerId: userId,
    });

    if (!notification) {
      return reply.status(404).send({
        success: false,
        message: 'Notification not found.',
      });
    }

    return reply.send({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const markAllNotificationsAsRead = async (request, reply) => {
  try {
    const { userId, role } = request.user;

    if (role !== 'Seller') {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. Only sellers can modify notifications.',
      });
    }

    const result = await Notification.updateMany(
      { sellerId: userId, isRead: false },
      { isRead: true }
    );

    return reply.send({
      success: true,
      message: 'Marked ' + result.modifiedCount + ' notifications as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error',
    });
  }
};
