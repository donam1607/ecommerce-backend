require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

const Product = require('./models/Product')(sequelize);
const User = require('./models/User')(sequelize);

// Dữ liệu lấy từ products.js của bạn
const productsData = [
  {
    name: "MacBook Pro M3 16\"",
    category: "Laptop",
    price: 2499.00,
    rating: 4.9,
    reviews: 342,
    badge: "Best Seller",
    images: ["/images/products/macbook-1.jpg", "/images/products/macbook-2.jpg", "/images/products/macbook-3.jpg"],
    description: "Apple M3 chip, 18GB RAM, 512GB SSD",
    specs: ["Apple M3 Pro chip", "18GB Unified Memory", "512GB SSD", "16.2\" Liquid Retina XDR"]
  },
  {
    name: "Dell XPS 15 OLED",
    category: "Laptop",
    price: 1899.00,
    rating: 4.8,
    reviews: 215,
    badge: "New",
    images: ["/images/products/dell-1.jpg", "/images/products/dell-2.jpg"],
    description: "Intel i9, 32GB RAM, 1TB SSD, OLED 4K",
    specs: ["Intel Core i9-13900H", "32GB DDR5 RAM", "1TB NVMe SSD"]
  },
  {
    name: "Sony WH-1000XM5",
    category: "Headphones",
    price: 349.99,
    rating: 4.9,
    reviews: 1024,
    badge: "Top Rated",
    images: ["/images/products/sony-1.jpg", "/images/products/sony-2.jpg"],
    description: "Industry-leading noise cancellation",
    specs: ["30h battery life", "8 microphones ANC", "LDAC Hi-Res Audio"]
  },
  {
    name: "Samsung 4K Monitor 32\"",
    category: "Monitor",
    price: 699.00,
    rating: 4.7,
    reviews: 189,
    badge: "Sale",
    images: ["/images/products/monitor-1.jpg"],
    description: "4K UHD, 144Hz, 1ms response time",
    specs: ["3840x2160 4K UHD", "144Hz refresh rate", "AMD FreeSync Premium"]
  },
  {
    name: "iPhone 15 Pro Max",
    category: "Smartphone",
    price: 1199.00,
    rating: 4.8,
    reviews: 2103,
    badge: "Hot",
    images: ["/images/products/iphone-1.jpg", "/images/products/iphone-2.jpg"],
    description: "A17 Pro chip, Titanium design, 48MP",
    specs: ["Apple A17 Pro chip", "6.7\" Super Retina XDR", "Titanium design"]
  },
  {
    name: "Mechanical Keyboard Pro",
    category: "Keyboard",
    price: 149.00,
    rating: 4.6,
    reviews: 567,
    badge: null,
    images: ["/images/products/keyboard-1.jpg"],
    description: "RGB backlit, Cherry MX switches",
    specs: ["Cherry MX Red switches", "Per-key RGB lighting", "PBT keycaps"]
  }
];

// Tài khoản Admin mẫu
const adminData = {
  name: "Quản Trị Viên",
  email: "admin@example.com",
  password: "admin123", // Sẽ được hash tự động bởi hook trong Model User
  role: "admin"
};

const seedDatabase = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true }); // Xóa bảng cũ tạo lại bảng mới
    await Product.bulkCreate(productsData);
    await User.create(adminData);
    console.log('✅ Seeded database successfully!');
    console.log('👤 Admin account created: admin@example.com / admin123');
    process.exit();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();