import DeliveryConfiguration from '../models/deliveryConfiguration.js';

const CITY_ALIASES = {
    BANGALORE: 'BENGALURU',
    BENGALORE: 'BENGALURU',
    BENGALURU: 'BENGALURU',
    BELGAUM: 'BELAGAVI',
    BELGAVI: 'BELAGAVI',
};

const normalizeCity = (city) => {
    if (!city) {
        return 'DEFAULT';
    }
    const normalized = city.trim().toUpperCase();
    return CITY_ALIASES[normalized] || normalized;
};

const getCityCandidates = (city) => {
    const normalized = normalizeCity(city);
    const candidates = new Set([normalized]);
    Object.entries(CITY_ALIASES).forEach(([alias, canonical]) => {
        if (canonical === normalized) {
            candidates.add(alias);
        }
    });
    return Array.from(candidates);
};

export const computeDistanceKm = (pickup, drop) => {
    if (!pickup?.latitude || !pickup?.longitude || !drop?.latitude || !drop?.longitude) {
        return 0;
    }
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(drop.latitude - pickup.latitude);
    const dLon = toRad(drop.longitude - pickup.longitude);
    const lat1 = toRad(pickup.latitude);
    const lat2 = toRad(drop.latitude);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
};

export const resolveCityFromBranch = (branchDoc, fallbackCity = '') => {
    if (!branchDoc) {
        return normalizeCity(fallbackCity);
    }
    const inferredCity = branchDoc.city || branchDoc?.seller?.city || fallbackCity || 'DEFAULT';
    return normalizeCity(inferredCity);
};

/**
 * Calculates delivery charges based on city, distance, and cart value.
 */
export const calculateDeliveryCharge = async (city, distanceKm, cartValue, vehicleType = 'Bike') => {
    // 1. Find the Rule
    const cityCandidates = getCityCandidates(city);
    const config = await DeliveryConfiguration.findOne({
        city: { $in: cityCandidates },
        vehicle_type: vehicleType,
        active: true
    });

    // 2. Fallback if no rule exists (Safety Net)
    if (!config) {
        console.warn(`[DeliveryService] No config found for ${cityCandidates.join(',')} (${vehicleType}). Using fallback.`);
        return {
            final_fee: 40,
            agent_payout: 25,
            platform_margin: 15,
            currency: 'INR',
            applied_config_id: null,
            breakdown: {
                type: 'fallback',
                base_fare: 40,
                distance_surcharge: 0,
                small_order_surcharge: 0,
                surge_applied: 1.0,
                distance_km: distanceKm
            }
        };
    }

    // 3. Max Distance Check
    if (config.max_delivery_distance && distanceKm > config.max_delivery_distance) {
        // In a real app, you might want to throw an error or handle this gracefully
        // For now, we will return a special error object that the controller can handle
        return {
            error: 'DISTANCE_EXCEEDED',
            message: `Delivery not available beyond ${config.max_delivery_distance} km`,
            max_distance: config.max_delivery_distance
        };
    }

    let fee = config.base_fare;

    // 4. Distance Calculation
    let extraKm = 0;
    if (distanceKm > config.base_distance) {
        extraKm = distanceKm - config.base_distance;
        fee += (extraKm * config.extra_per_km);
    }

    // 5. Surge Logic
    fee = fee * config.surge_multiplier;

    // 6. Small Order Protection
    let smallOrderSurcharge = 0;
    if (cartValue < config.min_order_value) {
        smallOrderSurcharge = config.small_order_fee;
        fee += smallOrderSurcharge;
    }

    // 7. Calculate Agent Payout
    // Agent gets base payout + per km for extra distance
    // Note: Agent might get paid for distance even if customer fee is capped or different
    // We use the same extraKm calculation for simplicity, but using agent_per_km
    const agentPayout = config.agent_base_payout + (extraKm * config.agent_per_km);

    const finalFee = Math.ceil(fee);
    const finalAgentPayout = Math.ceil(agentPayout);
    const platformMargin = finalFee - finalAgentPayout;

    // 8. Return Result with breakdown
    return {
        final_fee: finalFee,
        agent_payout: finalAgentPayout,
        platform_margin: platformMargin,
        currency: 'INR',
        applied_config_id: config._id,
        breakdown: {
            type: 'calculated',
            base_fare: config.base_fare,
            distance_surcharge: Math.ceil(fee - config.base_fare - smallOrderSurcharge), // Portion attributed to distance * surge
            small_order_surcharge: smallOrderSurcharge,
            surge_applied: config.surge_multiplier,
            distance_km: distanceKm
        }
    };
};
