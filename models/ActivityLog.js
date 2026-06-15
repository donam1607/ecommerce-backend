const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ActivityLog = sequelize.define('ActivityLog', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    actorId: { type: DataTypes.STRING, allowNull: true },
    actorName: { type: DataTypes.STRING, allowNull: true },
    actorEmail: { type: DataTypes.STRING, allowNull: true },
    actorRole: { type: DataTypes.STRING, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    entityType: { type: DataTypes.STRING, allowNull: false },
    entityId: { type: DataTypes.STRING, allowNull: true },
    entityLabel: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSONB, defaultValue: {} },
    ipAddress: { type: DataTypes.STRING, allowNull: true },
    userAgent: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'activity_logs',
    timestamps: true
  });

  return ActivityLog;
};
