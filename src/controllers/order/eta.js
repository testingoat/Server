import Branch from '../../models/branch.js';
import DeliveryEtaConfig from '../../models/deliveryEtaConfig.js';

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatEtaRangeText(etaMinutes, prepTimeMin) {
  const lower = Math.max(etaMinutes - 5, prepTimeMin);
  const upper = etaMinutes + 5;
  if (lower === upper) {
    return `${upper} mins`;
  }
  return `${lower}-${upper} mins`;
}

export const estimateEtaForLocation = async (req, reply) => {
  try {
    const { latitude, longitude } = req.query;

    if (
      latitude === undefined ||
      longitude === undefined ||
      latitude === '' ||
      longitude === ''
    ) {
      return reply.status(400).send({
        success: false,
        reason: 'INVALID_LOCATION',
        message: 'Latitude and longitude are required',
      });
    }

    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);

    if (Number.isNaN(userLat) || Number.isNaN(userLng)) {
      return reply.status(400).send({
        success: false,
        reason: 'INVALID_LOCATION',
        message: 'Latitude and longitude must be valid numbers',
      });
    }

    const [branches, etaConfigRaw] = await Promise.all([
      Branch.find({
        isActive: { $ne: false },
        'location.latitude': { $ne: null, $exists: true },
        'location.longitude': { $ne: null, $exists: true },
      }).select('name address location serviceRadiusKm prepTimeMin averageSpeedKmph seller'),
      DeliveryEtaConfig.getActiveConfig(),
    ]);

    const etaConfig = etaConfigRaw || {
      defaultPrepTimeMin: 12,
      defaultAverageSpeedKmph: 25,
      defaultServiceRadiusKm: 5,
    };

    if (!etaConfigRaw) {
      console.warn(
        'No active ETA configuration found; using fallback defaults:',
        etaConfig
      );
    }

    if (!branches.length) {
      return reply.status(404).send({
        success: false,
        reason: 'NO_BRANCHES',
        message: 'No active branches available',
      });
    }

    const candidates = [];
    for (const branch of branches) {
      const { latitude: branchLat, longitude: branchLng } = branch.location || {};
      if (
        typeof branchLat !== 'number' ||
        typeof branchLng !== 'number' ||
        Number.isNaN(branchLat) ||
        Number.isNaN(branchLng)
      ) {
        continue;
      }

      const distanceKm = haversineDistanceKm(
        userLat,
        userLng,
        branchLat,
        branchLng
      );

      const radius =
        typeof branch.serviceRadiusKm === 'number' && branch.serviceRadiusKm > 0
          ? branch.serviceRadiusKm
          : etaConfig.defaultServiceRadiusKm;

      if (radius && distanceKm > radius) {
        continue;
      }

      candidates.push({ branch, distanceKm });
    }

    if (!candidates.length) {
      return reply.status(404).send({
        success: false,
        reason: 'OUT_OF_COVERAGE',
        message: 'Delivery not available at your location',
      });
    }

    candidates.sort((a, b) => a.distanceKm - b.distanceKm);
    const best = candidates[0];

    const prepTimeMin =
      typeof best.branch.prepTimeMin === 'number' && best.branch.prepTimeMin >= 0
        ? best.branch.prepTimeMin
        : etaConfig.defaultPrepTimeMin;

    const avgSpeed =
      typeof best.branch.averageSpeedKmph === 'number' &&
      best.branch.averageSpeedKmph > 0
        ? best.branch.averageSpeedKmph
        : etaConfig.defaultAverageSpeedKmph;

    const travelTimeMin = (best.distanceKm / avgSpeed) * 60;
    const etaMinutes = Math.round(prepTimeMin + travelTimeMin);
    const etaText = formatEtaRangeText(etaMinutes, prepTimeMin);

    return reply.send({
      success: true,
      etaMinutes,
      etaText,
      branch: {
        id: best.branch._id,
        name: best.branch.name,
        address: best.branch.address,
        distanceKm: Number(best.distanceKm.toFixed(2)),
        sellerId: best.branch.seller,
      },
      meta: {
        prepTimeMin,
        averageSpeedKmph: avgSpeed,
        serviceRadiusKm:
          best.branch.serviceRadiusKm || etaConfig.defaultServiceRadiusKm,
      },
    });
  } catch (error) {
    console.error('Error estimating ETA for location:', error);
    return reply.status(500).send({
      success: false,
      reason: 'ETA_ERROR',
      message: 'Failed to estimate delivery time',
    });
  }
};
