const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customerName: { type: DataTypes.STRING, allowNull: false },
    customerEmail: { type: DataTypes.STRING, allowNull: false },
    customerPhone: { type: DataTypes.STRING, allowNull: false },
    customerAddress: { type: DataTypes.TEXT, allowNull: false },
    totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    paymentStatus: { type: DataTypes.STRING, defaultValue: 'pending' }, // 'pending', 'paid', 'unpaid'
    paymentMethod: { type: DataTypes.STRING, allowNull: false }, // 'bank', 'store', 'cod', etc.
    orderItems: { type: DataTypes.JSON, allowNull: false },
    qrData: { type: DataTypes.TEXT, allowNull: true },
    couponCode: { type: DataTypes.STRING, allowNull: true },
    discountAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    
    // Thuộc tính chuyên nghiệp cho Quản lý Hóa đơn công nghệ
    orderStatus: { type: DataTypes.STRING, defaultValue: 'pending' }, // 'pending', 'processing', 'shipping', 'delivered', 'cancelled', 'returned'
    shippingUnit: { type: DataTypes.STRING, allowNull: true }, // GHTK, GHN, Viettel Post...
    trackingNumber: { type: DataTypes.STRING, allowNull: true }, // Mã vận đơn
    shippingFee: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    approvedBy: { type: DataTypes.STRING, allowNull: true }, // Tên nhân viên/Admin duyệt
    serialNumbers: { type: DataTypes.JSONB, defaultValue: {} }, // Map productId -> Serial Number
    cancelReason: { type: DataTypes.TEXT, allowNull: true }, // Lý do hủy đơn
    returnRequest: { type: DataTypes.JSONB, allowNull: true } // Yêu cầu đổi trả/bảo hành từ khách hàng
  }, {
    tableName: 'orders',
    timestamps: true,
  });

  return Order;
};
