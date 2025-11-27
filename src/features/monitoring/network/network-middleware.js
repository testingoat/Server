
// Store metrics in memory
export const networkMetrics = {
    activeConnections: 0,
    totalRequests: 0,
    totalResponseTime: 0,
    totalBandwidth: 0,
    totalBytesSent: 0,
    totalBytesReceived: 0,
    requestsPerSecond: 0,
    averageLatency: 0,
    history: [] // Store last 60 seconds of data
};

// Reset counters every second to calculate RPS
setInterval(() => {
    const now = new Date();
    const snapshot = {
        timestamp: now.toISOString(),
        rps: networkMetrics.requestsPerSecond,
        latency: networkMetrics.averageLatency,
        activeConnections: networkMetrics.activeConnections,
        bandwidth: networkMetrics.totalBandwidth,
        bytesSent: networkMetrics.totalBytesSent,
        bytesReceived: networkMetrics.totalBytesReceived
    };

    // Add to history (keep last 60 points)
    networkMetrics.history.push(snapshot);
    if (networkMetrics.history.length > 60) {
        networkMetrics.history.shift();
    }

    // Reset instantaneous counters
    networkMetrics.requestsPerSecond = 0;
    networkMetrics.totalResponseTime = 0;
    // Keep totalRequests, totalBytesSent and totalBytesReceived cumulative
}, 1000);

let rpsCounter = 0;
let latencySum = 0;
let latencyCount = 0;

setInterval(() => {
    networkMetrics.requestsPerSecond = rpsCounter;
    networkMetrics.averageLatency = latencyCount > 0 ? latencySum / latencyCount : 0;

    // Reset for next second
    rpsCounter = 0;
    latencySum = 0;
    latencyCount = 0;
}, 1000);

export const networkMiddleware = async (fastify, options) => {
    fastify.addHook('onRequest', async (request, reply) => {
        networkMetrics.activeConnections++;
        rpsCounter++;
        networkMetrics.totalRequests++;
        request.startTime = process.hrtime();

        // Track incoming payload size from content-length header
        const contentLength = parseInt(request.headers['content-length'] || '0', 10);
        networkMetrics.totalBytesReceived += contentLength;
    });

    fastify.addHook('onResponse', async (request, reply) => {
        networkMetrics.activeConnections--;

        // Calculate duration
        const diff = process.hrtime(request.startTime);
        const durationInMs = (diff[0] * 1000) + (diff[1] / 1e6);

        latencySum += durationInMs;
        latencyCount++;

        // Calculate bandwidth (approximate)
        let size = 0;
        if (reply.getHeader('content-length')) {
            size = parseInt(reply.getHeader('content-length'), 10);
        }
        networkMetrics.totalBandwidth += size;
        networkMetrics.totalBytesSent += size;
    });
};
