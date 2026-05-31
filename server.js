const express = require('express');
const { Sequelize } = require('sequelize');
const cors = require('cors');
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Đảm bảo thư mục uploads tồn tại để tránh lỗi khi upload ảnh
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('📁 Created uploads directory.');
}

// Middlewares
app.use(cors());
app.use(express.json());
// Phục vụ tĩnh thư mục uploads
app.use('/uploads', express.static(uploadsDir));

// PostgreSQL connection (Supabase/Neon) via Sequelize
const { sequelize } = require('./db');

// Routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const userRoutes = require('./routes/user.routes');
const uploadRoutes = require('./routes/upload.routes');
const orderRoutes = require('./routes/order.routes');
const couponRoutes = require('./routes/coupon.routes');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);


// Root route - Beautiful Glassmorphic API Documentation
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ShopTech API Dashboard</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-dark: #090d16;
          --panel-bg: rgba(17, 24, 39, 0.7);
          --border: rgba(255, 255, 255, 0.08);
          --text-main: #f3f4f6;
          --text-mute: #9ca3af;
          --primary: #3b82f6;
          --primary-glow: rgba(59, 130, 246, 0.15);
          
          --get-color: #10b981;
          --post-color: #3b82f6;
          --put-color: #f59e0b;
          --delete-color: #ef4444;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background-color: var(--bg-dark);
          color: var(--text-main);
          min-height: 100vh;
          overflow-x: hidden;
          padding: 2rem 1rem;
          background-image: 
            radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 40%),
            radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 40%);
          background-attachment: fixed;
        }
        
        .container {
          max-w: 1200px;
          margin: 0 auto;
        }
        
        header {
          text-align: center;
          margin-bottom: 3rem;
        }
        
        .logo-area {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .logo-dot {
          width: 14px;
          height: 14px;
          background-color: var(--primary);
          border-radius: 50%;
          box-shadow: 0 0 15px var(--primary);
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
        
        h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 2.75rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #ffffff 30%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .subtitle {
          color: var(--text-mute);
          font-size: 1.1rem;
          margin-top: 0.5rem;
        }
        
        .system-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          padding: 0.4rem 1rem;
          border-radius: 100px;
          font-size: 0.85rem;
          color: #10b981;
          font-weight: 600;
          margin-top: 1rem;
        }
        
        .system-badge::before {
          content: '';
          width: 8px;
          height: 8px;
          background-color: #10b981;
          border-radius: 50%;
        }
        
        .grid {
          display: grid;
          grid-template-cols: 100%;
          gap: 2rem;
        }
        
        @media (min-width: 768px) {
          .grid {
            grid-template-cols: repeat(2, 1fr);
          }
        }
        
        .card {
          background: var(--panel-bg);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 1.75rem;
          backdrop-filter: blur(16px);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
          transition: transform 0.3s ease, border-color 0.3s ease;
        }
        
        .card:hover {
          transform: translateY(-4px);
          border-color: rgba(59, 130, 246, 0.3);
        }
        
        .card-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.4rem;
          font-weight: 800;
          margin-bottom: 1.25rem;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 0.75rem;
        }
        
        .card-title .icon {
          color: var(--primary);
        }
        
        .api-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .api-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 14px;
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: background 0.2s ease;
        }
        
        .api-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .api-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .method {
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          width: 65px;
          text-align: center;
          color: #fff;
        }
        
        .method.get { background-color: var(--get-color); }
        .method.post { background-color: var(--post-color); }
        .method.put { background-color: var(--put-color); }
        .method.delete { background-color: var(--delete-color); }
        
        .path {
          font-family: monospace;
          font-size: 0.95rem;
          font-weight: 600;
          color: #e5e7eb;
          word-break: break-all;
        }
        
        .desc {
          font-size: 0.85rem;
          color: var(--text-mute);
          line-height: 1.4;
          padding-left: 0.25rem;
        }
        
        .badge-req {
          font-size: 0.75rem;
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-weight: 600;
          margin-left: auto;
        }
        
        .badge-req.admin {
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }
        
        .badge-req.public {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        
        .btn-test {
          display: inline-flex;
          align-items: center;
          font-family: inherit;
          font-size: 0.75rem;
          font-weight: bold;
          text-decoration: none;
          color: var(--primary);
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.15);
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          margin-left: auto;
          transition: background 0.2s, color 0.2s;
        }
        
        .btn-test:hover {
          background: var(--primary);
          color: #fff;
        }
        
        footer {
          text-align: center;
          margin-top: 4rem;
          color: var(--text-mute);
          font-size: 0.85rem;
          border-top: 1px solid var(--border);
          padding-top: 2rem;
        }
        
        .footer-brand {
          font-family: 'Outfit', sans-serif;
          font-weight: 800;
          color: #ffffff;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo-area">
            <div class="logo-dot"></div>
            <span style="font-family: 'Outfit', sans-serif; font-weight: 800; tracking-wide: 0.1em; color: var(--primary)">SHOPTECH CORE</span>
          </div>
          <h1>Hệ Thống API E-Commerce</h1>
          <p class="subtitle">Dịch vụ backend phục vụ cửa hàng công nghệ ShopTech</p>
          <div class="system-badge">Trạng thái: Hoạt động ổn định</div>
        </header>
        
        <div class="grid">
          <!-- AUTHENTICATION -->
          <div class="card">
            <h2 class="card-title">
              <span class="icon">🔑</span> Xác thực & Đăng nhập
            </h2>
            <div class="api-list">
              <div class="api-item">
                <div class="api-meta">
                  <span class="method post">post</span>
                  <span class="path">/api/auth/register</span>
                  <span class="badge-req public">Public</span>
                </div>
                <div class="desc">Đăng ký tài khoản người dùng mới.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method post">post</span>
                  <span class="path">/api/auth/login</span>
                  <span class="badge-req public">Public</span>
                </div>
                <div class="desc">Đăng nhập tài khoản, trả về JWT Token và thông tin cá nhân.</div>
              </div>
            </div>
          </div>
          
          <!-- PRODUCTS -->
          <div class="card">
            <h2 class="card-title">
              <span class="icon">💻</span> Quản lý Sản phẩm
            </h2>
            <div class="api-list">
              <div class="api-item">
                <div class="api-meta">
                  <span class="method get">get</span>
                  <span class="path">/api/products</span>
                  <a class="btn-test" href="/api/products" target="_blank">Thử ngay</a>
                </div>
                <div class="desc">Lấy danh sách tất cả sản phẩm hiện có trong cửa hàng.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method get">get</span>
                  <span class="path">/api/products/:id</span>
                  <span class="badge-req public">Public</span>
                </div>
                <div class="desc">Lấy thông tin chi tiết của một sản phẩm qua ID.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method post">post</span>
                  <span class="path">/api/products</span>
                  <span class="badge-req admin">Admin</span>
                </div>
                <div class="desc">Thêm sản phẩm mới. Yêu cầu nhập đầy đủ thông tin.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method put">put</span>
                  <span class="path">/api/products/:id</span>
                  <span class="badge-req admin">Admin</span>
                </div>
                <div class="desc">Cập nhật thông tin chi tiết một sản phẩm.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method delete">delete</span>
                  <span class="path">/api/products/:id</span>
                  <span class="badge-req admin">Admin</span>
                </div>
                <div class="desc">Xóa hoàn toàn sản phẩm khỏi hệ thống.</div>
              </div>
            </div>
          </div>
          
          <!-- USERS -->
          <div class="card">
            <h2 class="card-title">
              <span class="icon">👥</span> Quản lý Người dùng
            </h2>
            <div class="api-list">
              <div class="api-item">
                <div class="api-meta">
                  <span class="method get">get</span>
                  <span class="path">/api/users/profile</span>
                  <span class="badge-req">Token</span>
                </div>
                <div class="desc">Lấy thông tin tài khoản người dùng hiện tại đang đăng nhập.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method put">put</span>
                  <span class="path">/api/users/profile</span>
                  <span class="badge-req">Token</span>
                </div>
                <div class="desc">Người dùng tự cập nhật thông tin cá nhân (địa chỉ, số điện thoại...).</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method get">get</span>
                  <span class="path">/api/users</span>
                  <span class="badge-req admin">Admin</span>
                </div>
                <div class="desc">Lấy danh sách tất cả thành viên trong hệ thống.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method post">post</span>
                  <span class="path">/api/users</span>
                  <span class="badge-req admin">Admin</span>
                </div>
                <div class="desc">Admin trực tiếp tạo thành viên mới với vai trò chỉ định.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method put">put</span>
                  <span class="path">/api/users/:id</span>
                  <span class="badge-req admin">Admin</span>
                </div>
                <div class="desc">Admin cập nhật thông tin chi tiết hoặc đổi mật khẩu cho thành viên.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method delete">delete</span>
                  <span class="path">/api/users/:id</span>
                  <span class="badge-req admin">Admin</span>
                </div>
                <div class="desc">Admin xóa tài khoản của thành viên khỏi cơ sở dữ liệu.</div>
              </div>
            </div>
          </div>
          
          <!-- SYSTEM & UPLOADS -->
          <div class="card">
            <h2 class="card-title">
              <span class="icon">⚡</span> Hệ thống & Tiện ích
            </h2>
            <div class="api-list">
              <div class="api-item">
                <div class="api-meta">
                  <span class="method post">post</span>
                  <span class="path">/api/upload</span>
                  <span class="badge-req admin">Admin</span>
                </div>
                <div class="desc">Tải ảnh lên từ máy tính local (multipart/form-data, file field: "image"). Trả về URL tuyệt đối của ảnh.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method get">get</span>
                  <span class="path">/api/status</span>
                  <a class="btn-test" href="/api/status" target="_blank">Thử ngay</a>
                </div>
                <div class="desc">Kiểm tra trạng thái hoạt động (Health check) của server.</div>
              </div>
              <div class="api-item">
                <div class="api-meta">
                  <span class="method get">get</span>
                  <span class="path">/uploads/:filename</span>
                  <span class="badge-req public">Public</span>
                </div>
                <div class="desc">Phục vụ các tệp tin tĩnh (ảnh sản phẩm tải lên) trực tiếp từ ổ đĩa.</div>
              </div>
            </div>
          </div>
        </div>
        
        <footer>
          <p>© 2026 Bản quyền thuộc về <span class="footer-brand">ShopTech</span>. Phát triển và vận hành mượt mà.</p>
        </footer>
      </div>
    </body>
    </html>
  `);
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
