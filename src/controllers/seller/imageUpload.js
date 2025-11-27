import { GridFSBucket } from 'mongodb';
import mongoose from 'mongoose';
import { Readable } from 'stream';
// Initialize GridFS bucket for image storage
let bucket;
const initGridFS = () => {
    if (!bucket && mongoose.connection.db) {
        bucket = new GridFSBucket(mongoose.connection.db, {
            bucketName: 'product_images'
        });
        console.log(' GridFS bucket initialized for product images');
    }
    return bucket;
};
// Upload product image
export const uploadProductImage = async (request, reply) => {
    try {
        const sellerId = request.user.userId;
        console.log('📸 Uploading product image for seller:', sellerId);
        console.log('📦 Request body:', request.body);
        console.log('📦 Request body keys:', Object.keys(request.body || {}));

        // Initialize GridFS bucket
        const gridFSBucket = initGridFS();
        if (!gridFSBucket) {
            return reply.code(500).send({
                success: false,
                message: 'File storage system not available'
            });
        }

        // Get the uploaded file - AdminJS multipart uses attachFieldsToBody: true
        // So files are in request.body with a 'file' property
        let data = null;

        // Try different field names that might contain the file
        const possibleFieldNames = ['file', 'image', 'photo', 'upload'];

        for (const fieldName of possibleFieldNames) {
            if (request.body && request.body[fieldName]) {
                const field = request.body[fieldName];
                console.log(`📁 Found field '${fieldName}':`, field);

                // Check if it has a 'file' property (attachFieldsToBody format)
                if (field.file) {
                    data = field;
                    console.log(`✅ Using field '${fieldName}' with file property`);
                    break;
                }
            }
        }

        // If still no data, try request.file() as fallback
        if (!data) {
            console.log('⚠️ No file in body, trying request.file()...');
            try {
                data = await request.file();
                console.log('📁 Got file from request.file():', data ? 'yes' : 'no');
            } catch (error) {
                console.log('❌ Error calling request.file():', error.message);
            }
        }

        if (!data) {
            console.log('❌ No file uploaded - checked body and request.file()');
            return reply.code(400).send({
                success: false,
                message: 'No file uploaded'
            });
        }

        console.log('✅ File data received:', {
            hasFile: !!data.file,
            hasMimetype: !!data.mimetype,
            hasFilename: !!data.filename,
            keys: Object.keys(data)
        });
        // Get the actual file object (handle both formats)
        const fileObj = data.file || data;
        const mimetype = data.mimetype || fileObj.mimetype;
        const filename_original = data.filename || fileObj.filename || 'product-image.jpg';

        console.log('📄 File object:', {
            mimetype,
            filename: filename_original,
            hasToBuffer: typeof fileObj.toBuffer === 'function',
            hasFile: !!data.file
        });

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!mimetype || !allowedTypes.includes(mimetype)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
            });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const originalName = filename_original;
        const extension = originalName.split('.').pop() || 'jpg';
        const filename = 'product_' + sellerId + '_' + timestamp + '.' + extension;

        // Create upload stream
        const uploadStream = gridFSBucket.openUploadStream(filename, {
            metadata: {
                sellerId: sellerId,
                originalName: originalName,
                mimetype: mimetype,
                uploadedAt: new Date()
            }
        });

        // Convert buffer to stream and pipe to GridFS
        const bufferStream = new Readable();
        let buffer;

        // Get buffer from file (handle both formats)
        // With attachFieldsToBody: true, the buffer is in data._buf and data.toBuffer()
        if (typeof data.toBuffer === 'function') {
            console.log('📦 Using data.toBuffer()');
            buffer = await data.toBuffer();
        } else if (data._buf) {
            console.log('📦 Using data._buf');
            buffer = data._buf;
        } else if (typeof fileObj.toBuffer === 'function') {
            console.log('📦 Using fileObj.toBuffer()');
            buffer = await fileObj.toBuffer();
        } else if (fileObj._buf) {
            console.log('📦 Using fileObj._buf');
            buffer = fileObj._buf;
        } else {
            console.log('❌ No buffer found in:', {
                dataKeys: Object.keys(data),
                fileObjKeys: Object.keys(fileObj),
                hasDataToBuffer: typeof data.toBuffer,
                hasDataBuf: !!data._buf,
                hasFileObjToBuffer: typeof fileObj.toBuffer,
                hasFileObjBuf: !!fileObj._buf
            });
            throw new Error('Unable to get file buffer');
        }

        console.log('📦 Buffer size:', buffer.length, 'bytes');

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (buffer.length > maxSize) {
            return reply.code(400).send({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }

        bufferStream.push(buffer);
        bufferStream.push(null);
        // Upload the file
        await new Promise((resolve, reject) => {
            bufferStream.pipe(uploadStream)
                .on('error', reject)
                .on('finish', resolve);
        });
        const imageUrl = '/api/seller/images/' + uploadStream.id;
        console.log(' Product image uploaded successfully:', filename);
        return reply.code(200).send({
            success: true,
            data: {
                imageId: uploadStream.id,
                imageUrl: imageUrl,
                filename: filename
            },
            message: 'Image uploaded successfully'
        });
    }
    catch (error) {
        console.error(' Error uploading product image:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to upload image'
        });
    }
};
// Get product image
export const getProductImage = async (request, reply) => {
    try {
        const imageId = request.params.id;
        console.log(' Retrieving product image:', imageId);
        // Initialize GridFS bucket
        const gridFSBucket = initGridFS();
        if (!gridFSBucket) {
            return reply.code(500).send({
                success: false,
                message: 'File storage system not available'
            });
        }
        // Find the file
        const files = await gridFSBucket.find({ _id: new mongoose.Types.ObjectId(imageId) }).toArray();
        if (files.length === 0) {
            return reply.code(404).send({
                success: false,
                message: 'Image not found'
            });
        }
        const file = files[0];
        // Set appropriate headers
        reply.header('Content-Type', file.metadata.mimetype || 'image/jpeg');
        reply.header('Content-Length', file.length);
        reply.header('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        // Stream the file
        const downloadStream = gridFSBucket.openDownloadStream(new mongoose.Types.ObjectId(imageId));
        return reply.send(downloadStream);
    }
    catch (error) {
        console.error(' Error retrieving product image:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to retrieve image'
        });
    }
};
// Delete product image
export const deleteProductImage = async (request, reply) => {
    try {
        const sellerId = request.user.userId;
        const imageId = request.params.id;
        console.log(' Deleting product image:', imageId, 'for seller:', sellerId);
        // Initialize GridFS bucket
        const gridFSBucket = initGridFS();
        if (!gridFSBucket) {
            return reply.code(500).send({
                success: false,
                message: 'File storage system not available'
            });
        }
        // Find the file and verify ownership
        const files = await gridFSBucket.find({ _id: new mongoose.Types.ObjectId(imageId) }).toArray();
        if (files.length === 0) {
            return reply.code(404).send({
                success: false,
                message: 'Image not found'
            });
        }
        const file = files[0];
        if (file.metadata.sellerId !== sellerId) {
            return reply.code(403).send({
                success: false,
                message: 'Access denied'
            });
        }
        // Delete the file
        await gridFSBucket.delete(new mongoose.Types.ObjectId(imageId));
        console.log(' Product image deleted successfully');
        return reply.code(200).send({
            success: true,
            message: 'Image deleted successfully'
        });
    }
    catch (error) {
        console.error(' Error deleting product image:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to delete image'
        });
    }
};
