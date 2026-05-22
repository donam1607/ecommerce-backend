const { Sequelize } = require('sequelize');
const dns = require('dns');
require('dotenv').config();

// Ép Node.js ưu tiên IPv4 — Render free tier không hỗ trợ IPv6
dns.setDefaultResultOrder('ipv4first');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
    // Cho phép kết nối qua Connection Pooler (Supavisor) của Supabase
    keepAlive: true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  logging: false,
  retry: {
    max: 3
  }
});

const User = require('./models/User')(sequelize);
const Product = require('./models/Product')(sequelize);

module.exports = { sequelize, User, Product };
