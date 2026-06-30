const express = require('express');
const router = express.Router();
const { Review, Product } = require('../db');
const { protect } = require('../auth.middleware');

// GET /api/products/:id/reviews — danh sách đánh giá + tổng hợp rating
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

    // Rating distribution (1-5 stars)
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

// POST /api/products/:id/reviews — gửi đánh giá mới (không cần đăng nhập)
router.post('/:id/reviews', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { rating, name, comment, userId, badge } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating phải từ 1-5 sao' });
    }

    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });

    const review = await Review.create({
      productId,
      rating: parseInt(rating),
      name: name?.trim() || 'Khách hàng ẩn danh',
      comment: comment?.trim() || null,
      userId: userId || null,
      badge: badge || null,
    });

    // Cập nhật rating và review count trên Product
    const allReviews = await Review.findAll({ where: { productId }, attributes: ['rating'] });
    const newAvg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await product.update({
      rating: Math.round(newAvg * 10) / 10,
      reviews: allReviews.length,
    });

    res.status(201).json({ message: 'Đánh giá đã được ghi nhận!', review });
  } catch (err) {
    console.error('POST review error:', err);
    res.status(500).json({ message: 'Lỗi lưu đánh giá', error: err.message });
  }
});

module.exports = router;
