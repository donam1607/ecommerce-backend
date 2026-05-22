const express = require('express');
const router = express.Router();
const { User } = require('../db');
const { protect, admin } = require('../auth.middleware');

// @desc    Get current user profile
// @route   GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy thông tin cá nhân', error: error.message });
  }
});

// @desc    Update current user profile
// @route   PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (user) {
      const { name, email, phone, address, city, zip, password } = req.body;

      if (email && email !== user.email) {
        const emailExists = await User.findOne({ where: { email } });
        if (emailExists) {
          return res.status(400).json({ message: 'Email này đã được sử dụng bởi tài khoản khác' });
        }
        user.email = email;
      }

      user.name = name || user.name;
      user.phone = phone !== undefined ? phone : user.phone;
      user.address = address !== undefined ? address : user.address;
      user.city = city !== undefined ? city : user.city;
      user.zip = zip !== undefined ? zip : user.zip;

      if (password) {
        user.password = password;
      }

      const updatedUser = await user.save();

      res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone || "",
        address: updatedUser.address || "",
        city: updatedUser.city || "",
        zip: updatedUser.zip || ""
      });
    } else {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật thông tin cá nhân', error: error.message });
  }
});

// @desc    Get all users
// @route   GET /api/users
router.get('/', protect, admin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách người dùng', error: error.message });
  }
});

// @desc    Update user role
// @route   PUT /api/users/:id/role
router.put('/:id/role', protect, admin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (user) {
      if (user.id === req.user.id) {
        return res.status(400).json({ message: 'Bạn không thể tự đổi vai trò của chính mình để tránh mất quyền quản trị' });
      }

      const { role } = req.body;
      if (role !== 'user' && role !== 'admin') {
        return res.status(400).json({ message: 'Vai trò không hợp lệ' });
      }

      user.role = role;
      const updatedUser = await user.save();
      
      res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      });
    } else {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật vai trò người dùng', error: error.message });
  }
});

// @desc    Delete user
// @route   DELETE /api/users/:id
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (user) {
      if (user.id === req.user.id) {
        return res.status(400).json({ message: 'Bạn không thể tự xóa tài khoản của chính mình' });
      }

      await user.destroy();
      res.json({ message: 'Đã xóa người dùng thành công' });
    } else {
      res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa người dùng', error: error.message });
  }
});

module.exports = router;
