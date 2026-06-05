const express = require('express');
const router = express.Router();
const { Product } = require('../db');
const { protect, admin } = require('../auth.middleware');

// @desc    Get all products
// @route   GET /api/products
router.get('/', async (req, res) => {
  try {
    const products = await Product.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách sản phẩm', error: error.message });
  }
});

// @desc    Get single product
// @route   GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy chi tiết sản phẩm', error: error.message });
  }
});

// @desc    Create a product
// @route   POST /api/products
router.post('/', protect, admin, async (req, res) => {
  try {
    const { name, category, price, images, description, specs, countInStock, badge, isHot, discount, discountedPrice } = req.body;

    const imagesArr = Array.isArray(images)
      ? images
      : (typeof images === 'string' ? images.split(',').map(i => i.trim()).filter(Boolean) : []);

    const specsArr = Array.isArray(specs)
      ? specs
      : (typeof specs === 'string' ? specs.split('\n').map(s => s.trim()).filter(Boolean) : []);

    const product = await Product.create({
      name,
      category,
      price: parseFloat(price) || 0,
      images: imagesArr,
      description,
      specs: specsArr,
      countInStock: parseInt(countInStock) || 0,
      badge: badge || null,
      isHot: isHot === true || isHot === 'true',
      discount: parseInt(discount) || 0,
      discountedPrice: discountedPrice !== undefined && discountedPrice !== "" ? parseFloat(discountedPrice) : null,
      rating: 0,
      reviews: 0
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo sản phẩm', error: error.message });
  }
});

// @desc    Update a product
// @route   PUT /api/products/:id
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (product) {
      const { name, category, price, images, description, specs, countInStock, badge, isHot, discount, discountedPrice } = req.body;

      const imagesArr = Array.isArray(images)
        ? images
        : (typeof images === 'string' ? images.split(',').map(i => i.trim()).filter(Boolean) : product.images);

      const specsArr = Array.isArray(specs)
        ? specs
        : (typeof specs === 'string' ? specs.split('\n').map(s => s.trim()).filter(Boolean) : product.specs);

      product.name = name !== undefined ? name : product.name;
      product.category = category !== undefined ? category : product.category;
      product.price = price !== undefined ? parseFloat(price) : product.price;
      product.images = imagesArr;
      product.description = description !== undefined ? description : product.description;
      product.specs = specsArr;
      product.countInStock = countInStock !== undefined ? parseInt(countInStock) : product.countInStock;
      product.badge = badge !== undefined ? badge : product.badge;
      product.isHot = isHot !== undefined ? (isHot === true || isHot === 'true') : product.isHot;
      product.discount = discount !== undefined ? parseInt(discount) || 0 : product.discount;
      product.discountedPrice = discountedPrice !== undefined ? (discountedPrice !== "" ? parseFloat(discountedPrice) : null) : product.discountedPrice;

      const updatedProduct = await product.save();
      res.json(updatedProduct);
    } else {
      res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật sản phẩm', error: error.message });
  }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (product) {
      await product.destroy();
      res.json({ message: 'Đã xóa sản phẩm thành công' });
    } else {
      res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa sản phẩm', error: error.message });
  }
});

module.exports = router;
