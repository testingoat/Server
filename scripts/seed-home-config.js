import HomeConfig from '../src/models/homeConfig.js';
import Category from '../src/models/category.js';
import { connectDB } from '../src/config/connect.js';

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI environment variable is required');
  }

  await connectDB(process.env.MONGO_URI);

  const existing = await HomeConfig.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
  if (existing) {
    console.log('Active HomeConfig already exists, skipping seed.');
    process.exit(0);
  }

  const categories = await Category.find({}).sort({ name: 1 }).limit(8).lean();

  const doc = await HomeConfig.create({
    isActive: true,
    layoutVersion: 1,
    bannerCarousel: [],
    categoryGrids: [
      {
        title: 'Grocery & Kitchen',
        order: 0,
        isActive: true,
        tiles: categories.map((c, idx) => ({
          categoryId: c._id,
          order: idx,
          isActive: true,
        })),
      },
    ],
  });

  console.log('Seeded HomeConfig:', String(doc._id));
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

