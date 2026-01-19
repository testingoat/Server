import Product from '../../models/products.js';

// Get full product details by ID
export const getProductById = async (req, reply) => {
    const { productId } = req.params;
    try {
        const product = await Product.findById(productId)
            .populate('category', 'name image')
            .populate('seller', 'storeName name')
            .exec();

        if (!product) {
            return reply.status(404).send({
                success: false,
                message: 'Product not found'
            });
        }

        // Only return if approved and active
        if (product.status !== 'approved' || !product.isActive) {
            return reply.status(404).send({
                success: false,
                message: 'Product not available'
            });
        }

        // Combine primary image with additional images for convenience
        const allImages = [product.image];
        if (product.additionalImages && product.additionalImages.length > 0) {
            allImages.push(...product.additionalImages);
        }

        // Return product with computed fields
        return reply.send({
            success: true,
            data: {
                ...product.toObject(),
                allImages, // Convenience array with all images
            }
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        return reply.status(500).send({
            success: false,
            message: 'An error occurred',
            error: error.message
        });
    }
};

// Get related products (same category, excluding current product)
export const getRelatedProducts = async (req, reply) => {
    const { productId } = req.params;
    const limit = parseInt(req.query.limit) || 6;

    try {
        // First get the current product to find its category
        const currentProduct = await Product.findById(productId).select('category');

        if (!currentProduct) {
            return reply.status(404).send({
                success: false,
                message: 'Product not found'
            });
        }

        // Find related products from same category
        const relatedProducts = await Product.find({
            category: currentProduct.category,
            _id: { $ne: productId },
            status: 'approved',
            isActive: true
        })
            .select('name image price discountPrice quantity')
            .limit(limit)
            .exec();

        return reply.send({
            success: true,
            data: relatedProducts
        });
    } catch (error) {
        console.error('Error fetching related products:', error);
        return reply.status(500).send({
            success: false,
            message: 'An error occurred',
            error: error.message
        });
    }
};
