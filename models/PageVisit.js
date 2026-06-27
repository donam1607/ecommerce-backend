const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PageVisit = sequelize.define('PageVisit', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    visitorId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    dateKey: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    pageViews: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    firstSeen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    lastSeen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
  }, {
    tableName: 'page_visits',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['visitorId', 'dateKey'],
        name: 'uq_visitor_date',
      },
      { fields: ['dateKey'] },
      { fields: ['userId'] },
    ],
  });

  return PageVisit;
};
