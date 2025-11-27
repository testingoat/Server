import { Order } from '../../models/index.js';

/**
 * Get delivery partner statistics
 * Returns total deliveries, today's deliveries, today's earnings, and rating
 * 
 * @route GET /api/delivery-partner/stats
 * @access Protected (requires authentication)
 */
export const getDeliveryPartnerStats = async (req, reply) => {
    try {
        // Extract user info from JWT (set by verifyToken middleware)
        const { userId, role } = req.user;
        console.log('Fetching stats for delivery partner:', userId);

        // Authorization check: Only delivery partners can access this endpoint
        if (role !== 'DeliveryPartner') {
            return reply.status(403).send({
                success: false,
                message: 'Access denied. Only delivery partners can access this endpoint.',
            });
        }

        // Calculate total deliveries (all time)
        const totalDeliveries = await Order.countDocuments({
            deliveryPartner: userId,
            status: 'delivered',
        });

        // Calculate today's date range
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Calculate today's deliveries
        const todayDeliveries = await Order.countDocuments({
            deliveryPartner: userId,
            status: 'delivered',
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        });

        // Calculate today's earnings using aggregation
        // NOTE: Currently using totalPrice as proxy for earnings
        // This will be updated to use deliveryFee field in subsequent phase
        const earningsResult = await Order.aggregate([
            {
                $match: {
                    deliveryPartner: userId,
                    status: 'delivered',
                    createdAt: { $gte: startOfDay, $lte: endOfDay },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalPrice' },
                },
            },
        ]);

        const todayEarnings = earningsResult.length > 0 ? earningsResult[0].total : 0;

        // Rating placeholder (no rating system exists yet)
        const rating = 0;

        // Return success response
        return reply.status(200).send({
            success: true,
            stats: {
                totalDeliveries,
                todayDeliveries,
                todayEarnings,
                rating,
            },
        });
    } catch (error) {
        console.error('Error fetching delivery partner stats:', error);
        return reply.status(500).send({
            success: false,
            message: 'An error occurred while fetching statistics',
        });
    }
};

