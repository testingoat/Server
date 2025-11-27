import { ErrorLog } from '../monitoring.model.js';

export class ErrorController {
    async logError(req, reply) {
        try {
            const { message, stack, context, level } = req.body;
            const error = new ErrorLog({
                message,
                stack,
                context,
                level: level || 'error'
            });
            await error.save();
            return reply.send({ success: true, id: error._id });
        } catch (err) {
            req.log.error(err);
            return reply.status(500).send({ success: false, error: 'Failed to log error' });
        }
    }

    async getErrors(req, reply) {
        try {
            const { page = 1, limit = 50, status, level } = req.query;
            const query = {};
            if (status) query.status = status;
            if (level) query.level = level;

            const errors = await ErrorLog.find(query)
                .sort({ timestamp: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            const total = await ErrorLog.countDocuments(query);

            return reply.send({
                success: true,
                data: errors,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (err) {
            req.log.error(err);
            return reply.status(500).send({ success: false, error: 'Failed to fetch errors' });
        }
    }

    async updateErrorStatus(req, reply) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const error = await ErrorLog.findByIdAndUpdate(
                id,
                {
                    status,
                    resolvedAt: status === 'resolved' ? new Date() : null,
                    resolvedBy: status === 'resolved' ? 'admin' : null
                },
                { new: true }
            );

            if (!error) return reply.status(404).send({ success: false, error: 'Error not found' });

            return reply.send({ success: true, data: error });
        } catch (err) {
            req.log.error(err);
            return reply.status(500).send({ success: false, error: 'Failed to update error' });
        }
    }

    async clearErrors(req, reply) {
        try {
            const { status } = req.body;
            if (!status) return reply.status(400).send({ success: false, error: 'Status required' });

            const result = await ErrorLog.deleteMany({ status });
            return reply.send({ success: true, count: result.deletedCount });
        } catch (err) {
            req.log.error(err);
            return reply.status(500).send({ success: false, error: 'Failed to clear errors' });
        }
    }
}

export const errorController = new ErrorController();
