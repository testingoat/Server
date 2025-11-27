import fs from 'fs';
import path from 'path';
import { MonitoringService } from './monitoring.service.js';

const monitoringService = new MonitoringService();

export class MonitoringController {
    /**
     * Get server metrics
     */
    async getMetrics(request, reply) {
        try {
            const metrics = await monitoringService.getMetrics();
            return { success: true, data: metrics };
        } catch (error) {
            console.error('❌ Error getting metrics:', error);
            reply.status(500).send({ success: false, error: error.message });
        }
    }

    /**
     * Create backup
     */
    async createBackup(request, reply) {
        try {
            console.log('📦 Creating backup...');
            const result = await monitoringService.createBackup();
            console.log('✅ Backup created:', result.filename);
            return result;
        } catch (error) {
            console.error('❌ Backup error:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Download backup
     */
    async downloadBackup(request, reply) {
        try {
            const { filename } = request.params;
            console.log('📥 Download request for:', filename);
            // Get backup path (includes security check)
            const backupPath = monitoringService.getBackupPath(filename);
            console.log('📁 Full path:', backupPath);
            // Check if exists
            if (!monitoringService.backupExists(filename)) {
                console.error('❌ File not found:', backupPath);
                return reply.status(404).send({ error: 'Backup not found' });
            }
            // Get file stats
            const stat = monitoringService.getBackupStats(filename);
            console.log('✅ File found, size:', stat.size, 'bytes');
            // Set proper headers for ZIP download
            reply.raw.setHeader('Content-Type', 'application/zip');
            reply.raw.setHeader('Content-Length', stat.size);
            reply.raw.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            reply.raw.setHeader('Cache-Control', 'no-cache');
            // Create read stream
            const stream = fs.createReadStream(backupPath);
            stream.on('error', (err) => {
                console.error('❌ Stream error:', err);
                reply.status(500).send({ error: 'Error reading file' });
            });
            stream.on('end', () => {
                console.log('✅ Download completed:', filename);
            });
            // Send the stream
            return reply.send(stream);
        } catch (error) {
            console.error('❌ Download error:', error);
            // Check if it's our validation error
            if (error.message === 'Invalid filename') {
                return reply.status(400).send({ error: 'Invalid filename' });
            }
            reply.status(500).send({ error: error.message });
        }
    }

    /**
     * Get historical metrics data
     */
    async getHistoricalData(request, reply) {
        try {
            const { range } = request.query;
            const data = await monitoringService.getHistoricalMetrics(range || '24h');
            return { success: true, data };
        } catch (error) {
            console.error('❌ Error getting historical data:', error);
            reply.status(500).send({ success: false, error: error.message });
        }
    }

    /**
     * Get recent logs
     */
    async getRecentLogs(request, reply) {
        try {
            return monitoringService.getRecentLogs();
        } catch (error) {
            console.error('❌ Error getting logs:', error);
            reply.status(500).send({ error: error.message });
        }
    }

    /**
     * Get backups
     */
    async getBackups(request, reply) {
        try {
            return monitoringService.getBackups();
        } catch (error) {
            console.error('❌ Error getting backups:', error);
            reply.status(500).send({ error: error.message });
        }
    }

    /**
     * Handle WebSocket connection for log streaming
     */
    async handleLogStream(connection, req) {
        try {
            // Ensure wss clients set exists (Comment 3)
            if (!monitoringService.wss) {
                monitoringService.wss = { clients: new Set() };
            }
            // Connection is the WebSocket instance in @fastify/websocket
            const socket = connection;
            console.log('🔌 New WebSocket connection request');
            // Add to clients set
            monitoringService.wss.clients.add(socket);
            console.log(`✅ WebSocket client connected. Total: ${monitoringService.wss.clients.size}`);
            // Send recent logs (History)
            const recentLogs = monitoringService.getRecentLogs();
            if (recentLogs && recentLogs.length > 0) {
                try {
                    socket.send(JSON.stringify({ type: 'history', data: recentLogs }));
                } catch (e) {
                    console.error('❌ Error sending history:', e.message);
                }
            }
            // Handle close
            socket.on('close', () => {
                monitoringService.wss.clients.delete(socket);
                console.log(`🔌 WebSocket client disconnected. Total: ${monitoringService.wss.clients.size}`);
            });
            // Handle error
            socket.on('error', (err) => {
                console.error('❌ WebSocket client error:', err.message);
                monitoringService.wss.clients.delete(socket);
            });
        } catch (error) {
            console.error('❌ Error in handleLogStream:', error);
            connection.destroy(); // Close connection on error
        }
    }

    /**
     * Restart server (requires PM2)
     */
    async restartServer(request, reply) {
        try {
            // Check if PM2 is being used
            if (!process.env.PM2_HOME) {
                return {
                    success: false,
                    message: 'PM2 not detected. Manual restart required.'
                };
            }
            console.log('♻️ Server restart initiated...');
            // Send response before restarting
            reply.send({
                success: true,
                message: 'Server restart initiated. Please wait 10-15 seconds...'
            });
            // Delay restart to ensure response is sent
            setTimeout(() => {
                process.exit(0); // PM2 will auto-restart
            }, 1000);
        } catch (error) {
            console.error('❌ Restart error:', error);
            return { success: false, message: error.message };
        }
    }

}
