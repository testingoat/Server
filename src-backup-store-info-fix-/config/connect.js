import mongoose from 'mongoose';
export const connectDB = async (uri) => {
    try {
        // Optimized connection options for cloud MongoDB
        const options = {
            // Connection pool settings for better performance
            maxPoolSize: 10, // Maximum number of connections
            minPoolSize: 2, // Minimum number of connections
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
            serverSelectionTimeoutMS: 5000, // How long to try selecting a server
            socketTimeoutMS: 45000, // How long a send or receive on a socket can take
            // Retry settings
            retryWrites: true,
            retryReads: true,
            // Compression for better performance over network
        };
        await mongoose.connect(uri, options);
        console.log('🚀 DB CONNECTED SUCCESSFULLY ✅');
        console.log(`📊 Connection State: ${mongoose.connection.readyState}`);
        console.log(`🌐 Database: ${mongoose.connection.name}`);
        console.log(`🔗 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
        // Connection event listeners for monitoring
        mongoose.connection.on('connected', () => {
            console.log('📡 Mongoose connected to MongoDB');
        });
        mongoose.connection.on('error', (err) => {
            console.error('❌ Mongoose connection error:', err);
        });
        mongoose.connection.on('disconnected', () => {
            console.log('📴 Mongoose disconnected from MongoDB');
        });
        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('🔄 Mongoose connection closed through app termination');
            process.exit(0);
        });
    }
    catch (error) {
        console.error('💥 Database connection error:', error);
        console.error('🔍 Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
        });
        // Retry connection after 5 seconds
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(() => connectDB(uri), 5000);
    }
};
