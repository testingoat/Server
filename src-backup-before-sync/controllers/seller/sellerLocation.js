import { Seller } from '../../models/user.js';
import Branch from '../../models/branch.js';

// Set seller store location (Option A: Registration + Option B: Profile)
export const setStoreLocation = async (req, reply) => {
  try {
    const { userId } = req.user;
    const { latitude, longitude, address } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return reply.status(400).send({ 
        success: false,
        message: 'Latitude and longitude are required' 
      });
    }

    // Verify seller exists
    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({ 
        success: false,
        message: 'Seller not found' 
      });
    }

    // Update seller store location
    seller.storeLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || '',
      isSet: true
    };

    await seller.save();

    // Auto-create or update branch with seller location
    await createOrUpdateBranch(seller);

    return reply.send({
      success: true,
      message: 'Store location set successfully',
      storeLocation: seller.storeLocation
    });

  } catch (error) {
    console.error('Error setting store location:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to set store location',
      error: error.message
    });
  }
};

// Get seller store location
export const getStoreLocation = async (req, reply) => {
  try {
    const { userId } = req.user;

    // Verify seller exists
    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({ 
        success: false,
        message: 'Seller not found' 
      });
    }

    return reply.send({
      success: true,
      storeLocation: seller.storeLocation || {
        latitude: null,
        longitude: null,
        address: '',
        isSet: false
      }
    });

  } catch (error) {
    console.error('Error getting store location:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to get store location',
      error: error.message
    });
  }
};

// Update seller store location
export const updateStoreLocation = async (req, reply) => {
  try {
    const { userId } = req.user;
    const { latitude, longitude, address } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return reply.status(400).send({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    // Verify seller exists
    const seller = await Seller.findById(userId);
    if (!seller) {
      return reply.status(404).send({ 
        success: false,
        message: 'Seller not found' 
      });
    }

    // Update seller store location
    seller.storeLocation = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || seller.storeLocation?.address || '',
      isSet: true
    };

    await seller.save();

    // Auto-update branch with new seller location
    await createOrUpdateBranch(seller);

    return reply.send({
      success: true,
      message: 'Store location updated successfully',
      storeLocation: seller.storeLocation
    });

  } catch (error) {
    console.error('Error updating store location:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to update store location',
      error: error.message
    });
  }
};

// Helper function to create or update branch with seller location
async function createOrUpdateBranch(seller) {
  try {
    // Check if branch already exists for this seller
    let branch = await Branch.findOne({ seller: seller._id });

    const branchData = {
      name: seller.storeName || `${seller.name}'s Store`,
      location: {
        latitude: seller.storeLocation.latitude,
        longitude: seller.storeLocation.longitude
      },
      address: seller.storeLocation.address || seller.storeAddress || '',
      seller: seller._id
    };

    if (branch) {
      // Update existing branch
      Object.assign(branch, branchData);
      await branch.save();
      console.log(`Updated branch for seller ${seller._id}`);
    } else {
      // Create new branch
      branch = new Branch(branchData);
      await branch.save();
      console.log(`Created new branch for seller ${seller._id}`);
    }

    return branch;
  } catch (error) {
    console.error('Error creating/updating branch:', error);
    throw error;
  }
}
