import { DeliveryFeeConfig } from ../../models/index.js;

function validateSlabs(slabs = []) {
  const errors = [];
  if (!Array.isArray(slabs) || slabs.length === 0) errors.push(At least one slab is required);
  const sorted = [...slabs].sort((a,b)=>a.minOrderValue-b.minOrderValue);
  if (sorted[0]?.minOrderValue !== 0) errors.push(First slab must start at 0);
  if (sorted[sorted.length-1]?.maxOrderValue !== null) errors.push(Last slab must have maxOrderValue = null);
  for (let i=0;i<sorted.length-1;i++){
    const cur=sorted[i], nxt=sorted[i+1];
    if (cur.maxOrderValue == null) errors.push(Only last slab can have maxOrderValue = null);
    if (cur.maxOrderValue >= nxt.minOrderValue) errors.push(Slab ranges must not overlap);
    if (nxt.minOrderValue !== cur.maxOrderValue + 1) errors.push(Slab ranges must be continuous without gaps);
  }
  return errors;
}

export async function getActiveConfig(_req, reply){
  try{
    const cfg = await DeliveryFeeConfig.findOne({ isActive: true });
    if(!cfg) return reply.code(404).send({ success:false, message:No active delivery fee configuration found });
    return reply.send({ success:true, data: cfg });
  }catch(err){
    console.error(❌ Error fetching active config:, err);
    return reply.code(500).send({ success:false, message:Failed to fetch active configuration });
  }
}

export async function createConfig(request, reply){
  try{
    const { slabs, partnerEarningsPercentage = 0.8, isActive = true, createdBy =  admin } = request.body || {};
    const errs = validateSlabs(slabs);
    if (partnerEarningsPercentage < 0 || partnerEarningsPercentage > 1) errs.push(partnerEarningsPercentage must be between 0 and 1);
    if (errs.length) return reply.code(400).send({ success:false, message:Validation failed, errors: errs });

    if (isActive) await DeliveryFeeConfig.updateMany({}, { : { isActive: false } });

    const created = await DeliveryFeeConfig.create({ slabs, partnerEarningsPercentage, isActive, createdBy });
    console.log(✅ Delivery fee configuration created by:, createdBy);
    return reply.code(201).send({ success:true, message:Delivery fee configuration created successfully, data: created });
  }catch(err){
    console.error(❌ Error creating config:, err);
    return reply.code(500).send({ success:false, message:Failed to create configuration });
  }
}

export async function updateConfig(request, reply){
  try{
    const { id } = request.params;
    const { slabs, partnerEarningsPercentage, isActive } = request.body || {};
    const cfg = await DeliveryFeeConfig.findById(id);
    if(!cfg) return reply.code(404).send({ success:false, message:Configuration not found });

    const errs = validateSlabs(slabs);
    if (partnerEarningsPercentage < 0 || partnerEarningsPercentage > 1) errs.push(partnerEarningsPercentage must be between 0 and 1);
    if (errs.length) return reply.code(400).send({ success:false, message:Validation failed, errors: errs });

    if (isActive) await DeliveryFeeConfig.updateMany({ _id: { : id } }, { : { isActive: false } });

    cfg.slabs = slabs;
    cfg.partnerEarningsPercentage = partnerEarningsPercentage;
    cfg.isActive = !!isActive;
    await cfg.save();

    console.log(✅ Delivery fee configuration updated:, id);
    return reply.send({ success:true, message:Delivery fee configuration updated successfully, data: cfg });
  }catch(err){
    console.error(❌ Error updating config:, err);
    return reply.code(500).send({ success:false, message:Failed to update configuration });
  }
}

export async function calculateFee(request, reply){
  try{
    const orderValue = Number(request.query?.orderValue);
    if (Number.isNaN(orderValue) || orderValue < 0) {
      return reply.code(400).send({ success:false, message:Invalid orderValue });
    }
    const cfg = await DeliveryFeeConfig.findOne({ isActive: true });
    if (!cfg) return reply.code(404).send({ success:false, message:No active delivery fee configuration found });

    const slab = cfg.slabs.find(s => orderValue >= s.minOrderValue && (s.maxOrderValue === null || orderValue <= s.maxOrderValue));
    if (!slab) return reply.code(400).send({ success:false, message:No applicable slab found });

    const deliveryFee = Math.round((slab.baseFee + (orderValue * slab.percentageFee)) * 100) / 100;
    const partnerEarnings = Math.round((deliveryFee * cfg.partnerEarningsPercentage) * 100) / 100;
    const platformCommission = Math.round((deliveryFee - partnerEarnings) * 100) / 100;

    return reply.send({ success:true, data: { orderValue, deliveryFee, partnerEarnings, platformCommission, appliedSlab: slab } });
  }catch(err){
    console.error(❌ Error calculating delivery fee:, err);
    return reply.code(500).send({ success:false, message:Failed to calculate delivery fee });
  }
}

export async function getAllConfigs(_req, reply){
  try{
    const configs = await DeliveryFeeConfig.find().sort({ createdAt: -1 });
    return reply.send({ success:true, data: configs, total: configs.length });
  }catch(err){
    console.error(❌ Error fetching configs:, err);
    return reply.code(500).send({ success:false, message:Failed to fetch configs });
  }
}
