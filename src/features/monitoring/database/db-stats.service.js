import mongoose from 'mongoose';

export class DbStatsService {
    async getStats() {
        try {
            if (mongoose.connection.readyState !== 1) {
                return { status: 'disconnected' };
            }

            const db = mongoose.connection.db;
            const admin = db.admin();

            // Parallelize independent stats fetching
            const [dbStats, serverStatus, collections] = await Promise.all([
                db.stats(),
                admin.serverStatus(),
                db.listCollections().toArray()
            ]);

            // Get per-collection stats
            const collectionStats = await Promise.all(
                collections.map(async (col) => {
                    const stats = await db.command({ collStats: col.name });
                    return {
                        name: col.name,
                        count: stats.count,
                        size: stats.size,
                        avgObjSize: stats.avgObjSize,
                        storageSize: stats.storageSize,
                        indexes: stats.nindexes
                    };
                })
            );

            return {
                status: 'connected',
                storage: {
                    dataSize: dbStats.dataSize,
                    storageSize: dbStats.storageSize,
                    indexSize: dbStats.indexSize,
                    objects: dbStats.objects,
                    avgObjSize: dbStats.avgObjSize
                },
                connections: {
                    current: serverStatus.connections.current,
                    available: serverStatus.connections.available,
                    active: serverStatus.connections.active
                },
                opcounters: serverStatus.opcounters,
                mem: serverStatus.mem,
                collections: collectionStats.sort((a, b) => b.size - a.size) // Sort by size desc
            };

        } catch (error) {
            console.error('Error fetching DB stats:', error);
            throw error;
        }
    }
}
