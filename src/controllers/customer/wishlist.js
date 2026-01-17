import { Customer } from '../../models/index.js';
import Product from '../../models/products.js';

const requireCustomer = (request, reply) => {
  if (!request.user?.userId) {
    reply.code(401).send({ message: 'Unauthorized' });
    return null;
  }
  if (request.user?.role && request.user.role !== 'Customer') {
    reply.code(403).send({ message: 'Forbidden' });
    return null;
  }
  return String(request.user.userId);
};

export const getWishlist = async (request, reply) => {
  const userId = requireCustomer(request, reply);
  if (!userId) return;

  const customer = await Customer.findById(userId).lean();
  const wishlistIds = Array.isArray(customer?.wishlist) ? customer.wishlist.map((id) => String(id)) : [];

  if (wishlistIds.length === 0) {
    return reply.send({ items: [] });
  }

  const products = await Product.find({
    _id: { $in: wishlistIds },
    status: 'approved',
    isActive: true,
  })
    .select('name image price discountPrice quantity')
    .lean();

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const ordered = wishlistIds
    .map((id) => productMap.get(id))
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

  return reply.send({ items: ordered });
};

export const addWishlistItem = async (request, reply) => {
  const userId = requireCustomer(request, reply);
  if (!userId) return;

  const productId = request.body?.productId;
  if (!productId) return reply.code(400).send({ message: 'productId is required' });

  await Customer.updateOne(
    { _id: userId },
    { $addToSet: { wishlist: productId } },
  );

  return reply.send({ success: true });
};

export const removeWishlistItem = async (request, reply) => {
  const userId = requireCustomer(request, reply);
  if (!userId) return;

  const productId = request.params?.productId;
  if (!productId) return reply.code(400).send({ message: 'productId is required' });

  await Customer.updateOne(
    { _id: userId },
    { $pull: { wishlist: productId } },
  );

  return reply.send({ success: true });
};

