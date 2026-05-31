const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Coupon = sequelize.define('Coupon', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    discountType: { type: DataTypes.ENUM('percentage', 'fixed'), allowNull: false },
    discountValue: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    minOrderValue: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    applicableCategories: { type: DataTypes.JSONB, defaultValue: [] }, // e.g. ["Laptop", "Smartphone"]
    applicableConditions: { type: DataTypes.JSONB, defaultValue: [] }, // e.g. ["Old", "Like New"]
    startDate: { type: DataTypes.DATE, allowNull: true },
    endDate: { type: DataTypes.DATE, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    maxUses: { type: DataTypes.INTEGER, allowNull: true },
    usedCount: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, {
    tableName: 'coupons',
    timestamps: true
  });

  return Coupon;
};
