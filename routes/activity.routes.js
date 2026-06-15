const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { ActivityLog } = require('../db');
const { protect, admin, permit } = require('../auth.middleware');

router.get('/', protect, admin, permit('activity.read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      entityType,
      action,
      search,
      from,
      to
    } = req.query;

    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const where = {};

    if (entityType && entityType !== 'all') where.entityType = entityType;
    if (action && action !== 'all') where.action = action;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    if (search) {
      const keyword = `%${String(search).trim()}%`;
      where[Op.or] = [
        { actorName: { [Op.iLike]: keyword } },
        { actorEmail: { [Op.iLike]: keyword } },
        { entityLabel: { [Op.iLike]: keyword } },
        { description: { [Op.iLike]: keyword } },
      ];
    }

    const { rows, count } = await ActivityLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    });

    res.json({
      logs: rows,
      total: count,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(count / safeLimit)),
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể tải lịch sử hoạt động.', error: error.message });
  }
});

module.exports = router;
