const { ActivityLog } = require('../db');

const getActor = (req) => ({
  actorId: req.user?.id ? String(req.user.id) : null,
  actorName: req.user?.name || null,
  actorEmail: req.user?.email || null,
  actorRole: req.user?.role || null,
});

const logActivity = async (req, payload = {}) => {
  try {
    await ActivityLog.create({
      ...getActor(req),
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId !== undefined && payload.entityId !== null ? String(payload.entityId) : null,
      entityLabel: payload.entityLabel || null,
      description: payload.description || null,
      metadata: payload.metadata || {},
      ipAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null,
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (error) {
    console.error('Activity log error:', error.message);
  }
};

module.exports = { logActivity };
