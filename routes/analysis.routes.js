const express = require('express');
const router = express.Router();
const { ProductAnalysis } = require('../db');
const { protect, admin } = require('../auth.middleware');

// GET /api/products/:id/analysis — lấy bài phân tích
router.get('/:id/analysis', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const analysis = await ProductAnalysis.findOne({ where: { productId } });
    if (!analysis) return res.json({ productId, content: '' });
    res.json(analysis);
  } catch (err) {
    console.error('GET analysis error:', err);
    res.status(500).json({ message: 'Lỗi lấy bài phân tích', error: err.message });
  }
});

// PUT /api/products/:id/analysis — admin cập nhật/tạo bài phân tích
router.put('/:id/analysis', protect, admin, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { content } = req.body;
    if (typeof content === 'undefined') {
      return res.status(400).json({ message: 'Thiếu nội dung bài phân tích' });
    }
    const [analysis, created] = await ProductAnalysis.findOrCreate({
      where: { productId },
      defaults: { productId, content, updatedBy: req.user?.id },
    });
    if (!created) {
      await analysis.update({ content, updatedBy: req.user?.id });
    }
    res.json({ message: 'Đã lưu bài phân tích', analysis });
  } catch (err) {
    console.error('PUT analysis error:', err);
    res.status(500).json({ message: 'Lỗi lưu bài phân tích', error: err.message });
  }
});

module.exports = router;
