import { Seller } from '../../models/user.js';

// Get delivery area for authenticated seller
export const getDeliveryArea = async (req, reply) => {
  try {
    const { userId, role } = req.user;

    if (role !== 'Seller') {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. Seller role required.'
      });
    }

    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({
        success: false,
        message: 'Seller not found'
      });
    }

    // Return delivery area with store location
    return reply.send({
      success: true,
      data: {
        radius: seller.deliveryArea?.radius || 5,
        unit: seller.deliveryArea?.unit || 'km',
        isActive: seller.deliveryArea?.isActive !== undefined ? seller.deliveryArea.isActive : true,
        updatedAt: seller.deliveryArea?.updatedAt || new Date(),
        storeLocation: {
          latitude: seller.storeLocation?.latitude,
          longitude: seller.storeLocation?.longitude,
          address: seller.storeLocation?.address || seller.storeAddress
        }
      }
    });
  } catch (error) {
    console.error('Get Delivery Area Error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to fetch delivery area'
    });
  }
};

// Set/Update delivery area for authenticated seller
export const setDeliveryArea = async (req, reply) => {
  try {
    const { userId, role } = req.user;
    const { radius, unit, isActive } = req.body;

    if (role !== 'Seller') {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. Seller role required.'
      });
    }

    // Validate radius
    if (radius === undefined || radius === null) {
      return reply.status(400).send({
        success: false,
        message: 'Radius is required'
      });
    }

    if (typeof radius !== 'number' || radius < 0 || radius > 20) {
      return reply.status(400).send({
        success: false,
        message: 'Radius must be a number between 0 and 20'
      });
    }

    // Validate unit if provided
    if (unit && !['km', 'miles'].includes(unit)) {
      return reply.status(400).send({
        success: false,
        message: 'Unit must be either "km" or "miles"'
      });
    }

    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({
        success: false,
        message: 'Seller not found'
      });
    }

    // Check if store location is set
    if (!seller.storeLocation || !seller.storeLocation.isSet) {
      return reply.status(400).send({
        success: false,
        message: 'Please set your store location before setting delivery area'
      });
    }

    // Update delivery area
    seller.deliveryArea = {
      radius: parseFloat(radius),
      unit: unit || 'km',
      isActive: isActive !== undefined ? isActive : true,
      updatedAt: new Date()
    };

    await seller.save();

    console.log('Delivery area updated for seller ' + userId + ': ' + radius + ' ' + (unit || 'km'));

    return reply.send({
      success: true,
      message: 'Delivery area updated successfully',
      data: {
        radius: seller.deliveryArea.radius,
        unit: seller.deliveryArea.unit,
        isActive: seller.deliveryArea.isActive,
        updatedAt: seller.deliveryArea.updatedAt
      }
    });
  } catch (error) {
    console.error('Set Delivery Area Error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to update delivery area'
    });
  }
};

// Clear delivery area for authenticated seller
export const clearDeliveryArea = async (req, reply) => {
  try {
    const { userId, role } = req.user;

    if (role !== 'Seller') {
      return reply.status(403).send({
        success: false,
        message: 'Access denied. Seller role required.'
      });
    }

    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({
        success: false,
        message: 'Seller not found'
      });
    }

    // Reset delivery area to default values
    seller.deliveryArea = {
      radius: 0,
      unit: 'km',
      isActive: false,
      updatedAt: new Date()
    };

    await seller.save();

    console.log('Delivery area cleared for seller ' + userId);

    return reply.send({
      success: true,
      message: 'Delivery area cleared successfully'
    });
  } catch (error) {
    console.error('Clear Delivery Area Error:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to clear delivery area'
    });
  }
};

