import { FastifyRequest, FastifyReply } from 'fastify';
import { performance } from 'perf_hooks';
import os from 'os';

interface MonitoringMetrics {
  server: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    platform: string;
    nodeVersion: string;
    environment: string;
    timestamp: string;
  };
  system: {
    loadAverage: number[];
    totalMemory: number;
    freeMemory: number;
    cpuCount: number;
  };
  performance: {
    responseTimeMs: number;
    requestsPerSecond?: number;
    errorRate?: number;
  };
}

// Simple in-memory metrics storage
const metricsStore = {
  requests: 0,
  errors: 0,
  startTime: Date.now(),
  responseTimes: [] as number[]
};

export async function getMonitoringMetrics(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<MonitoringMetrics> {
  try {
    const startTime = performance.now();
    
    // Increment request counter
    metricsStore.requests++;
    
    // Get system information
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();
    
    // Calculate performance metrics
    const responseTime = performance.now() - startTime;
    metricsStore.responseTimes.push(responseTime);
    
    // Keep only last 100 response times for average calculation
    if (metricsStore.responseTimes.length > 100) {
      metricsStore.responseTimes = metricsStore.responseTimes.slice(-100);
    }
    
    const avgResponseTime = metricsStore.responseTimes.reduce((a, b) => a + b, 0) / metricsStore.responseTimes.length;
    const uptimeSeconds = (Date.now() - metricsStore.startTime) / 1000;
    const requestsPerSecond = metricsStore.requests / uptimeSeconds;
    
    const metrics: MonitoringMetrics = {
      server: {
        uptime: process.uptime(),
        memory: memoryUsage,
        cpuUsage,
        platform: process.platform,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'unknown',
        timestamp: new Date().toISOString()
      },
      system: {
        loadAverage,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuCount: os.cpus().length
      },
      performance: {
        responseTimeMs: avgResponseTime,
        requestsPerSecond: parseFloat(requestsPerSecond.toFixed(2)),
        errorRate: parseFloat(((metricsStore.errors / metricsStore.requests) * 100).toFixed(2))
      }
    };
    
    reply.code(200).send(metrics);
    return metrics;
  } catch (error: any) {
    metricsStore.errors++;
    console.error('Error fetching monitoring metrics:', error);
    reply.code(500).send({
      error: 'Failed to fetch monitoring metrics',
      message: error.message
    });
    throw error;
  }
}

// Endpoint to get current server health status
export async function getHealthStatus(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0',
      database: 'connected', // You can enhance this to check actual DB connection
      environment: process.env.NODE_ENV || 'unknown',
      deliveryPartners: 0 // You can enhance this to get actual count from DB
    };
    
    reply.code(200).send(health);
    return health;
  } catch (error: any) {
    const unhealthyResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    };
    
    reply.code(503).send(unhealthyResponse);
    return unhealthyResponse;
  }
}

// Route registration function
export async function monitoringRoutes(fastify: any) {
  // Monitoring metrics endpoint
  fastify.get('/admin/monitoring/metrics', getMonitoringMetrics);
  
  // Health detailed endpoint (separate from existing /health)
  fastify.get('/admin/monitoring/health', getHealthStatus);
  
  // System info endpoint
  fastify.get('/admin/monitoring/system', async (request: FastifyRequest, reply: FastifyReply) => {
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      uptime: os.uptime()
    };
    
    reply.send(systemInfo);
  });
  
  console.log('📊 Monitoring routes registered: /admin/monitoring/metrics, /admin/monitoring/health, /admin/monitoring/system');
}
