import crypto from 'crypto';
import Category from '../../models/category.js';
import HomeConfig from '../../models/homeConfig.js';
import Product from '../../models/products.js';
import ThemeConfig from '../../models/themeConfig.js';

const buildEtag = (payload) => {
  return crypto.createHash('sha1').update(payload).digest('hex');
};

export const getHome = async (request, reply) => {
  try {
    const activeConfig = await HomeConfig.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
    const activeTheme = await ThemeConfig.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();

    const layoutVersion = activeConfig?.layoutVersion ?? 1;

    const categoryGrids = Array.isArray(activeConfig?.categoryGrids) ? activeConfig.categoryGrids : [];
    const activeGrids = categoryGrids
      .filter((grid) => grid && grid.isActive !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const allTiles = activeGrids.flatMap((grid) => Array.isArray(grid.tiles) ? grid.tiles : []);
    const activeTiles = allTiles.filter((tile) => tile && tile.isActive !== false && tile.categoryId);

    const categoryIds = [...new Set(activeTiles.map((t) => String(t.categoryId)))];
    const categories = categoryIds.length > 0
      ? await Category.find({ _id: { $in: categoryIds } }).select('name image').lean()
      : [];

    const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

    const orderedSections = [];

    const theme = {
      headerGradientTop: activeTheme?.headerGradientTop ?? '#2D3875',
      headerGradientBottom: activeTheme?.headerGradientBottom ?? '#5B6EA7',
    };

    // Offer sections (manual product IDs)
    const offerSections = Array.isArray(activeConfig?.offerSections) ? activeConfig.offerSections : [];
    const activeOfferSections = offerSections
      .filter((s) => s && s.isActive !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Banner carousel (acts as a section too)
    orderedSections.push({
      order: 50,
      type: 'banner_carousel',
      data: {
        items: Array.isArray(activeConfig?.bannerCarousel)
          ? activeConfig.bannerCarousel.filter((b) => b && b.isActive !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [],
      },
    });

    // Banner strips
    const bannerStrips = Array.isArray(activeConfig?.bannerStrips) ? activeConfig.bannerStrips : [];
    for (const strip of bannerStrips.filter((s) => s && s.isActive !== false)) {
      orderedSections.push({
        order: strip.order ?? 0,
        type: 'banner_strip',
        data: {
          imageUrl: strip.imageUrl,
          deepLink: strip.deepLink,
        },
      });
    }

    // Safe fallback: if no grids configured yet, show first categories so Home never becomes blank.
    if (activeGrids.length === 0) {
      const fallbackCategories = await Category.find({}).sort({ name: 1 }).limit(8).select('name image').lean();
      orderedSections.push({
        order: 100,
        type: 'category_grid',
        data: {
          title: 'Shop',
          tiles: fallbackCategories.map((c) => ({
            categoryId: String(c._id),
            label: c.name,
            name: c.name,
            imageUrl: c.image,
            image: c.image,
          })),
        },
      });
    }

    for (const grid of activeGrids) {
      const tiles = (Array.isArray(grid.tiles) ? grid.tiles : [])
        .filter((tile) => tile && tile.isActive !== false && tile.categoryId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((tile) => {
          const category = categoryMap.get(String(tile.categoryId));
          if (!category) return null; // orphan tile

          return {
            categoryId: String(category._id),
            label: tile.labelOverride ?? category.name,
            name: tile.labelOverride ?? category.name,
            imageUrl: tile.imageOverrideUrl ?? category.image,
            image: tile.imageOverrideUrl ?? category.image,
          };
        })
        .filter(Boolean);

      orderedSections.push({
        order: grid.order ?? 0,
        type: 'category_grid',
        data: {
          title: grid.title,
          tiles,
        },
      });
    }

    // Offer sections order: by offer.order
    for (const offer of activeOfferSections) {
      const productIds = (Array.isArray(offer.productIds) ? offer.productIds : [])
        .map((id) => String(id))
        .filter(Boolean);

      const products = productIds.length > 0
        ? await Product.find({
          _id: { $in: productIds },
          status: 'approved',
          isActive: true,
        })
          .select('name image price discountPrice quantity')
          .lean()
        : [];

      const productMap = new Map(products.map((p) => [String(p._id), p]));
      const orderedProducts = productIds
        .map((id) => productMap.get(String(id)))
        .filter(Boolean)
        .map((p) => ({
          _id: String(p._id),
          name: p.name,
          image: p.image,
          imageUrl: p.image,
          price: p.price,
          discountPrice: p.discountPrice,
          quantity: p.quantity,
        }));

      orderedSections.push({
        order: offer.order ?? 0,
        type: 'offer_products',
        data: {
          title: offer.title,
          titleVariant: offer.titleVariant,
          titleColor: offer.titleColor,
          seeAllLabel: offer.seeAllLabel,
          seeAllDeepLink: offer.seeAllDeepLink,
          showAddButton: offer.showAddButton !== false,
          showDiscountBadge: offer.showDiscountBadge !== false,
          products: orderedProducts,
        },
      });
    }

    const sections = orderedSections
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(({ type, data }) => ({ type, data }));

    const responseBody = {
      layoutVersion,
      theme,
      sections,
    };

    const requestCacheControl = String(request.headers['cache-control'] || '');
    const bypassCache = requestCacheControl.includes('no-cache') || requestCacheControl.includes('no-store') || request.query?.t;

    // Caching + ETag (default small TTL; can override via env)
    const etagSeed = `${layoutVersion}:${activeConfig?.updatedAt?.toISOString?.() ?? 'none'}`;
    const etag = buildEtag(etagSeed);
    reply.header('ETag', etag);

    const ttlSeconds = Number(process.env.HOME_CACHE_TTL_SECONDS ?? 60);
    reply.header('Cache-Control', bypassCache ? 'no-store' : `public, max-age=${ttlSeconds}`);

    if (!bypassCache && request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    return reply.send(responseBody);
  } catch (error) {
    return reply.status(500).send({ message: 'Failed to load home config' });
  }
};
