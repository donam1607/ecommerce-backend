const express = require('express');
const router = express.Router();
const { Product } = require('../db');
const { protect, admin, permit } = require('../auth.middleware');
const { logActivity } = require('../utils/activityLogger');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const normalizeSpecs = (specs, fallback = []) => {
  if (Array.isArray(specs)) return specs;
  if (specs && typeof specs === 'object') return specs;
  if (typeof specs === 'string') return specs.split('\n').map(s => s.trim()).filter(Boolean);
  return fallback;
};

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const SPEC_CONCEPT_ALIASES = {
  cpu: ['cpu', 'loai cpu', 'bo xu ly', 'processor', 'chip'],
  gpu: ['gpu', 'card do hoa', 'loai card do hoa', 'vga', 'graphics'],
  ram: ['ram', 'dung luong ram', 'loai ram', 'so khe ram', 'bo nho ram'],
  storage: ['storage', 'o cung', 'ssd', 'hdd', 'bo nho trong', 'dung luong luu tru'],
  screen: ['screen', 'man hinh'],
  screen_size: ['kich thuoc man hinh'],
  resolution: ['do phan giai', 'do phan giai man hinh'],
  refresh_rate: ['tan so quet'],
  panel: ['tam nen', 'chat lieu tam nen'],
  display_tech: ['cong nghe man hinh'],
  battery: ['pin', 'dung luong pin'],
  warranty: ['bao hanh', 'thoi gian bao hanh'],
  wifi: ['wifi', 'wi fi'],
  bluetooth: ['bluetooth'],
  ports: ['cong ket noi', 'cong giao tiep'],
  webcam: ['webcam', 'camera'],
  weight: ['trong luong'],
  dimensions: ['kich thuoc'],
  operating_system: ['he dieu hanh', 'os'],
};

const SOURCE_LABELS = [
  ...Object.values(SPEC_CONCEPT_ALIASES).flat(),
  'cong nghe am thanh', 'khe doc the nho', 'chat lieu', 'chat lieu vo man hinh',
  'chat lieu vo tren', 'chat lieu vo duoi', 'tinh nang dac biet', 'tinh nang khac',
  'loai den ban phim', 'bao mat',
];

const SECTION_HEADINGS = [
  'bo xu ly do hoa', 'bo nho ram o cung', 'man hinh', 'am thanh', 'cong ket noi',
  'kich thuoc trong luong', 'tien ich khac', 'tinh nang khac', 'pin cong nghe sac',
];

const getConcept = (value) => {
  const normalized = normalizeText(value);
  return Object.entries(SPEC_CONCEPT_ALIASES).find(([, aliases]) => (
    aliases.some((alias) => normalized === normalizeText(alias))
  ))?.[0] || null;
};

const parseSpecsLocally = (rawText, fields) => {
  const fieldConcepts = fields.map((field) => ({
    ...field,
    concept: getConcept(field.key) || getConcept(field.label),
  }));
  const findTargetField = (sourceConcept) => {
    const exact = fieldConcepts.find((field) => field.concept === sourceConcept);
    if (exact) return exact;
    if (sourceConcept?.startsWith('screen_')) {
      return fieldConcepts.find((field) => field.concept === 'screen') || null;
    }
    return null;
  };

  const knownLabels = new Set(SOURCE_LABELS.map(normalizeText));
  const sectionHeadings = new Set(SECTION_HEADINGS.map(normalizeText));
  const values = Object.fromEntries(fields.map((field) => [field.key, '']));
  const lines = String(rawText)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-•]+|[\s\t]+$/g, '').trim())
    .filter(Boolean);

  let activeField = null;
  lines.forEach((line) => {
    const tabParts = line.split(/\t+/).map((part) => part.trim()).filter(Boolean);
    const colonMatch = line.match(/^([^:]{2,80}):\s*(.+)$/);
    const possibleLabel = tabParts.length > 1 ? tabParts[0] : (colonMatch ? colonMatch[1] : line);
    const inlineValue = tabParts.length > 1 ? tabParts.slice(1).join(' ') : (colonMatch ? colonMatch[2] : '');
    const normalizedLabel = normalizeText(possibleLabel);
    const concept = getConcept(possibleLabel);

    if (sectionHeadings.has(normalizedLabel)) {
      activeField = null;
      return;
    }

    if (concept || knownLabels.has(normalizedLabel)) {
      activeField = concept ? findTargetField(concept) : null;
      if (activeField && inlineValue) {
        values[activeField.key] = [values[activeField.key], inlineValue].filter(Boolean).join('; ');
      }
      return;
    }

    if (activeField) {
      values[activeField.key] = [values[activeField.key], line].filter(Boolean).join('; ');
    }
  });

  return values;
};

const extractJson = (text = '') => {
  const clean = String(text).replace(/```json|```/gi, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI response does not contain JSON');
  return JSON.parse(clean.slice(start, end + 1));
};

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

// @desc    Parse pasted technical specifications into an existing category template
// @route   POST /api/products/parse-specs
router.post('/parse-specs', protect, admin, permit('products.write'), async (req, res) => {
  try {
    const rawText = String(req.body?.text || '').trim();
    const fields = (Array.isArray(req.body?.fields) ? req.body.fields : [])
      .slice(0, 60)
      .map((field) => ({
        key: String(field?.key || '').trim(),
        label: String(field?.label || '').trim(),
        unit: String(field?.unit || '').trim(),
      }))
      .filter((field) => field.key && field.label);

    if (!rawText) return res.status(400).json({ message: 'Vui lòng dán nội dung thông số kỹ thuật.' });
    if (rawText.length > 30000) return res.status(400).json({ message: 'Nội dung thông số quá dài, tối đa 30.000 ký tự.' });
    if (fields.length === 0) return res.status(400).json({ message: 'Danh mục chưa có bộ thông số kỹ thuật.' });

    const fallbackValues = parseSpecsLocally(rawText, fields);
    let parsedValues = fallbackValues;
    let parser = 'local';
    let warning = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.05,
            responseMimeType: 'application/json',
          },
        });
        const prompt = `Bạn là bộ chuẩn hóa thông số sản phẩm. Hãy đọc dữ liệu nguồn và chỉ điền vào các field đã cho.

Quy tắc bắt buộc:
- Chỉ trả về JSON theo cấu trúc {"values":{"field_key":"value"}}.
- Chỉ sử dụng đúng các field_key trong danh sách. Không tạo key mới.
- Nếu nguồn không có dữ liệu cho field thì trả chuỗi rỗng.
- Không suy đoán hoặc bịa thông số.
- Bỏ link Markdown nhưng giữ tên nhãn và giá trị.
- Nếu một field tổng quát bao gồm nhiều dữ liệu liên quan, hãy gộp ngắn gọn bằng dấu chấm phẩy.
- Giữ nguyên model, số liệu và đơn vị quan trọng.

Danh sách field:
${JSON.stringify(fields)}

Dữ liệu nguồn:
${rawText}`;
        const result = await model.generateContent(prompt);
        const aiData = extractJson(result.response.text());
        const aiValues = aiData?.values && typeof aiData.values === 'object' ? aiData.values : {};
        parsedValues = Object.fromEntries(fields.map((field) => [
          field.key,
          typeof aiValues[field.key] === 'string' ? aiValues[field.key].trim() : '',
        ]));
        parser = 'gemini';
      } catch (aiError) {
        const status = aiError?.status || aiError?.response?.status;
        console.error('[Specs AI]', status || 'unknown', aiError?.message || aiError);
        warning = status === 429
          ? 'Gemini đã hết quota, hệ thống đã dùng bộ phân tích cục bộ.'
          : 'Gemini tạm thời không phản hồi, hệ thống đã dùng bộ phân tích cục bộ.';
      }
    } else {
      warning = 'Máy chủ chưa cấu hình Gemini, hệ thống đã dùng bộ phân tích cục bộ.';
    }

    const results = fields.map((field) => ({
      ...field,
      value: parsedValues[field.key] || '',
      matched: Boolean(parsedValues[field.key]),
    }));

    res.json({
      parser,
      warning,
      results,
      matchedCount: results.filter((field) => field.matched).length,
      totalCount: results.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thể phân tích thông số kỹ thuật.', error: error.message });
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
router.post('/', protect, admin, permit('products.write'), async (req, res) => {
  try {
    const { name, category, brand, subCategory, price, images, description, specs, countInStock, badge, isHot, discount, discountedPrice } = req.body;

    const imagesArr = Array.isArray(images)
      ? images
      : (typeof images === 'string' ? images.split(',').map(i => i.trim()).filter(Boolean) : []);

    const specsData = normalizeSpecs(specs, []);

    const product = await Product.create({
      name,
      category,
      brand: brand ? String(brand).trim() : null,
      subCategory: subCategory ? String(subCategory).trim() : null,
      price: parseFloat(price) || 0,
      images: imagesArr,
      description,
      specs: specsData,
      countInStock: parseInt(countInStock) || 0,
      badge: badge || null,
      isHot: isHot === true || isHot === 'true',
      discount: parseInt(discount) || 0,
      discountedPrice: discountedPrice !== undefined && discountedPrice !== "" ? parseFloat(discountedPrice) : null,
      rating: 0,
      reviews: 0
    });

    await logActivity(req, {
      action: 'create',
      entityType: 'product',
      entityId: product.id,
      entityLabel: product.name,
      description: `Tạo sản phẩm "${product.name}"`,
      metadata: { category: product.category, brand: product.brand, price: product.price }
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo sản phẩm', error: error.message });
  }
});

// @desc    Update a product
// @route   PUT /api/products/:id
router.put('/:id', protect, admin, permit('products.write'), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (product) {
      const { name, category, brand, subCategory, price, images, description, specs, countInStock, badge, isHot, discount, discountedPrice } = req.body;

      const imagesArr = Array.isArray(images)
        ? images
        : (typeof images === 'string' ? images.split(',').map(i => i.trim()).filter(Boolean) : product.images);

      const specsData = normalizeSpecs(specs, product.specs);

      const previous = product.toJSON();

      product.name = name !== undefined ? name : product.name;
      product.category = category !== undefined ? category : product.category;
      product.brand = brand !== undefined ? (brand ? String(brand).trim() : null) : product.brand;
      product.subCategory = subCategory !== undefined ? (subCategory ? String(subCategory).trim() : null) : product.subCategory;
      product.price = price !== undefined ? parseFloat(price) : product.price;
      product.images = imagesArr;
      product.description = description !== undefined ? description : product.description;
      product.specs = specsData;
      product.countInStock = countInStock !== undefined ? parseInt(countInStock) : product.countInStock;
      product.badge = badge !== undefined ? badge : product.badge;
      product.isHot = isHot !== undefined ? (isHot === true || isHot === 'true') : product.isHot;
      product.discount = discount !== undefined ? parseInt(discount) || 0 : product.discount;
      product.discountedPrice = discountedPrice !== undefined ? (discountedPrice !== "" ? parseFloat(discountedPrice) : null) : product.discountedPrice;

      const updatedProduct = await product.save();
      await logActivity(req, {
        action: 'update',
        entityType: 'product',
        entityId: updatedProduct.id,
        entityLabel: updatedProduct.name,
        description: `Cập nhật sản phẩm "${updatedProduct.name}"`,
        metadata: {
          before: {
            name: previous.name,
            price: previous.price,
            countInStock: previous.countInStock,
            discount: previous.discount,
            discountedPrice: previous.discountedPrice
          },
          after: {
            name: updatedProduct.name,
            price: updatedProduct.price,
            countInStock: updatedProduct.countInStock,
            discount: updatedProduct.discount,
            discountedPrice: updatedProduct.discountedPrice
          }
        }
      });
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
router.delete('/:id', protect, admin, permit('products.write'), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (product) {
      const deletedProduct = product.toJSON();
      await product.destroy();
      await logActivity(req, {
        action: 'delete',
        entityType: 'product',
        entityId: deletedProduct.id,
        entityLabel: deletedProduct.name,
        description: `Deleted product "${deletedProduct.name}"`,
        metadata: { category: deletedProduct.category, brand: deletedProduct.brand }
      });
      res.json({ message: 'Đã xóa sản phẩm thành công' });
    } else {
      res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa sản phẩm', error: error.message });
  }
});

module.exports = router;
