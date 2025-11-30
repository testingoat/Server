import Product from '../../models/products.js';
import Category from '../../models/category.js';

// Simple in-memory rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 5000; // 5 seconds
const MAX_REQUESTS_PER_WINDOW = 10;

// Typo correction map
const TYPO_CORRECTIONS = {
    'maggie': 'maggi',
    'ata': 'atta',
    'mik': 'milk',
    'mil': 'milk',
    'panner': 'paneer',
    'paner': 'paneer',
    'yougurt': 'yogurt',
    'curd': 'yogurt',
    'biscuit': 'biscuits',
    'choclate': 'chocolate'
};

export const searchSuggest = async (req, reply) => {
    const startTime = Date.now();
    const { q, lat, lng, userId } = req.query;

    // 1. Validate q
    if (!q || typeof q !== 'string') {
        return reply.status(200).send({
            results: [],
            typoCorrected: false,
            originalQuery: q || '',
            correctedQuery: q || ''
        });
    }

    const originalQuery = q.trim().replace(/\s+/g, ' ');

    // Option A: Return empty results for short queries
    if (originalQuery.length < 2) {
        return reply.status(200).send({
            results: [],
            typoCorrected: false,
            originalQuery,
            correctedQuery: originalQuery
        });
    }

    // 2. Rate Limiting
    const ip = req.ip;
    const now = Date.now();
    const clientLimit = rateLimitMap.get(ip) || { count: 0, windowStart: now };

    if (now - clientLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
        // Reset window
        clientLimit.count = 1;
        clientLimit.windowStart = now;
    } else {
        clientLimit.count++;
    }
    rateLimitMap.set(ip, clientLimit);

    if (clientLimit.count > MAX_REQUESTS_PER_WINDOW) {
        return reply.status(429).send({
            results: [],
            error: 'RATE_LIMITED',
            typoCorrected: false,
            originalQuery,
            correctedQuery: originalQuery
        });
    }

    try {
        // 3. Typo Normalization
        let correctedQuery = originalQuery;
        let typoCorrected = false;
        const lowerQuery = originalQuery.toLowerCase();

        if (TYPO_CORRECTIONS[lowerQuery]) {
            correctedQuery = TYPO_CORRECTIONS[lowerQuery];
            typoCorrected = true;
        }

        // 4. Query Data Sources
        const searchRegex = new RegExp(correctedQuery, 'i');

        // Products: Active and Approved
        const productPromise = Product.find({
            name: searchRegex,
            status: 'approved',
            isActive: true
        })
            .select('_id name image soldCount') // Select fields we need
            .limit(20)
            .lean();

        // Categories
        const categoryPromise = Category.find({
            name: searchRegex
        })
            .select('_id name image')
            .limit(10)
            .lean();

        const [products, categories] = await Promise.all([productPromise, categoryPromise]);

        // 5. Shape Results
        const formattedProducts = products.map(p => ({
            type: 'product',
            id: p._id.toString(),
            name: p.name,
            image: p.image || '',
            soldCount: p.soldCount || 0, // Fallback as field might be missing
            typoCorrected
        }));

        const formattedCategories = categories.map(c => ({
            type: 'category',
            id: c._id.toString(),
            name: c.name,
            image: c.image || '',
            soldCount: 0,
            typoCorrected
        }));

        // Combine and Limit
        // Simple ranking: Categories first, then products (or interleave if preferred, but simple concatenation is fine for now)
        // Let's prioritize exact matches or startsWith if we were doing complex sorting, 
        // but for now, just concat and slice.
        const allResults = [...formattedCategories, ...formattedProducts].slice(0, 25);

        // 6. Logging
        const latencyMs = Date.now() - startTime;
        console.log(JSON.stringify({
            type: 'search_log',
            q: originalQuery,
            correctedQuery,
            resultCount: allResults.length,
            lat,
            lng,
            userId,
            latencyMs
        }));

        // 7. Response
        return reply.status(200).send({
            results: allResults,
            typoCorrected,
            originalQuery,
            correctedQuery
        });

    } catch (error) {
        console.error('Search Error:', {
            error: error.message,
            q: originalQuery,
            correctedQuery: originalQuery, // Best effort
            timestamp: new Date().toISOString()
        });

        return reply.status(500).send({
            results: [],
            error: 'TEMPORARY_ERROR',
            typoCorrected: false,
            originalQuery,
            correctedQuery: originalQuery
        });
    }
};

// TODO: Add brand suggestions when brand model exists.
// TODO: Add tests when test framework is ready.
