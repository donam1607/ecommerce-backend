const express = require('express');
const router = express.Router();
const { Order, Product } = require('../db');
const { protect, admin } = require('../auth.middleware');

// GET /api/orders - Lấy tất cả đơn hàng (Admin)
router.get('/', protect, admin, async (req, res) => {
  try {
    const orders = await Order.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải đơn hàng', error: error.message });
  }
});

// GET /api/orders/my-orders - Lấy đơn hàng của người dùng hiện tại
router.get('/my-orders', protect, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { customerEmail: req.user.email },
      order: [['createdAt', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải đơn hàng của bạn', error: error.message });
  }
});

// POST /api/orders - Tạo đơn hàng mới (User hoặc Guest)
router.post('/', async (req, res) => {
  try {
    const { 
      customerName, 
      customerEmail, 
      customerPhone, 
      customerAddress, 
      paymentMethod, 
      totalAmount, 
      orderItems,
      couponCode,
      discountAmount
    } = req.body;
    
    // Tạo đơn hàng mới
    const order = await Order.create({
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'pending',
      totalAmount,
      orderItems,
      couponCode: couponCode || null,
      discountAmount: discountAmount || 0
    });

    // Cập nhật số lượng tồn kho của sản phẩm
    for (const item of orderItems) {
      const product = await Product.findByPk(item.productId);
      if (product) {
        const newStock = Math.max(0, product.countInStock - item.quantity);
        await product.update({ countInStock: newStock });
      }
    }

    // Tăng lượt sử dụng của Coupon nếu có
    if (couponCode) {
      const { Coupon } = require('../db');
      const coupon = await Coupon.findOne({ where: { code: couponCode.toUpperCase().trim() } });
      if (coupon) {
        await coupon.increment('usedCount');
      }
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: 'Không thể tạo đơn hàng', error: error.message });
  }
});


// PUT /api/orders/:id/status - Cập nhật trạng thái thanh toán bất kỳ (Admin)
router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
    }
    
    await order.update({ paymentStatus });
    res.json({ message: 'Cập nhật trạng thái hóa đơn thành công!', order });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái hóa đơn', error: error.message });
  }
});

// PUT /api/orders/:id/paid - Xác nhận đã thanh toán thành công (Admin)
router.put('/:id/paid', protect, admin, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
    }
    
    await order.update({ paymentStatus: 'paid' });
    res.json({ message: 'Đơn hàng đã được xác nhận thanh toán thành công!', order });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xác nhận thanh toán', error: error.message });
  }
});

// DELETE /api/orders/:id - Xóa đơn hàng (Admin)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
    }
    await order.destroy();
    res.json({ message: 'Đã xóa hóa đơn thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa đơn hàng', error: error.message });
  }
});

module.exports = router;
