const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Review, Product, Order, User } = require('../db');
const { protect, admin } = require('../auth.middleware');

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const itemMatchesProduct = (item, productId) => Number(item?.productId ?? item?.id) === Number(productId);

const updateProductReviewStats = async (productId, product) => {
  const targetProduct = product || await Product.findByPk(productId);
  if (!targetProduct) return;
  const allReviews = await Review.findAll({ where: { productId }, attributes: ['rating'] });
  const total = allReviews.length;
  const newAvg = total > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
  await targetProduct.update({
    rating: total > 0 ? Math.round(newAvg * 10) / 10 : 0,
    reviews: total,
  });
};

const hasPurchasedProduct = async ({ email, productId }) => {
  if (!email) return false;
  const orders = await Order.findAll({
    where: {
      customerEmail: { [Op.iLike]: String(email).trim() },
      orderStatus: 'delivered',
    },
    attributes: ['id', 'orderItems'],
  });
  return orders.some((order) => {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    return items.some((item) => itemMatchesProduct(item, productId));
  });
};

router.get('/:id/reviews', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    const { count, rows } = await Review.findAndCountAll({
      where: { productId },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const allReviews = await Review.findAll({ where: { productId }, attributes: ['rating'] });
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach(r => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });
    const totalCount = allReviews.length;
    const avgRating = totalCount > 0
      ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / totalCount) * 10) / 10
      : 0;

    res.json({
      reviews: rows,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      summary: { avgRating, totalCount, distribution },
    });
  } catch (err) {
    console.error('GET reviews error:', err);
    res.status(500).json({ message: 'Lỗi lấy đánh giá', error: err.message });
  }
});

router.get('/:id/reviews/eligibility', protect, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const canReview = await hasPurchasedProduct({ email: req.user?.email, productId });
    res.json({ canReview, reason: canReview ? 'purchased' : 'not_purchased' });
  } catch (err) {
    console.error('GET review eligibility error:', err);
    res.status(500).json({ message: 'Lỗi kiểm tra quyền đánh giá', error: err.message });
  }
});

router.post('/:id/reviews', protect, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating phải từ 1-5 sao' });
    }
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    const canReview = await hasPurchasedProduct({ email: req.user?.email, productId });
    if (!canReview) {
      return res.status(403).json({ message: 'Bạn cần đăng nhập bằng tài khoản đã mua và nhận sản phẩm này để đánh giá.' });
    }
    const user = isUuid(req.user?.id) ? await User.findByPk(req.user.id, { attributes: ['id', 'name'] }) : null;
    const review = await Review.create({
      productId,
      rating: parseInt(rating),
      name: user?.name || 'Khách hàng đã mua',
      comment: String(comment || '').trim() || null,
      userId: isUuid(req.user?.id) ? req.user.id : null,
      badge: 'verified',
    });
    await updateProductReviewStats(productId, product);
    res.status(201).json({ message: 'Đánh giá đã được ghi nhận!', review });
  } catch (err) {
    console.error('POST review error:', err);
    res.status(500).json({ message: 'Lỗi lưu đánh giá', error: err.message });
  }
});

router.post('/:id/reviews/admin', protect, admin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { rating, name, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating phải từ 1-5 sao' });
    }
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    const review = await Review.create({
      productId,
      rating: parseInt(rating),
      name: String(name || '').trim() || 'Khách hàng ShopTech',
      comment: String(comment || '').trim() || null,
      userId: null,
      badge: 'admin',
    });
    await updateProductReviewStats(productId, product);
    res.status(201).json({ message: 'Đã thêm đánh giá ảo', review });
  } catch (err) {
    console.error('POST admin review error:', err);
    res.status(500).json({ message: 'Lỗi thêm đánh giá ảo', error: err.message });
  }
});

router.delete('/:id/reviews/:reviewId', protect, admin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const reviewId = parseInt(req.params.reviewId);
    const review = await Review.findOne({ where: { id: reviewId, productId } });
    if (!review) return res.status(404).json({ message: 'Không tìm thấy đánh giá cần xóa' });
    await review.destroy();
    await updateProductReviewStats(productId);
    res.json({ message: 'Đã xóa đánh giá thành công!' });
  } catch (err) {
    console.error('DELETE review error:', err);
    res.status(500).json({ message: 'Lỗi xóa đánh giá', error: err.message });
  }
});

module.exports = router;
