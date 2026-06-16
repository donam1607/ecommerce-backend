const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { ActivityLog } = require('../db');
const { protect, admin, permit } = require('../auth.middleware');
const { hasPermission } = require('../utils/rolePermissions');

const canReadActivity = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || hasPermission(role, 'screen.activity')) {
    return next();
  }

  return res.status(403).json({ message: 'Ban khong co quyen xem lich su hoat dong.' });
};

router.get('/', protect, admin, canReadActivity, async (req, res) => {
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

router.delete('/bulk', protect, admin, permit('activity.delete'), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const safeIds = ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);

    if (safeIds.length === 0) {
      return res.status(400).json({ message: 'Chưa có lịch sử hợp lệ để xóa.' });
    }

    const deleted = await ActivityLog.destroy({
      where: { id: { [Op.in]: safeIds } }
    });

    res.json({ message: 'Đã xóa lịch sử hoạt động đã chọn.', deleted });
  } catch (error) {
    res.status(500).json({ message: 'Không thể xóa lịch sử hoạt động.', error: error.message });
  }
});

router.delete('/:id', protect, admin, permit('activity.delete'), async (req, res) => {
  try {
    const log = await ActivityLog.findByPk(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'Không tìm thấy lịch sử hoạt động.' });
    }

    await log.destroy();
    res.json({ message: 'Đã xóa lịch sử hoạt động.' });
  } catch (error) {
    res.status(500).json({ message: 'Không thể xóa lịch sử hoạt động.', error: error.message });
  }
});

module.exports = router;
