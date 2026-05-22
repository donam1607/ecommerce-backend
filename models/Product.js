const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    images: { type: DataTypes.JSONB, defaultValue: [] }, // PostgreSQL hỗ trợ JSONB cho mảng
    description: { type: DataTypes.TEXT, allowNull: false },
    specs: { type: DataTypes.JSONB, defaultValue: [] },
    rating: { type: DataTypes.FLOAT, defaultValue: 0 },
    reviews: { type: DataTypes.INTEGER, defaultValue: 0 },
    countInStock: { type: DataTypes.INTEGER, defaultValue: 10 },
    badge: { type: DataTypes.STRING, allowNull: true }
  }, {
    timestamps: true
  });
  return Product;
};