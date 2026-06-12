const express = require('express');
const router = express.Router();
const { protect, strictAdmin } = require('../auth.middleware');
const {
  ALL_PERMISSION_IDS,
  PERMISSION_GROUPS,
  normalizeRoleId,
  readRoles,
  writeRoles,
} = require('../utils/rolePermissions');

router.get('/', protect, async (req, res) => {
  res.json({
    roles: readRoles(),
    permissionGroups: PERMISSION_GROUPS,
  });
});

router.post('/', protect, strictAdmin, async (req, res) => {
  const { id, name, description = '', permissions = [] } = req.body;
  const roleId = normalizeRoleId(id || name);

  if (!roleId || !name) {
    return res.status(400).json({ message: 'Vui lòng nhập tên quyền.' });
  }

  const roles = readRoles();
  if (roles.some((role) => role.id === roleId)) {
    return res.status(400).json({ message: 'Mã quyền này đã tồn tại.' });
  }

  const safePermissions = permissions.filter((permission) => ALL_PERMISSION_IDS.includes(permission));
  const updated = writeRoles([...roles, { id: roleId, name, description, locked: false, permissions: safePermissions }]);
  res.status(201).json({ roles: updated });
});

router.put('/:id', protect, strictAdmin, async (req, res) => {
  const { name, description = '', permissions = [] } = req.body;
  const roleId = normalizeRoleId(req.params.id);
  const roles = readRoles();
  const role = roles.find((item) => item.id === roleId);

  if (!role) return res.status(404).json({ message: 'Không tìm thấy quyền.' });

  const safePermissions = role.id === 'admin'
    ? ALL_PERMISSION_IDS
    : permissions.filter((permission) => ALL_PERMISSION_IDS.includes(permission));

  const updated = writeRoles(roles.map((item) => (
    item.id === roleId
      ? { ...item, name: name || item.name, description, permissions: safePermissions }
      : item
  )));

  res.json({ roles: updated });
});

router.delete('/:id', protect, strictAdmin, async (req, res) => {
  const roleId = normalizeRoleId(req.params.id);
  const roles = readRoles();
  const role = roles.find((item) => item.id === roleId);

  if (!role) return res.status(404).json({ message: 'Không tìm thấy quyền.' });
  if (role.locked) return res.status(400).json({ message: 'Không thể xóa quyền hệ thống.' });

  const updated = writeRoles(roles.filter((item) => item.id !== roleId));
  res.json({ roles: updated });
});

module.exports = router;
