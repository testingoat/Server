import mongoose from 'mongoose';
import Order from '../../models/order.js';
import Branch from '../../models/branch.js';
import { Customer, DeliveryPartner } from '../../models/user.js';
import { calculateDeliveryCharge, computeDistanceKm, resolveCityFromBranch } from '../../services/delivery.service.js';

const resolveAddressForCustomer = (customer, addressId) => {
    if (!addressId) {
        return null;
    }
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
        return 'INVALID';
    }
    const address = customer?.addresses?.id(addressId);
    return address || null;
};
export const createOrder = async (req, reply) => {
    try {
        const { userId } = req.user;
        const { items, branch, totalPrice, deliveryLocation, addressId } = req.body;
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
        if (!branchData.location?.latitude || !branchData.location?.longitude) {
            return reply.status(400).send({ message: 'Branch location is not configured properly' });
        }
        let resolvedDeliveryLocation = deliveryLocation;
        let deliveryAddressSnapshot = null;
        if (addressId) {
            const addressDoc = resolveAddressForCustomer(customerData, addressId);
            if (addressDoc === 'INVALID') {
                return reply.status(400).send({ code: 'ADDRESS_INVALID', message: 'Invalid address id' });
            }
            if (!addressDoc) {
                return reply.status(404).send({ code: 'ADDRESS_NOT_FOUND', message: 'Address not found' });
            }
            if (addressDoc.latitude === undefined || addressDoc.longitude === undefined) {
                return reply.status(400).send({ code: 'ADDRESS_COORDS_MISSING', message: 'Selected address is missing coordinates' });
            }
            resolvedDeliveryLocation = {
                latitude: addressDoc.latitude,
                longitude: addressDoc.longitude,
            };
            deliveryAddressSnapshot = {
                addressId: addressDoc._id,
                label: addressDoc.label,
                houseNumber: addressDoc.houseNumber,
                street: addressDoc.street,
                landmark: addressDoc.landmark,
                city: addressDoc.city,
                state: addressDoc.state,
                pincode: addressDoc.pincode,
            };
        }
        if (!resolvedDeliveryLocation || resolvedDeliveryLocation.latitude === undefined || resolvedDeliveryLocation.longitude === undefined) {
            return reply.status(400).send({ message: 'Delivery location with latitude and longitude is required' });
        }
        const pickupLocation = {
            latitude: branchData.location.latitude,
            longitude: branchData.location.longitude,
            address: branchData.address || 'No address available',
        };
        const distanceKm = computeDistanceKm(pickupLocation, resolvedDeliveryLocation);
        const customerFallbackCity = deliveryAddressSnapshot?.city ||
            customerData?.addresses?.find((addr) => addr.isDefault)?.city ||
            customerData?.addresses?.[0]?.city ||
            null;
        const resolvedCity = resolveCityFromBranch(branchData, customerFallbackCity);
        const pricing = await calculateDeliveryCharge(resolvedCity, distanceKm, totalPrice || 0, 'Bike');
        if (pricing?.error === 'DISTANCE_EXCEEDED') {
            return reply.status(400).send({
                code: pricing.error,
                message: pricing.message,
                maxDistance: pricing.max_distance,
                distance_km: distanceKm,
            });
        }
        const deliveryCharges = {
            final_fee: pricing.final_fee,
            agent_payout: pricing.agent_payout,
            platform_margin: pricing.platform_margin,
            applied_config_id: pricing.applied_config_id || null,
            breakdown: {
                type: pricing.breakdown?.type || (pricing.applied_config_id ? 'calculated' : 'fallback'),
                base_fare: pricing.breakdown?.base_fare ?? 0,
                distance_surcharge: pricing.breakdown?.distance_surcharge ?? 0,
                small_order_surcharge: pricing.breakdown?.small_order_surcharge ?? 0,
                surge_applied: pricing.breakdown?.surge_applied ?? 1.0,
                distance_km: pricing.breakdown?.distance_km ?? distanceKm,
            },
        };
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
                latitude: resolvedDeliveryLocation.latitude,
                longitude: resolvedDeliveryLocation.longitude,
                address: deliveryAddressSnapshot
                    ? `${deliveryAddressSnapshot.houseNumber || ''} ${deliveryAddressSnapshot.street || ''}`.trim() || 'Saved address'
                    : customerData.address || 'No address available',
            },
            pickupLocation,
            delivery_charges: deliveryCharges,
            deliveryFee: deliveryCharges.final_fee,
            deliveryPartnerEarnings: deliveryCharges.agent_payout,
            deliveryAddressSnapshot,
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

export const quoteOrder = async (req, reply) => {
    try {
        const { userId } = req.user;
        const { branchId, deliveryLocation, cartValue = 0, vehicleType = 'Bike', addressId } = req.body;
        if (!branchId) {
            return reply.status(400).send({ message: 'branchId is required' });
        }
        const branchData = await Branch.findById(branchId).populate('seller');
        if (!branchData) {
            return reply.status(404).send({ message: 'Branch not found' });
        }
        if (!branchData.location?.latitude || !branchData.location?.longitude) {
            return reply.status(400).send({ message: 'Branch location is not configured properly' });
        }
        let resolvedDeliveryLocation = deliveryLocation;
        let addressDoc = null;
        if (addressId) {
            const customer = await Customer.findById(userId);
            if (!customer) {
                return reply.status(404).send({ message: 'Customer not found' });
            }
            addressDoc = resolveAddressForCustomer(customer, addressId);
            if (addressDoc === 'INVALID') {
                return reply.status(400).send({ code: 'ADDRESS_INVALID', message: 'Invalid address id' });
            }
            if (!addressDoc) {
                return reply.status(404).send({ code: 'ADDRESS_NOT_FOUND', message: 'Address not found' });
            }
            resolvedDeliveryLocation = {
                latitude: addressDoc.latitude,
                longitude: addressDoc.longitude,
            };
        }
        if (!resolvedDeliveryLocation?.latitude || !resolvedDeliveryLocation?.longitude) {
            return reply.status(400).send({ message: 'deliveryLocation coordinates are required' });
        }
        const pickupLocation = {
            latitude: branchData.location.latitude,
            longitude: branchData.location.longitude,
        };
        const distanceKm = computeDistanceKm(pickupLocation, resolvedDeliveryLocation);
        const fallbackCity = addressDoc?.city || null;
        const resolvedCity = resolveCityFromBranch(branchData, fallbackCity);
        const pricing = await calculateDeliveryCharge(resolvedCity, distanceKm, cartValue, vehicleType);
        if (pricing?.error === 'DISTANCE_EXCEEDED') {
            return reply.status(400).send({
                code: pricing.error,
                message: pricing.message,
                maxDistance: pricing.max_distance,
                distance_km: distanceKm,
            });
        }
        return reply.send({
            ...pricing,
            city: resolvedCity,
            distance_km: distanceKm,
            breakdown: {
                ...pricing.breakdown,
                distance_km: pricing.breakdown?.distance_km ?? distanceKm,
            },
        });
    }
    catch (error) {
        console.log(error);
        return reply.status(500).send({ message: 'Failed to calculate delivery quote', error });
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
        // Handle status filter (supports comma-separated lists)
        if (status) {
            if (typeof status === 'string' && status.includes(',')) {
                const statusList = status
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                if (statusList.length > 0) {
                    query.status = { $in: statusList };
                }
            }
            else {
                query.status = status;
            }
        }
        if (customerId) {
            query.customer = customerId;
        }
        if (deliveryPartnerId) {
            query.deliveryPartner = deliveryPartnerId;
            // Only filter by branch when explicitly provided
            if (branchId) {
                query.branch = branchId;
            }
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
