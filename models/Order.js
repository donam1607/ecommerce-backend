const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customerName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.TEXT, allowNull: false },
    totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'paid', 'cash', 'completed'), defaultValue: 'pending' },
    paymentMethod: { type: DataTypes.ENUM('bank_transfer', 'cash'), allowNull: false },
    // Store generated QR code data URL or string
    qrData: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'orders',
    timestamps: true,
  });

  // Associations can be defined later after requiring models
  Order.associate = (models) => {
    Order.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Order.hasMany(models.OrderItem, { foreignKey: 'orderId', as: 'items' });
  };

  return Order;
};
