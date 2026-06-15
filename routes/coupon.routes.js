const express = require('express');
const router = express.Router();
const { Coupon } = require('../db');
const { protect, admin, permit } = require('../auth.middleware');
const { Op } = require('sequelize');

// Helper to determine product condition from its badge (matches frontend Home.jsx logic)
const getProductCondition = (badge) => {
  if (!badge) return "Other";
  const b = badge.toLowerCase();
  if (b.includes("like new") || b.includes("likenew") || b.includes("99%") || b.includes("98%") || b.includes("95%")) {
    return "Like New";
  }
  if (b.includes("old") || b.includes("cũ") || b.includes("cu") || b.includes("used") || b.includes("lướt")) {
    return "Old";
  }
  if (
    b === "new" || 
    b.includes("hàng mới") || 
    b.includes("hang moi") || 
    b.includes("mới 100") || 
    /^new$/i.test(b) || 
    (b.includes("new") && !b.includes("like")) || 
    (b.includes("mới") && !b.includes("like")) || 
    (b.includes("moi") && !b.includes("like"))
  ) {
    return "New";
  }
  return "Other";
};

const getEndOfDay = (dateValue) => {
  const date = new Date(dateValue);
  date.setHours(23, 59, 59, 999);
  return date;
};

const getCouponRuntimeStatus = (coupon, now = new Date()) => {
  if (!coupon.isActive) return 'paused';
  if (coupon.startDate && new Date(coupon.startDate) > now) return 'scheduled';
  if (coupon.endDate && getEndOfDay(coupon.endDate) < now) return 'expired';
  if (
    coupon.maxUses !== null &&
    coupon.maxUses !== undefined &&
    Number(coupon.usedCount || 0) >= Number(coupon.maxUses)
  ) {
    return 'used_up';
  }
  return 'active';
};

const serializeCoupon = (coupon) => {
  const plain = coupon?.toJSON ? coupon.toJSON() : coupon;
  return {
    ...plain,
    runtimeStatus: getCouponRuntimeStatus(plain)
  };
};

// GET /api/coupons - Lấy danh sách tất cả mã giảm giá (Admin)
router.get('/', protect, admin, async (req, res) => {
  try {
    const coupons = await Coupon.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(coupons.map(serializeCoupon));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách mã giảm giá', error: error.message });
  }
});

// POST /api/coupons - Tạo mã giảm giá mới (Admin)
router.post('/', protect, admin, permit('coupons.write'), async (req, res) => {
  try {
    const { 
      code, 
      description, 
      discountType, 
      discountValue, 
      minOrderValue, 
      applicableCategories, 
      applicableConditions, 
      startDate, 
      endDate, 
      isActive, 
      maxUses 
    } = req.body;

    const normalizedCode = code.toUpperCase().trim();
    
    // Kiểm tra trùng code
    const existing = await Coupon.findOne({ where: { code: normalizedCode } });
    if (existing) {
      return res.status(400).json({ message: 'Mã giảm giá này đã tồn tại!' });
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      description,
      discountType,
      discountValue,
      minOrderValue: minOrderValue || 0,
      applicableCategories: applicableCategories || [],
      applicableConditions: applicableConditions || [],
      startDate: startDate || null,
      endDate: endDate || null,
      isActive: isActive !== undefined ? isActive : true,
      maxUses: maxUses || null,
      usedCount: 0
    });

    res.status(201).json(serializeCoupon(coupon));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo mã giảm giá', error: error.message });
  }
});

// PUT /api/coupons/:id - Chỉnh sửa mã giảm giá (Admin)
router.put('/:id', protect, admin, permit('coupons.write'), async (req, res) => {
  try {
    const { 
      code, 
      description, 
      discountType, 
      discountValue, 
      minOrderValue, 
      applicableCategories, 
      applicableConditions, 
      startDate, 
      endDate, 
      isActive, 
      maxUses 
    } = req.body;

    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Mã giảm giá không tồn tại!' });
    }

    const normalizedCode = code ? code.toUpperCase().trim() : coupon.code;
    
    if (code && normalizedCode !== coupon.code) {
      const existing = await Coupon.findOne({ where: { code: normalizedCode } });
      if (existing) {
        return res.status(400).json({ message: 'Mã giảm giá mới đã bị trùng!' });
      }
    }

    await coupon.update({
      code: normalizedCode,
      description: description !== undefined ? description : coupon.description,
      discountType: discountType !== undefined ? discountType : coupon.discountType,
      discountValue: discountValue !== undefined ? discountValue : coupon.discountValue,
      minOrderValue: minOrderValue !== undefined ? minOrderValue : coupon.minOrderValue,
      applicableCategories: applicableCategories !== undefined ? applicableCategories : coupon.applicableCategories,
      applicableConditions: applicableConditions !== undefined ? applicableConditions : coupon.applicableConditions,
      startDate: startDate !== undefined ? startDate : coupon.startDate,
      endDate: endDate !== undefined ? endDate : coupon.endDate,
      isActive: isActive !== undefined ? isActive : coupon.isActive,
      maxUses: maxUses !== undefined ? maxUses : coupon.maxUses
    });

    res.json(serializeCoupon(coupon));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật mã giảm giá', error: error.message });
  }
});

// DELETE /api/coupons/:id - Xóa mã giảm giá (Admin)
router.delete('/:id', protect, admin, permit('coupons.write'), async (req, res) => {
  try {
    const coupon = await Coupon.findByPk(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Mã giảm giá không tồn tại!' });
    }
    await coupon.destroy();
    res.json({ message: 'Xóa mã giảm giá thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa mã giảm giá', error: error.message });
  }
});

// POST /api/coupons/validate - Kiểm tra mã giảm giá và tính số tiền giảm (Public)
router.post('/validate', async (req, res) => {
  try {
    const { code, cartItems } = req.body;
    
    if (!code) {
      return res.status(400).json({ isValid: false, message: 'Vui lòng nhập mã giảm giá!' });
    }
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ isValid: false, message: 'Giỏ hàng trống!' });
    }

    const coupon = await Coupon.findOne({ where: { code: code.toUpperCase().trim() } });
    if (!coupon) {
      return res.status(400).json({ isValid: false, message: 'Mã giảm giá không tồn tại hoặc đã hết hạn!' });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ isValid: false, message: 'Mã giảm giá này hiện tại đã bị vô hiệu hóa!' });
    }

    // Kiểm tra số lần sử dụng
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ isValid: false, message: 'Mã giảm giá đã hết lượt sử dụng!' });
    }

    // Kiểm tra thời gian
    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return res.status(400).json({ isValid: false, message: 'Mã giảm giá này chưa đến thời gian áp dụng!' });
    }
    if (coupon.endDate && getEndOfDay(coupon.endDate) < now) {
      return res.status(400).json({ isValid: false, message: 'Mã giảm giá này đã quá hạn sử dụng!' });
    }

    // Tính tổng tiền giỏ hàng (subtotal)
    const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    // Kiểm tra giá trị đơn tối thiểu
    if (subtotal < Number(coupon.minOrderValue)) {
      return res.status(400).json({ 
        isValid: false, 
        message: `Đơn hàng chưa đạt giá trị tối thiểu ${Number(coupon.minOrderValue).toLocaleString('vi-VN')}đ để áp dụng mã này!` 
      });
    }

    // Lọc ra các sản phẩm hợp lệ dựa trên điều kiện Category và Condition (Tình trạng hàng)
    let eligibleItems = [];
    const filterCat = Array.isArray(coupon.applicableCategories) && coupon.applicableCategories.length > 0;
    const filterCond = Array.isArray(coupon.applicableConditions) && coupon.applicableConditions.length > 0;

    for (const item of cartItems) {
      let isCatMatch = true;
      let isCondMatch = true;

      if (filterCat) {
        isCatMatch = coupon.applicableCategories.some(cat => 
          item.category && item.category.toLowerCase().trim() === cat.toLowerCase().trim()
        );
      }

      if (filterCond) {
        const itemCond = getProductCondition(item.badge);
        isCondMatch = coupon.applicableConditions.some(cond => 
          itemCond.toLowerCase().trim() === cond.toLowerCase().trim()
        );
      }

      if (isCatMatch && isCondMatch) {
        eligibleItems.push(item);
      }
    }

    if (eligibleItems.length === 0) {
      let condText = filterCond ? `cho tình trạng hàng [${coupon.applicableConditions.join(', ')}]` : '';
      let catText = filterCat ? `cho danh mục [${coupon.applicableCategories.join(', ')}]` : '';
      let separator = (filterCond && filterCat) ? ' thuộc ' : '';
      return res.status(400).json({ 
        isValid: false, 
        message: `Mã giảm giá này chỉ được áp dụng ${condText}${separator}${catText}!` 
      });
    }

    // Tính tổng tiền của những sản phẩm hợp lệ
    const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    // Tính toán số tiền được giảm
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = eligibleSubtotal * (Number(coupon.discountValue) / 100);
    } else {
      // Dạng số tiền cố định: Giảm tối đa bằng giá trị của những sản phẩm hợp lệ
      discountAmount = Math.min(Number(coupon.discountValue), eligibleSubtotal);
    }

    res.json({
      isValid: true,
      discountAmount,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi kiểm tra mã giảm giá', error: error.message });
  }
});

module.exports = router;
