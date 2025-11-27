import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ServerMetrics } from './monitoring.model.js';
import { WebSocketServer } from 'ws';

export class MonitoringService {
    constructor() {
        this.rootDir = process.cwd();
        this.backupDir = path.join(this.rootDir, 'backups');

        // Metrics collection
        this.collectionInterval = null;
        this.isCollecting = false;

        // Log streaming
        this.wss = null;
        this.logBuffer = [];
        this.MAX_LOG_BUFFER = 500;
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };
    }

    /**
     * Initialize the service
     */
    async initialize(server) {
        console.log('🚀 Initializing Monitoring Service...');
        this.startMetricsCollector();
        this.setupLogStreaming(server);
        this.interceptConsole();
        console.log('✅ Monitoring Service Initialized');
        console.log(`   - Metrics collection: ${this.isCollecting ? 'Active' : 'Inactive'}`);
        console.log(`   - Log interception: Active`);
        console.log(`   - WebSocket clients: ${this.wss?.clients?.size || 0}`);
    }

    /**
     * Start collecting metrics every 30 seconds
     */
    startMetricsCollector() {
        if (this.isCollecting) return;

        this.isCollecting = true;
        // Run immediately
        this.collectAndSaveMetrics();

        // Then every 30 seconds
        this.collectionInterval = setInterval(() => {
            this.collectAndSaveMetrics();
        }, 30000);

        console.log('📊 Metrics collector started');
    }

    /**
     * Stop metrics collection
     */
    stopMetricsCollector() {
        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
            this.collectionInterval = null;
        }
        this.isCollecting = false;
        this.restoreConsole();
    }

    /**
     * Collect and save current metrics to DB
     */
    async collectAndSaveMetrics() {
        try {
            const metrics = await this.getMetrics();

            // Calculate CPU usage (simple estimation based on load avg)
            const cpus = os.cpus().length;
            const loadAvg = os.loadavg()[0];
            const cpuPercent = Math.min(100, Math.round((loadAvg / cpus) * 100));

            const metricRecord = new ServerMetrics({
                timestamp: new Date(),
                server: {
                    uptime: metrics.server.uptime,
                    memory: {
                        rss: metrics.server.memory.rss,
                        heapUsed: metrics.server.memory.heapUsed,
                        heapTotal: metrics.server.memory.heapTotal
                    },
                    cpu: cpuPercent
                },
                requests: {
                    total: 0, // TODO: Hook into request counter if available
                    perMinute: 0
                }
            });

            await metricRecord.save();
        } catch (error) {
            // Silent fail for metrics collection to not crash server
            // console.error('Error saving metrics:', error.message);
        }
    }

    /**
     * Get historical metrics for charts
     * @param {string} range - '1h', '6h', '24h', '7d'
     */
    async getHistoricalMetrics(range = '24h') {
        const now = new Date();
        let startTime = new Date();

        switch (range) {
            case '1h': startTime.setHours(now.getHours() - 1); break;
            case '6h': startTime.setHours(now.getHours() - 6); break;
            case '24h': startTime.setHours(now.getHours() - 24); break;
            case '7d': startTime.setDate(now.getDate() - 7); break;
            default: startTime.setHours(now.getHours() - 24);
        }

        return await ServerMetrics.find({
            timestamp: { $gte: startTime }
        })
            .select('timestamp server.memory.heapUsed server.cpu')
            .sort({ timestamp: 1 })
            .lean();
    }

    /**
     * Setup WebSocket for log streaming
     */
    setupLogStreaming(server) {
        // WebSocket is handled by Fastify plugin, just initialize clients set
        this.wss = { clients: new Set() };
        console.log('✅ Log streaming WebSocket initialized');
    }

    /**
     * Intercept console methods to capture logs
     */
    interceptConsole() {
        const levels = ['log', 'warn', 'error', 'info'];

        levels.forEach(level => {
            console[level] = (...args) => {
                // Call original method
                this.originalConsole[level].apply(console, args);

                // Format log message
                const message = args.map(arg => {
                    if (typeof arg === 'object') {
                        try {
                            return JSON.stringify(arg);
                        } catch (e) {
                            return '[Circular]';
                        }
                    }
                    return String(arg);
                }).join(' ');

                this.addLogEntry(level, message);
            };
        });
    }

    /**
     * Restore original console methods
     */
    restoreConsole() {
        Object.keys(this.originalConsole).forEach(level => {
            console[level] = this.originalConsole[level];
        });
    }

    /**
     * Add log entry to buffer and broadcast
     */
    addLogEntry(level, message) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message
        };

        // Add to buffer
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.MAX_LOG_BUFFER) {
            this.logBuffer.shift();
        }

        // Broadcast to WebSocket clients
        if (this.wss && this.wss.clients && this.wss.clients.size > 0) {
            const data = JSON.stringify({ type: 'log', data: entry });
            const deadClients = [];

            this.wss.clients.forEach(client => {
                try {
                    // WebSocket.OPEN = 1
                    if (client.readyState === 1) {
                        client.send(data);
                    } else if (client.readyState === 3) { // WebSocket.CLOSED
                        deadClients.push(client);
                    }
                } catch (err) {
                    console.error('❌ Error broadcasting to WebSocket client:', err.message);
                    deadClients.push(client);
                }
            });

            // Clean up dead connections
            deadClients.forEach(client => {
                this.wss.clients.delete(client);
            });

            if (deadClients.length > 0) {
                console.log(`🧹 Cleaned up ${deadClients.length} dead WebSocket connections`);
            }
        }
    }

    /**
     * Get recent logs
     */
    getRecentLogs() {
        return this.logBuffer;
    }

    /**
     * Get server and system metrics
     */
    async getMetrics() {
        const srcPath = path.join(this.rootDir, 'src');
        const distPath = path.join(this.rootDir, 'dist');

        const lastSrcMod = this.getLatestModTime(srcPath);
        const lastDistMod = this.getLatestModTime(distPath);
        const synced = lastDistMod >= (lastSrcMod - 60000); // 1 min buffer

        const projectSize = this.getDirSize(this.rootDir);

        return {
            server: {
                uptime: Math.floor(process.uptime()),
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development',
                platform: process.platform,
                memory: process.memoryUsage(),
                pid: process.pid
            },
            system: {
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpus: os.cpus().length,
                loadAverage: os.loadavg(),
                hostname: os.hostname(),
                projectSize
            },
            verification: {
                synced,
                lastSrcMod,
                lastDistMod
            }
        };
    }

    /**
     * Get list of available backups
     */
    getBackups() {
        if (!fs.existsSync(this.backupDir)) {
            return [];
        }

        return fs.readdirSync(this.backupDir)
            .filter(f => f.endsWith('.zip'))
            .map(f => {
                const stats = fs.statSync(path.join(this.backupDir, f));
                return {
                    filename: f,
                    size: stats.size,
                    sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
                    created: stats.mtime
                };
            })
            .sort((a, b) => b.created - a.created);
    }

    /**
     * Create a backup of the server
     */
    async createBackup() {
        // Ensure backup directory exists
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + Date.now();
        const backupFilename = `server-backup-${timestamp}.zip`;
        const backupPath = path.join(this.backupDir, backupFilename);

        // Create backup using archiver
        await new Promise((resolve, reject) => {
            const output = fs.createWriteStream(backupPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // High compression
            });

            output.on('close', () => {
                console.log(`✅ Backup created: ${archive.pointer()} bytes`);
                resolve();
            });

            archive.on('error', (err) => {
                console.error('❌ Archive error:', err);
                reject(err);
            });

            archive.pipe(output);

            // Add files to archive, excluding specific directories
            const excludeDirs = ['node_modules', '.git', 'backups', 'dist', 'coverage', '.gemini'];

            this.addDirectoryToArchive(archive, this.rootDir, '', excludeDirs);
            archive.finalize();
        });

        // Clean up old backups
        await this.cleanupOldBackups();

        const backupStats = fs.statSync(backupPath);

        return {
            success: true,
            filename: backupFilename,
            path: `/admin/monitoring/download/${backupFilename}`,
            size: backupStats.size,
            sizeFormatted: `${(backupStats.size / 1024 / 1024).toFixed(2)} MB`
        };
    }

    /**
     * Get backup file path
     */
    getBackupPath(filename) {
        // Security: prevent directory traversal
        if (filename.includes('..') || !filename.endsWith('.zip')) {
            throw new Error('Invalid filename');
        }

        return path.join(this.backupDir, filename);
    }

    /**
     * Check if backup exists
     */
    backupExists(filename) {
        const backupPath = this.getBackupPath(filename);
        return fs.existsSync(backupPath);
    }

    /**
     * Get backup file stats
     */
    getBackupStats(filename) {
        const backupPath = this.getBackupPath(filename);
        return fs.statSync(backupPath);
    }

    /**
     * Helper: Add directory to archive recursively
     */
    addDirectoryToArchive(archive, dirPath, archivePath = '', excludeDirs = []) {
        const files = fs.readdirSync(dirPath);

        files.forEach(file => {
            const fullPath = path.join(dirPath, file);
            const relativePath = archivePath ? path.join(archivePath, file) : file;
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (!excludeDirs.includes(file)) {
                    this.addDirectoryToArchive(archive, fullPath, relativePath, excludeDirs);
                }
            } else {
                archive.file(fullPath, { name: relativePath });
            }
        });
    }

    /**
     * Helper: Get latest modification time in directory
     */
    getLatestModTime(dir) {
        if (!fs.existsSync(dir)) return 0;
        let latestTime = 0;

        const walk = (directory) => {
            const files = fs.readdirSync(directory);
            files.forEach(file => {
                const fullPath = path.join(directory, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory() && !['node_modules', '.git', 'dist', 'backups'].includes(file)) {
                    walk(fullPath);
                } else if (stat.isFile()) {
                    if (stat.mtimeMs > latestTime) {
                        latestTime = stat.mtimeMs;
                    }
                }
            });
        };

        walk(dir);
        return latestTime;
    }

    /**
     * Helper: Get directory size
     */
    getDirSize(dirPath) {
        let totalSize = 0;
        try {
            const walk = (directory) => {
                const files = fs.readdirSync(directory);
                files.forEach(file => {
                    const fullPath = path.join(directory, file);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory() && !['node_modules', '.git'].includes(file)) {
                        walk(fullPath);
                    } else if (stat.isFile()) {
                        totalSize += stat.size;
                    }
                });
            };
            walk(dirPath);
        } catch (err) {
            console.error('Error calculating dir size:', err);
        }
        return totalSize;
    }

    /**
     * Helper: Clean up old backups (keep last 7)
     */
    async cleanupOldBackups() {
        const backups = fs.readdirSync(this.backupDir)
            .filter(f => f.endsWith('.zip'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        if (backups.length > 7) {
            for (let i = 7; i < backups.length; i++) {
                fs.unlinkSync(path.join(this.backupDir, backups[i].name));
                console.log(`🗑️ Deleted old backup: ${backups[i].name}`);
            }
        }
    }
}
