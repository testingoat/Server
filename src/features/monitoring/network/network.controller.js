import { networkMetrics } from './network-middleware.js';

export class NetworkController {
    async getStats(req, reply) {
        return reply.send({
            success: true,
            data: {
                activeConnections: networkMetrics.activeConnections,
                totalRequests: networkMetrics.totalRequests,
                requestsPerSecond: networkMetrics.requestsPerSecond,
                averageLatency: networkMetrics.averageLatency,
                totalBandwidth: networkMetrics.totalBandwidth,
                totalBytesSent: networkMetrics.totalBytesSent,
                totalBytesReceived: networkMetrics.totalBytesReceived,
                history: networkMetrics.history,
                timestamp: new Date().toISOString()
            }
        });
    }
}
