import Order from '../../models/order.js';
import Branch from '../../models/branch.js';
import { Customer, DeliveryPartner } from '../../models/user.js';
export const createOrder = async (req, reply) => {
    try {
        const { userId } = req.user;
        const { items, branch, totalPrice, deliveryLocation } = req.body;
        // Validate required fields
        if (!deliveryLocation || deliveryLocation.latitude === undefined || deliveryLocation.longitude === undefined) {
            return reply.status(400).send({ message: 'Delivery location with latitude and longitude is required' });
        }
        const customerData = await Customer.findById(userId);
        const branchData = await Branch.findById(branch).populate('seller');
        if (!customerData) {
            return reply.status(404).send({ message: 'Customer not found' });
        }
        if (!branchData) {
            return reply.status(404).send({ message: 'Branch not found' });
        }
        // Validate that branch has a seller assigned
        if (!branchData.seller) {
            return reply.status(400).send({ message: 'Branch does not have a seller assigned' });
        }
        const newOrder = new Order({
            customer: userId,
            seller: branchData.seller._id, // Set seller from branch relationship
            items: items.map((item) => ({
                id: item.id,
                item: item.item,
                count: item.count,
            })),
            branch,
            totalPrice,
            deliveryLocation: {
                latitude: deliveryLocation.latitude,
                longitude: deliveryLocation.longitude,
                address: customerData.address || 'No address available',
            },
            pickupLocation: {
                latitude: branchData.location.latitude,
                longitude: branchData.location.longitude,
                address: branchData.address || 'No address available',
            },
            // Order starts with pending_seller_approval status (default from model)
        });
        let savedOrder = await newOrder.save();
        savedOrder = await savedOrder.populate([
            { path: 'items.item' },
            { path: 'seller', select: 'name storeName' },
            { path: 'branch', select: 'name address' }
        ]);
        // Emit socket event for real-time seller notification
        if (req.server.io) {
            req.server.io.to(`seller_${branchData.seller._id}`).emit('newOrderPending', savedOrder);
        }
        return reply.status(201).send(savedOrder);
    }
    catch (error) {
        console.log(error);
        // Handle validation errors specifically
        if (error.name === 'ValidationError') {
            return reply.status(400).send({ message: 'Order validation failed', error: error.message });
        }
        return reply.status(500).send({ message: 'Failed to create order', error });
    }
};
export const confirmOrder = async (req, reply) => {
    try {
        const { orderId } = req.params;
        const { userId } = req.user;
        const { deliveryPersonLocation } = req.body;
        const deliveryPerson = await DeliveryPartner.findById(userId);
        if (!deliveryPerson) {
            return reply.status(404).send({ message: 'Delivery Person not found' });
        }
        const order = await Order.findById(orderId);
        if (!order) {
            return reply.status(404).send({ message: 'Order not found' });
        }
        // Updated condition: only 'available' orders can be confirmed (after seller acceptance)
        if (order.status !== 'available') {
            return reply.status(400).send({ message: 'Order is not available for confirmation' });
        }
        order.status = 'confirmed';
        order.deliveryPartner = userId;
        order.deliveryPersonLocation = {
            latitude: deliveryPersonLocation?.latitude,
            longitude: deliveryPersonLocation?.longitude,
            address: deliveryPersonLocation?.address || '',
        };
        req.server.io.to(orderId).emit('orderConfirmed', order);
        await order.save();
        return reply.send(order);
    }
    catch (error) {
        console.log(error);
        return reply
            .status(500)
            .send({ message: 'Failed to confirm order', error });
    }
};
export const updateOrderStatus = async (req, reply) => {
    try {
        const { orderId } = req.params;
        const { status, deliveryPersonLocation } = req.body;
        const { userId } = req.user;
        const deliveryPerson = await DeliveryPartner.findById(userId);
        if (!deliveryPerson) {
            return reply.status(404).send({ message: 'Delivery Person not found' });
        }
        const order = await Order.findById(orderId);
        if (!order) {
            return reply.status(404).send({ message: 'Order not found' });
        }
        if (['cancelled', 'delivered'].includes(order.status)) {
            return reply.status(400).send({ message: 'Order cannot be updated' });
        }
        if (order.deliveryPartner.toString() !== userId) {
            return reply.status(403).send({ message: 'Unauthorized' });
        }
        order.status = status;
        order.deliveryPersonLocation = deliveryPersonLocation;
        await order.save();
        req.server.io.to(orderId).emit('liveTrackingUpdates', order);
        return reply.send(order);
    }
    catch (error) {
        return reply
            .status(500)
            .send({ message: 'Failed to update order status', error });
    }
};
export const getOrders = async (req, reply) => {
    try {
        const { status, customerId, deliveryPartnerId, branchId } = req.query;
        let query = {};
        if (status) {
            query.status = status;
        }
        if (customerId) {
            query.customer = customerId;
        }
        if (deliveryPartnerId) {
            query.deliveryPartner = deliveryPartnerId;
            query.branch = branchId;
            // For delivery partners, only show orders that are 'available' or beyond
            // (exclude 'pending_seller_approval' and 'seller_rejected')
            if (!status) {
                query.status = { $in: ['available', 'confirmed', 'arriving', 'delivered'] };
            }
        }
        const orders = await Order.find(query).populate('customer branch items.item deliveryPartner seller');
        return reply.send(orders);
    }
    catch (error) {
        return reply
            .status(500)
            .send({ message: 'Failed to retrieve orders', error });
    }
};
export const getOrderById = async (req, reply) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).populate('customer branch items.item deliveryPartner seller');
        if (!order) {
            return reply.status(404).send({ message: 'Order not found' });
        }
        return reply.send(order);
    }
    catch (error) {
        return reply
            .status(500)
            .send({ message: 'Failed to retrieve order', error });
    }
};
