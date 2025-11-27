import Order from '../../models/order.js';
import Branch from '../../models/branch.js';
import { Seller } from '../../models/user.js';

// Get all orders for a specific seller
export const getSellerOrders = async (req, reply) => {
  try {
    const { userId } = req.user;
    const { status, page = 1, limit = 10 } = req.query;

    // Verify seller exists
    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({ message: 'Seller not found' });
    }

    // Build query
    let query = { seller: userId };
    if (status) {
      query.status = status;
    }

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate('customer', 'name phone')
      .populate('branch', 'name address')
      .populate('items.item', 'name price')
      .populate('deliveryPartner', 'name phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalOrders = await Order.countDocuments(query);

    return reply.send({
      orders,
      totalOrders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: page
    });

  } catch (error) {
    console.error('Error fetching seller orders:', error);
    return reply.status(500).send({ message: 'Failed to fetch orders', error: error.message });
  }
};

// Get pending orders for seller approval
export const getPendingOrders = async (req, reply) => {
  try {
    const { userId } = req.user;

    // Verify seller exists
    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({ message: 'Seller not found' });
    }

    // Get pending orders
    const orders = await Order.find({ 
      seller: userId, 
      status: 'pending_seller_approval' 
    })
      .populate('customer', 'name phone address')
      .populate('branch', 'name address')
      .populate('items.item', 'name price')
      .sort({ createdAt: -1 });

    return reply.send({ orders });

  } catch (error) {
    console.error('Error fetching pending orders:', error);
    return reply.status(500).send({ message: 'Failed to fetch pending orders', error: error.message });
  }
};

// Accept an order
export const acceptOrder = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.user;

    // Verify seller exists
    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({ message: 'Seller not found' });
    }

    // Find and verify order
    const order = await Order.findById(orderId);
    if (!order) {
      return reply.status(404).send({ message: 'Order not found' });
    }

    // Verify order belongs to this seller
    if (order.seller.toString() !== userId) {
      return reply.status(403).send({ message: 'Unauthorized: Order does not belong to this seller' });
    }

    // Verify order is in pending state
    if (order.status !== 'pending_seller_approval') {
      return reply.status(400).send({ message: 'Order is not pending approval' });
    }

    // Update order status
    order.status = 'available';
    order.sellerResponse.status = 'accepted';
    order.sellerResponse.responseTime = new Date();
    order.updatedAt = new Date();

    await order.save();

    // Emit socket event for real-time updates
    if (req.server.io) {
      req.server.io.to(orderId).emit('orderAccepted', order);
    }

    return reply.send({ 
      message: 'Order accepted successfully', 
      order 
    });

  } catch (error) {
    console.error('Error accepting order:', error);
    return reply.status(500).send({ message: 'Failed to accept order', error: error.message });
  }
};

// Reject an order
export const rejectOrder = async (req, reply) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.user;
    const { rejectionReason } = req.body;

    // Verify seller exists
    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({ message: 'Seller not found' });
    }

    // Find and verify order
    const order = await Order.findById(orderId);
    if (!order) {
      return reply.status(404).send({ message: 'Order not found' });
    }

    // Verify order belongs to this seller
    if (order.seller.toString() !== userId) {
      return reply.status(403).send({ message: 'Unauthorized: Order does not belong to this seller' });
    }

    // Verify order is in pending state
    if (order.status !== 'pending_seller_approval') {
      return reply.status(400).send({ message: 'Order is not pending approval' });
    }

    // Update order status
    order.status = 'seller_rejected';
    order.sellerResponse.status = 'rejected';
    order.sellerResponse.responseTime = new Date();
    order.sellerResponse.rejectionReason = rejectionReason || 'No reason provided';
    order.updatedAt = new Date();

    await order.save();

    // Emit socket event for real-time updates
    if (req.server.io) {
      req.server.io.to(orderId).emit('orderRejected', { order, reason: rejectionReason });
    }

    return reply.send({ 
      message: 'Order rejected successfully', 
      order 
    });

  } catch (error) {
    console.error('Error rejecting order:', error);
    return reply.status(500).send({ message: 'Failed to reject order', error: error.message });
  }
};

// Get seller dashboard metrics
export const getDashboardMetrics = async (req, reply) => {
  try {
    const { userId } = req.user;

    // Verify seller exists
    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({ message: 'Seller not found' });
    }

    // Get current date ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Aggregate metrics
    const [
      totalOrders,
      pendingOrders,
      todayOrders,
      todayRevenue,
      monthlyRevenue,
      orderStatusBreakdown,
      recentOrders
    ] = await Promise.all([
      // Total orders
      Order.countDocuments({ seller: userId }),
      
      // Pending orders
      Order.countDocuments({ seller: userId, status: 'pending_seller_approval' }),
      
      // Today's orders
      Order.countDocuments({ 
        seller: userId, 
        createdAt: { $gte: today, $lt: tomorrow } 
      }),
      
      // Today's revenue
      Order.aggregate([
        { 
          $match: { 
            seller: userId, 
            status: 'delivered',
            createdAt: { $gte: today, $lt: tomorrow }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      
      // Monthly revenue
      Order.aggregate([
        { 
          $match: { 
            seller: userId, 
            status: 'delivered',
            createdAt: { $gte: thisMonth, $lt: nextMonth }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      
      // Order status breakdown
      Order.aggregate([
        { $match: { seller: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // Recent orders
      Order.find({ seller: userId })
        .populate('customer', 'name')
        .populate('items.item', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    // Format metrics
    const metrics = {
      totalOrders,
      pendingOrders,
      todayOrders,
      todayRevenue: todayRevenue[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      orderStatusBreakdown: orderStatusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentOrders
    };

    return reply.send({ metrics });

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return reply.status(500).send({ message: 'Failed to fetch dashboard metrics', error: error.message });
  }
};
