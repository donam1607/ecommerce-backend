const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../db');

const signUserToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '30d' }
);

const buildAuthResponse = (user, token) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone || "",
  address: user.address || "",
  city: user.city || "",
  zip: user.zip || "",
  token
});

// @desc    Register a new user
// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ where: { email } });

    if (userExists) {
      return res.status(400).json({ message: 'Email đã tồn tại' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'user' // Mặc định role là user khi đăng ký mới
    });

    const token = signUserToken(user);

    res.status(201).json(buildAuthResponse(user, token));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
  }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
      const token = signUserToken(user);

      res.json(buildAuthResponse(user, token));
    } else {
      res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
  }
});

// @desc    Login/Register with Google Identity Services credential
// @route   POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    return res.status(500).json({ message: 'Máy chủ chưa cấu hình GOOGLE_CLIENT_ID.' });
  }

  if (!credential) {
    return res.status(400).json({ message: 'Thiếu mã xác thực Google.' });
  }

  try {
    const verifyResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const profile = await verifyResponse.json();

    if (!verifyResponse.ok || profile.aud !== googleClientId || profile.email_verified !== 'true') {
      return res.status(401).json({ message: 'Không thể xác thực tài khoản Google.' });
    }

    const email = String(profile.email || '').toLowerCase();
    const name = profile.name || email.split('@')[0] || 'Google User';

    let user = await User.findOne({ where: { email } });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: `google:${profile.sub}:${Date.now()}`,
        role: 'user'
      });
    } else if (!user.name && name) {
      user.name = name;
      await user.save();
    }

    const token = signUserToken(user);
    res.json(buildAuthResponse(user, token));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xác thực Google.', error: error.message });
  }
});

module.exports = router;
