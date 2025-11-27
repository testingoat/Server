import { DbStatsService } from './db-stats.service.js';

export class DbStatsController {
    constructor() {
        this.service = new DbStatsService();
    }

    async getStats(req, reply) {
        try {
            const stats = await this.service.getStats();
            return reply.send({ success: true, data: stats });
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ success: false, message: 'Failed to fetch DB stats' });
        }
    }
}
