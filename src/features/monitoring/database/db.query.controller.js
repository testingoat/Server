import mongoose from 'mongoose';

export class DbQueryController {
    async runQuery(req, reply) {
        try {
            const { collection, operation, query = {}, options = {} } = req.body;

            if (mongoose.connection.readyState !== 1) {
                return reply.status(503).send({ success: false, error: 'Database not connected' });
            }

            const db = mongoose.connection.db;
            const col = db.collection(collection);

            let result;
            let parsedQuery = query;

            // Parse stringified query if necessary
            if (typeof query === 'string') {
                try {
                    parsedQuery = JSON.parse(query);
                } catch (e) {
                    return reply.status(400).send({ success: false, error: 'Invalid JSON query' });
                }
            }

            if (operation === 'find') {
                const limit = parseInt(options.limit) || 20;
                const skip = parseInt(options.skip) || 0;
                const sort = options.sort || { _id: -1 };
                result = await col.find(parsedQuery).sort(sort).skip(skip).limit(limit).toArray();
            } else if (operation === 'aggregate') {
                if (!Array.isArray(parsedQuery)) {
                    return reply.status(400).send({ success: false, error: 'Pipeline must be an array' });
                }
                result = await col.aggregate(parsedQuery).toArray();
            } else if (operation === 'count') {
                result = await col.countDocuments(parsedQuery);
            } else if (operation === 'findOne') {
                result = await col.findOne(parsedQuery);
            } else {
                return reply.status(400).send({ success: false, error: 'Invalid operation' });
            }

            return reply.send({ success: true, data: result });

        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    }

    async getCollections(req, reply) {
        try {
            if (mongoose.connection.readyState !== 1) {
                return reply.status(503).send({ success: false, error: 'Database not connected' });
            }
            const collections = await mongoose.connection.db.listCollections().toArray();
            const names = collections.map(c => c.name).sort();
            return reply.send({ success: true, data: names });
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ success: false, error: error.message });
        }
    }
}

export const dbQueryController = new DbQueryController();
