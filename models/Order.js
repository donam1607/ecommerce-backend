const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customerName: { type: DataTypes.STRING, allowNull: false },
    customerEmail: { type: DataTypes.STRING, allowNull: false },
    customerPhone: { type: DataTypes.STRING, allowNull: false },
    customerAddress: { type: DataTypes.TEXT, allowNull: false },
    totalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    paymentStatus: { type: DataTypes.ENUM('pending', 'paid', 'unpaid'), defaultValue: 'pending' },
    paymentMethod: { type: DataTypes.ENUM('bank', 'store'), allowNull: false },
    orderItems: { type: DataTypes.JSON, allowNull: false },
    qrData: { type: DataTypes.TEXT, allowNull: true },
    couponCode: { type: DataTypes.STRING, allowNull: true },
    discountAmount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    shippingStatus: { type: DataTypes.ENUM('processing', 'shipping', 'delivered', 'cancelled'), defaultValue: 'processing' }
  }, {
    tableName: 'orders',
    timestamps: true,
  });

  return Order;
};
