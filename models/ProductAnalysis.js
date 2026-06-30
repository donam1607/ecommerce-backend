const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductAnalysis = sequelize.define('ProductAnalysis', {
    id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    productId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    content:   { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true }, // admin userId
  }, {
    timestamps: true,
    tableName: 'ProductAnalyses',
  });
  return ProductAnalysis;
};
