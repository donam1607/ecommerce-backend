const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserEvent = sequelize.define('UserEvent', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    visitorId: { type: DataTypes.STRING(64), allowNull: false },
    userId: { type: DataTypes.STRING(64), allowNull: true },
    eventType: { type: DataTypes.STRING(60), allowNull: false },
    page: { type: DataTypes.TEXT, allowNull: true },
    productId: { type: DataTypes.INTEGER, allowNull: true },
    metadata: { type: DataTypes.JSONB, defaultValue: {} },
    userAgent: { type: DataTypes.TEXT, allowNull: true },
    ipAddress: { type: DataTypes.STRING(64), allowNull: true },
  }, {
    tableName: 'user_events',
    timestamps: true,
    indexes: [
      { fields: ['visitorId'] },
      { fields: ['userId'] },
      { fields: ['eventType'] },
      { fields: ['productId'] },
      { fields: ['createdAt'] },
    ],
  });

  return UserEvent;
};
