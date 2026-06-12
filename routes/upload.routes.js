const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const { protect, admin, permit } = require('../auth.middleware');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// File filter (images only)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận các file ảnh (.jpeg, .jpg, .png, .gif, .webp)!'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

const uploadSingle = upload.single('image');
const uploadMultiple = upload.array('images', 10);

const uploadBufferToCloudinary = (buffer, originalname) =>
  new Promise((resolve, reject) => {
    const ext = path.extname(originalname || '').replace('.', '') || 'jpg';
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'shoptech/products',
        resource_type: 'image',
        format: ext,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
    stream.end(buffer);
  });

// @desc    Upload product image to Cloudinary
// @route   POST /api/upload
router.post('/', protect, admin, permit('products.write'), (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ message: 'Thiếu cấu hình Cloudinary trên server (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).' });
  }

  uploadSingle(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading (e.g. file size exceeded)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Dung lượng ảnh vượt quá giới hạn cho phép (Tối đa 5MB)!' });
      }
      return res.status(400).json({ message: `Lỗi tải lên: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading.
      return res.status(400).json({ message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn một file ảnh để tải lên!' });
    }

    uploadBufferToCloudinary(req.file.buffer, req.file.originalname)
      .then((result) => {
        res.status(200).json({
          message: 'Tải ảnh lên Cloudinary thành công',
          imageUrl: result.secure_url,
          filename: result.public_id,
        });
      })
      .catch((uploadError) => {
        res.status(500).json({
          message: 'Lỗi tải ảnh lên Cloudinary',
          error: uploadError.message,
        });
      });
  });
});

// @desc    Upload multiple product images to Cloudinary
// @route   POST /api/upload/multiple
router.post('/multiple', protect, admin, permit('products.write'), (req, res) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ message: 'Thiếu cấu hình Cloudinary trên server (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).' });
  }

  uploadMultiple(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Dung lượng ảnh vượt quá giới hạn cho phép (Tối đa 5MB)!' });
      }
      return res.status(400).json({ message: `Lỗi tải lên: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất một file ảnh để tải lên!' });
    }

    const uploadPromises = req.files.map(file => 
      uploadBufferToCloudinary(file.buffer, file.originalname)
    );

    Promise.all(uploadPromises)
      .then((results) => {
        const imageUrls = results.map(r => r.secure_url);
        res.status(200).json({
          message: 'Tải các ảnh lên Cloudinary thành công',
          imageUrls: imageUrls
        });
      })
      .catch((uploadError) => {
        res.status(500).json({
          message: 'Lỗi tải ảnh lên Cloudinary',
          error: uploadError.message,
        });
      });
  });
});

module.exports = router;
