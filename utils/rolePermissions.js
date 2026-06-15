const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'role-permissions.json');

const PERMISSION_GROUPS = [
  {
    id: 'screens',
    label: 'Màn hình được xem',
    items: [
      { id: 'screen.stats', label: 'Báo cáo thống kê' },
      { id: 'screen.products', label: 'Quản lý sản phẩm' },
      { id: 'screen.categories', label: 'Quản lý danh mục' },
      { id: 'screen.orders', label: 'Quản lý hóa đơn' },
      { id: 'screen.coupons', label: 'Quản lý khuyến mãi' },
      { id: 'screen.users', label: 'Quản lý thành viên' },
      { id: 'screen.roles', label: 'Quản lý phân quyền' },
      { id: 'screen.activity', label: 'Lịch sử hoạt động' },
    ],
  },
  {
    id: 'actions',
    label: 'Chức năng thao tác',
    items: [
      { id: 'products.write', label: 'Thêm/sửa/xóa sản phẩm' },
      { id: 'categories.write', label: 'Thêm/sửa/xóa danh mục' },
      { id: 'orders.write', label: 'Cập nhật hóa đơn/trạng thái' },
      { id: 'coupons.write', label: 'Thêm/sửa/xóa khuyến mãi' },
      { id: 'users.write', label: 'Thêm/sửa/xóa thành viên' },
      { id: 'roles.write', label: 'Tạo/sửa quyền' },
      { id: 'activity.read', label: 'Xem lịch sử hoạt động' },
    ],
  },
];

const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.id));

const DEFAULT_ROLES = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Toàn quyền hệ thống.',
    locked: true,
    permissions: ALL_PERMISSION_IDS,
  },
  {
    id: 'manager',
    name: 'Quản lí',
    description: 'Quản lí vận hành shop, sản phẩm, đơn hàng và khuyến mãi.',
    locked: false,
    permissions: [
      'screen.stats',
      'screen.products',
      'screen.categories',
      'screen.orders',
      'screen.coupons',
      'screen.activity',
      'products.write',
      'categories.write',
      'orders.write',
      'coupons.write',
      'activity.read',
    ],
  },
  {
    id: 'staff',
    name: 'Nhân viên',
    description: 'Xử lý đơn hàng và xem thông tin sản phẩm.',
    locked: false,
    permissions: ['screen.products', 'screen.orders', 'orders.write'],
  },
  {
    id: 'user',
    name: 'Khách hàng',
    description: 'Tài khoản mua hàng thông thường.',
    locked: true,
    permissions: [],
  },
];

const normalizeRoleId = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

function mergeDefaults(roles) {
  const byId = new Map(roles.map((role) => [role.id, role]));
  DEFAULT_ROLES.forEach((role) => {
    const saved = byId.get(role.id) || {};
    byId.set(role.id, {
      ...role,
      ...saved,
      locked: role.locked,
      permissions: Array.from(new Set([...(role.permissions || []), ...(saved.permissions || [])])),
    });
  });
  return Array.from(byId.values()).map((role) => ({
    ...role,
    permissions: (role.permissions || []).filter((permission) => ALL_PERMISSION_IDS.includes(permission)),
  }));
}

function readRoles() {
  try {
    if (!fs.existsSync(STORE_PATH)) return DEFAULT_ROLES;
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return Array.isArray(parsed) && parsed.length ? mergeDefaults(parsed) : DEFAULT_ROLES;
  } catch (error) {
    return DEFAULT_ROLES;
  }
}

function writeRoles(roles) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(mergeDefaults(roles), null, 2), 'utf8');
  return readRoles();
}

function getRole(roleId) {
  const roles = readRoles();
  return roles.find((role) => role.id === roleId) || roles.find((role) => role.id === 'user');
}

function hasPermission(roleId, permissionId) {
  if (roleId === 'admin') return true;
  const role = getRole(roleId);
  return Boolean(role?.permissions?.includes(permissionId));
}

module.exports = {
  ALL_PERMISSION_IDS,
  DEFAULT_ROLES,
  PERMISSION_GROUPS,
  getRole,
  hasPermission,
  normalizeRoleId,
  readRoles,
  writeRoles,
};
