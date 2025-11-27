import { FastifyReply, FastifyRequest } from 'fastify';
import { Customer, DeliveryPartner } from '../../models/index.js';

export const upsertFcmToken = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { fcmToken } = (req.body as any) || {};
    if (!fcmToken) {
      return reply.status(400).send({ success: false, message: 'fcmToken is required' });
    }

    const { userId, role } = (req as any).user || {};
    if (!userId || !role) {
      return reply.status(401).send({ success: false, message: 'Unauthorized' });
    }

    const Model = role === 'Customer' ? Customer : role === 'DeliveryPartner' ? DeliveryPartner : null;
    if (!Model) {
      return reply.status(400).send({ success: false, message: 'Unsupported user role' });
    }

    const updated = await (Model as any).findByIdAndUpdate(
      userId,
      { $set: { fcmToken, lastTokenUpdate: new Date() } },
      { new: true }
    );

    if (!updated) {
      return reply.status(404).send({ success: false, message: 'User not found' });
    }

    return reply.send({ success: true, message: 'FCM token updated' });
  } catch (err) {
    console.error('FCM token update error:', err);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  }
};

