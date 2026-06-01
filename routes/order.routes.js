const express = require('express');
const router = express.Router();
const { Order, Product } = require('../db');
const { protect, admin } = require('../auth.middleware');

// ---------------------------------------------------------
// HELPER: MÁY TRẠNG THÁI KHO HÀNG TỰ ĐỘNG (STOCK TRANSITIONS)
// ---------------------------------------------------------
async function updateOrderAndManageInventory(order, updates, user) {
  const oldPaymentStatus = order.paymentStatus;
  const oldOrderStatus = order.orderStatus;

  // Tự động gán người duyệt đơn nếu chuyển trạng thái từ Chờ duyệt (pending) sang Đang đóng gói (processing)
  if (updates.orderStatus === 'processing' && oldOrderStatus === 'pending') {
    updates.approvedBy = user ? (user.name || user.email || 'Admin') : 'Admin';
  }

  // Thực hiện cập nhật vào database
  await order.update(updates);

  const newPaymentStatus = order.paymentStatus;
  const newOrderStatus = order.orderStatus;

  // Quy tắc trừ kho: Đơn hàng ở trạng thái Đã thanh toán (paid) và KHÔNG phải trạng thái Hủy (cancelled)/Trả hàng (returned)
  const isInventorySubtracted = (payStatus, ordStatus) => {
    return payStatus === 'paid' && ordStatus !== 'cancelled' && ordStatus !== 'returned';
  };

  const wasSubtracted = isInventorySubtracted(oldPaymentStatus, oldOrderStatus);
  const isSubtracted = isInventorySubtracted(newPaymentStatus, newOrderStatus);

  if (!wasSubtracted && isSubtracted) {
    // THỰC HIỆN TRỪ KHO
    for (const item of order.orderItems) {
      const product = await Product.findByPk(item.productId);
      if (product) {
        const newStock = Math.max(0, product.countInStock - item.quantity);
        await product.update({ countInStock: newStock });
      }
    }
    console.log(`📦 Kho hàng: Đã TRỪ số lượng tồn kho của đơn hàng #${order.id} (Trạng thái: Đã thanh toán).`);
  } else if (wasSubtracted && !isSubtracted) {
    // THỰC HIỆN HOÀN KHO
    for (const item of order.orderItems) {
      const product = await Product.findByPk(item.productId);
      if (product) {
        const newStock = product.countInStock + item.quantity;
        await product.update({ countInStock: newStock });
      }
    }
    console.log(`📦 Kho hàng: Đã HOÀN TRẢ số lượng tồn kho của đơn hàng #${order.id} (Hủy đơn/Trả hàng/Đổi trạng thái thanh toán).`);
  }

  return order;
}

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

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
    
    // Mặc định tạo đơn hàng ở trạng thái Chờ duyệt (pending), chưa trừ kho
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
      discountAmount: discountAmount || 0,
      orderStatus: 'pending' // Mặc định là Chờ duyệt
    });

    // Chỉ trừ kho ngay lập tức nếu đơn hàng được xác định Đã thanh toán ngay từ đầu (ví dụ: qua cổng VNPAY/Paypal tự động xác nhận paid)
    if (order.paymentStatus === 'paid') {
      for (const item of orderItems) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          const newStock = Math.max(0, product.countInStock - item.quantity);
          await product.update({ countInStock: newStock });
        }
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

// PUT /api/orders/:id - Cập nhật chi tiết đơn hàng toàn diện (Admin / Sales)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      paymentStatus,
      orderStatus,
      shippingUnit,
      trackingNumber,
      shippingFee,
      serialNumbers
    } = req.body;

    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại.' });
    }

    // LUẬT KHÓA EDIT (LOCK RULES):
    // Nếu đơn hàng đang giao (shipping), đã giao (delivered), đã hủy (cancelled) hoặc đổi trả (returned)
    // -> Khóa không cho phép sửa đổi thông tin khách hàng, số điện thoại, địa chỉ nhận hàng.
    const isLocked = ['shipping', 'delivered', 'cancelled', 'returned'].includes(order.orderStatus);
    if (isLocked && (customerName || customerPhone || customerAddress)) {
      return res.status(400).json({ 
        message: 'Đơn hàng đang giao, đã giao, đã hủy hoặc đổi trả sẽ khóa thông tin khách hàng và vận chuyển để bảo vệ dữ liệu!' 
      });
    }

    // Thu thập các trường thay đổi
    const updates = {};
    if (customerName !== undefined) updates.customerName = customerName;
    if (customerPhone !== undefined) updates.customerPhone = customerPhone;
    if (customerAddress !== undefined) updates.customerAddress = customerAddress;
    if (paymentStatus !== undefined) updates.paymentStatus = paymentStatus;
    if (orderStatus !== undefined) updates.orderStatus = orderStatus;
    if (shippingUnit !== undefined) updates.shippingUnit = shippingUnit;
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (shippingFee !== undefined) updates.shippingFee = Number(shippingFee);
    if (serialNumbers !== undefined) updates.serialNumbers = serialNumbers;

    // Chạy thông qua Máy trạng thái Kho hàng
    await updateOrderAndManageInventory(order, updates, req.user);

    res.json({ message: 'Cập nhật chi tiết đơn hàng thành công!', order });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật chi tiết đơn hàng', error: error.message });
  }
});

// PUT /api/orders/:id/status - Cập nhật nhanh trạng thái đơn hàng (Admin)
router.put('/:id/status', protect, admin, async (req, res) => {
  try {
    const { paymentStatus, orderStatus } = req.body;
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
    }
    
    const updates = {};
    if (paymentStatus) updates.paymentStatus = paymentStatus;
    if (orderStatus) updates.orderStatus = orderStatus;
    
    // Đồng bộ trạng thái đơn thông qua Máy trạng thái Kho
    await updateOrderAndManageInventory(order, updates, req.user);
    
    res.json({ message: 'Cập nhật trạng thái đơn hàng thành công!', order });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái đơn hàng', error: error.message });
  }
});

// PUT /api/orders/:id/paid - Xác nhận đã thanh toán thành công (Admin)
router.put('/:id/paid', protect, admin, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Đơn hàng không tồn tại' });
    }
    
    const updates = { paymentStatus: 'paid' };
    
    // Đồng bộ trạng thái đơn thông qua Máy trạng thái Kho
    await updateOrderAndManageInventory(order, updates, req.user);
    
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
    
    // Đảm bảo hoàn trả kho hàng nếu đơn hàng này đã từng trừ kho mà bị xóa
    const isInventorySubtracted = order.paymentStatus === 'paid' && order.orderStatus !== 'cancelled' && order.orderStatus !== 'returned';
    if (isInventorySubtracted) {
      for (const item of order.orderItems) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          const newStock = product.countInStock + item.quantity;
          await product.update({ countInStock: newStock });
        }
      }
    }
    
    await order.destroy();
    res.json({ message: 'Đã xóa hóa đơn thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa đơn hàng', error: error.message });
// PUT /api/orders/:id/cancel-client - Khách hàng tự hủy đơn hàng (Chỉ khi trạng thái là pending)
router.put('/:id/cancel-client', protect, async (req, res) => {
  try {
    const { cancelReason } = req.body;
    const order = await Order.findByPk(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng trên hệ thống.' });
    }
    
    // Đảm bảo bảo mật: Khách hàng chỉ được hủy đơn của chính mình
    if (order.customerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Bạn không có quyền hủy đơn hàng của người khác.' });
    }
    
    // Chỉ được hủy khi đơn hàng đang chờ duyệt
    if (order.orderStatus !== 'pending') {
      return res.status(400).json({ message: 'Đơn hàng đã được duyệt hoặc đang vận chuyển, không thể tự hủy. Vui lòng liên hệ shop để hỗ trợ!' });
    }
    
    const updates = {
      orderStatus: 'cancelled',
      cancelReason: cancelReason || 'Khách hàng tự hủy trên giao diện website'
    };
    
    // Chạy qua máy trạng thái kho để hoàn kho tự động nếu đơn đã thanh toán (paid)
    await updateOrderAndManageInventory(order, updates, req.user);
    
    res.json({ message: 'Đã hủy đơn hàng thành công!', order });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi hủy đơn hàng', error: error.message });
  }
});

// PUT /api/orders/:id/return-client - Khách hàng gửi yêu cầu đổi trả / bảo hành (Chỉ khi trạng thái là delivered)
router.put('/:id/return-client', protect, async (req, res) => {
  try {
    const { reason, description } = req.body;
    const order = await Order.findByPk(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }
    
    if (order.customerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện trên đơn hàng của người khác.' });
    }
    
    if (order.orderStatus !== 'delivered') {
      return res.status(400).json({ message: 'Chỉ đơn hàng đã giao thành công mới có thể gửi yêu cầu đổi trả / bảo hành.' });
    }
    
    const returnRequestData = {
      reason,
      description,
      status: 'pending',
      createdAt: new Date()
    };
    
    const updates = {
      orderStatus: 'returned', // Đổi trạng thái sang returned
      returnRequest: returnRequestData
    };
    
    await updateOrderAndManageInventory(order, updates, req.user);
    
    res.json({ message: 'Đã gửi yêu cầu đổi trả/bảo hành thành công!', order });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi gửi yêu cầu đổi trả', error: error.message });
  }
});

module.exports = router;
