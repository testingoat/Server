/**
 * Cloudflare R2 Storage Service
 * Handles file uploads and deletions to R2 bucket
 * 
 * Account: Testingoat24@gmail.com
 * Account ID: 9ba921e87522a37a0c68ab1fb1714073
 * Bucket: goatgoat-assets
 * Folder: products/ (for product images)
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// R2 Configuration - using environment variables
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '9ba921e87522a37a0c68ab1fb1714073';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'goatgoat-assets';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-944071cb05354e0a88fc366c307eabe2.r2.dev';

// Folder prefix for product images
const PRODUCT_FOLDER = 'products';

// Initialize S3 client for R2
const getR2Client = () => {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error('R2 credentials not configured. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in environment.');
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
};

/**
 * Upload a product image to R2
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Unique filename to store
 * @param {string} contentType - MIME type
 * @param {object} metadata - Optional metadata
 * @returns {Promise<{key: string, url: string}>}
 */
export const uploadToR2 = async (buffer, filename, contentType, metadata = {}) => {
    const client = getR2Client();

    // Store in products folder
    const key = `${PRODUCT_FOLDER}/${filename}`;

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
            ...metadata,
            uploadedAt: new Date().toISOString(),
        },
    });

    await client.send(command);

    // Construct public URL
    // If R2_PUBLIC_URL is set, use it; otherwise construct default R2.dev URL
    let url;
    if (R2_PUBLIC_URL) {
        url = `${R2_PUBLIC_URL}/${key}`;
    } else {
        // Default R2 public URL format (requires public access to be enabled on bucket)
        url = `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`;
    }

    console.log('✅ R2 Upload successful:', key);

    return {
        key: key,
        url: url,
    };
};

/**
 * Delete a file from R2
 * @param {string} keyOrUrl - The file key or full URL to delete
 * @returns {Promise<boolean>}
 */
export const deleteFromR2 = async (keyOrUrl) => {
    const client = getR2Client();

    // Extract key from URL if needed
    const key = extractKeyFromUrl(keyOrUrl);

    if (!key) {
        console.log('⚠️ No key to delete');
        return false;
    }

    const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });

    await client.send(command);
    console.log('✅ R2 Delete successful:', key);

    return true;
};

/**
 * Extract the key (path) from an R2 URL
 * @param {string} url - The full R2 URL or just the key
 * @returns {string|null} The file key
 */
export const extractKeyFromUrl = (url) => {
    if (!url) return null;

    // If it's already a path (starts with products/), return as-is
    if (url.startsWith(PRODUCT_FOLDER + '/')) {
        return url;
    }

    // Handle full URLs
    try {
        const urlObj = new URL(url);
        // Get the pathname and remove leading slash
        return urlObj.pathname.substring(1);
    } catch {
        // If URL parsing fails, return as-is (might be a key)
        return url;
    }
};

export default {
    uploadToR2,
    deleteFromR2,
    extractKeyFromUrl,
};
