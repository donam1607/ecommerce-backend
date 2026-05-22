const express = require('express');
const { Sequelize } = require('sequelize');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// PostgreSQL connection (Supabase/Neon) via Sequelize
const { sequelize } = require('./db');

// Routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const userRoutes = require('./routes/user.routes');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('<h1>ShopTech API is running...</h1><p>Vui lòng truy cập các endpoint /api để lấy dữ liệu.</p>');
});

// Health check route
app.get('/api/status', (req, res) => {
  res.json({
    status: 'success',
    message: 'Backend E-commerce API is running smoothly',
    timestamp: new Date()
  });
});

sequelize.authenticate()
  .then(() => {
    console.log('✅ Connected to PostgreSQL Database.');
    // Đồng bộ database (tạo bảng nếu chưa có)
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
  });
