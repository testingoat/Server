/**
 * Product Image Upload Controller
 * Uses Cloudflare R2 for storage (replaces GridFS)
 */
import { uploadToR2, deleteFromR2, extractKeyFromUrl } from '../../services/r2Storage.js';

// Upload product image to R2
export const uploadProductImage = async (request, reply) => {
    try {
        const sellerId = request.user.userId;
        console.log('📸 Uploading product image for seller:', sellerId);

        // Get the uploaded file
        let data = null;

        // Try different field names that might contain the file
        const possibleFieldNames = ['file', 'image', 'photo', 'upload'];

        for (const fieldName of possibleFieldNames) {
            if (request.body && request.body[fieldName]) {
                const field = request.body[fieldName];
                console.log(`📁 Found field '${fieldName}':`, field);

                if (field.file || field.toBuffer) {
                    data = field;
                    console.log(`✅ Using field '${fieldName}'`);
                    break;
                }
            }
        }

        // Try request.file() as fallback
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
            console.log('❌ No file uploaded');
            return reply.code(400).send({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Get file details
        const fileObj = data.file || data;
        const mimetype = data.mimetype || fileObj.mimetype;
        const filename_original = data.filename || fileObj.filename || 'product-image.jpg';

        console.log('📄 File details:', { mimetype, filename: filename_original });

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!mimetype || !allowedTypes.includes(mimetype)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
            });
        }

        // Get buffer
        let buffer;
        if (typeof data.toBuffer === 'function') {
            buffer = await data.toBuffer();
        } else if (data._buf) {
            buffer = data._buf;
        } else if (typeof fileObj.toBuffer === 'function') {
            buffer = await fileObj.toBuffer();
        } else if (fileObj._buf) {
            buffer = fileObj._buf;
        } else {
            console.log('❌ Unable to get file buffer');
            throw new Error('Unable to get file buffer');
        }

        console.log('📦 Buffer size:', buffer.length, 'bytes');

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (buffer.length > maxSize) {
            return reply.code(400).send({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const extension = filename_original.split('.').pop() || 'jpg';
        const filename = `product_${sellerId}_${timestamp}.${extension}`;

        // Upload to R2
        const result = await uploadToR2(buffer, filename, mimetype, {
            sellerId: sellerId,
            originalName: filename_original,
        });

        console.log('✅ Product image uploaded to R2:', result.url);

        return reply.code(200).send({
            success: true,
            data: {
                imageId: result.key,  // Store key for deletion
                imageUrl: result.url, // Full public URL
                filename: filename
            },
            message: 'Image uploaded successfully'
        });
    } catch (error) {
        console.error('❌ Error uploading product image:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to upload image: ' + error.message
        });
    }
};

// Delete product image from R2
export const deleteProductImage = async (request, reply) => {
    try {
        const sellerId = request.user.userId;
        const imageKey = request.params.id;

        console.log('🗑️ Deleting product image:', imageKey, 'for seller:', sellerId);

        // Delete from R2
        await deleteFromR2(imageKey);

        console.log('✅ Product image deleted successfully');

        return reply.code(200).send({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting product image:', error);
        return reply.code(500).send({
            success: false,
            message: 'Failed to delete image'
        });
    }
};

// Note: getProductImage is no longer needed
// Images are served directly from R2 CDN URL
