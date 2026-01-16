import crypto from 'crypto';
import Category from '../../models/category.js';
import HomeConfig from '../../models/homeConfig.js';

const buildEtag = (payload) => {
  return crypto.createHash('sha1').update(payload).digest('hex');
};

export const getHome = async (request, reply) => {
  try {
    const activeConfig = await HomeConfig.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();

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

    const sections = [];

    // Banner carousel: keep existing ad carousel behavior by returning empty list if not configured here.
    // You can wire this to your existing banner source later without changing the client contract.
    sections.push({
      type: 'banner_carousel',
      data: {
        items: Array.isArray(activeConfig?.bannerCarousel)
          ? activeConfig.bannerCarousel.filter((b) => b && b.isActive !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [],
      },
    });

    // Safe fallback: if no grids configured yet, show first categories so Home never becomes blank.
    if (activeGrids.length === 0) {
      const fallbackCategories = await Category.find({}).sort({ name: 1 }).limit(8).select('name image').lean();
      sections.push({
        type: 'category_grid',
        data: {
          title: 'Shop',
          tiles: fallbackCategories.map((c) => ({
            categoryId: String(c._id),
            label: c.name,
            imageUrl: c.image,
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

      sections.push({
        type: 'category_grid',
        data: {
          title: grid.title,
          tiles,
        },
      });
    }

    const responseBody = {
      layoutVersion,
      sections,
    };

    // Caching + ETag
    const etagSeed = `${layoutVersion}:${activeConfig?.updatedAt?.toISOString?.() ?? 'none'}`;
    const etag = buildEtag(etagSeed);
    reply.header('ETag', etag);
    reply.header('Cache-Control', 'public, max-age=300');

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    return reply.send(responseBody);
  } catch (error) {
    return reply.status(500).send({ message: 'Failed to load home config' });
  }
};
