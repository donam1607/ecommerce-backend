const jwt = require('jsonwebtoken');
const { hasPermission } = require('./utils/rolePermissions');

const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Không được phép, token lỗi' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Không được phép, không có token' });
  }
};

const admin = (req, res, next) => {
  const role = req.user?.role;
  const hasAdminScreen = role === 'admin'
    || hasPermission(role, 'screen.stats')
    || hasPermission(role, 'screen.products')
    || hasPermission(role, 'screen.categories')
    || hasPermission(role, 'screen.orders')
    || hasPermission(role, 'screen.coupons')
    || hasPermission(role, 'screen.users')
    || hasPermission(role, 'screen.roles')
    || hasPermission(role, 'screen.activity')
    || hasPermission(role, 'activity.read');

  if (req.user && hasAdminScreen) {
    next();
  } else {
    res.status(403).json({ message: 'Quyền truy cập bị từ chối.' });
  }
};

const strictAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Chỉ Admin mới được quản lý phân quyền.' });
  }
};

const permit = (permissionId) => (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin' || hasPermission(role, permissionId)) {
    next();
  } else {
    res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' });
  }
};

module.exports = { protect, admin, strictAdmin, permit };
