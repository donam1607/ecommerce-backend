const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Review = sequelize.define('Review', {
    id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    rating:    { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    name:      { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Khách hàng ẩn danh' },
    comment:   { type: DataTypes.TEXT, allowNull: true },
    // Badge: 'verified' for logged-in users, null for guests
    badge:     { type: DataTypes.STRING(20), allowNull: true },
    userId:    { type: DataTypes.INTEGER, allowNull: true },
  }, {
    timestamps: true,
    tableName: 'Reviews',
  });
  return Review;
};
