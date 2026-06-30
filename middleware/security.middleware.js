const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://shoptech-frontend.vercel.app',
];

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseOrigins = () => {
  const raw = process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || '';
  const configured = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = parseOrigins();
    const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

    if (allowedOrigins.includes(origin) || isVercelPreview) {
      return callback(null, true);
    }

    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false,
  maxAge: 86400,
};

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const createRateLimiter = ({
  windowMs,
  max,
  message = 'Bạn gửi yêu cầu hơi nhanh. Vui lòng thử lại sau.',
  keyPrefix = 'global',
}) => {
  const hits = new Map();
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of hits.entries()) {
      if (value.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, Math.max(windowMs, 60 * 1000));

  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();

    const now = Date.now();
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(Math.max(max - 1, 0)));
      res.setHeader('RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    current.count += 1;
    const remaining = Math.max(max - current.count, 0);
    const retryAfter = Math.max(Math.ceil((current.resetAt - now) / 1000), 1);

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        message,
        retryAfter,
      });
    }

    return next();
  };
};

const requestLimiters = {
  api: createRateLimiter({
    keyPrefix: 'api',
    windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: parseNumber(process.env.RATE_LIMIT_API_MAX, 300),
  }),
  auth: createRateLimiter({
    keyPrefix: 'auth',
    windowMs: parseNumber(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
    max: parseNumber(process.env.RATE_LIMIT_AUTH_MAX, 10),
    message: 'Bạn đăng nhập hoặc đăng ký quá nhiều lần. Vui lòng thử lại sau.',
  }),
  chat: createRateLimiter({
    keyPrefix: 'chat',
    windowMs: parseNumber(process.env.RATE_LIMIT_CHAT_WINDOW_MS, 60 * 1000),
    max: parseNumber(process.env.RATE_LIMIT_CHAT_MAX, 20),
    message: 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng thử lại sau ít phút.',
  }),
  upload: createRateLimiter({
    keyPrefix: 'upload',
    windowMs: parseNumber(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS, 60 * 60 * 1000),
    max: parseNumber(process.env.RATE_LIMIT_UPLOAD_MAX, 60),
    message: 'Bạn tải ảnh lên quá nhiều lần. Vui lòng thử lại sau.',
  }),
  coupon: createRateLimiter({
    keyPrefix: 'coupon',
    windowMs: parseNumber(process.env.RATE_LIMIT_COUPON_WINDOW_MS, 5 * 60 * 1000),
    max: parseNumber(process.env.RATE_LIMIT_COUPON_MAX, 60),
    message: 'Bạn kiểm tra mã giảm giá quá nhanh. Vui lòng thử lại sau.',
  }),
};

const handleCorsError = (err, req, res, next) => {
  if (err?.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({
      message: 'Nguồn truy cập không được phép gọi API này.',
    });
  }

  return next(err);
};

const handlePayloadError = (err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'Dữ liệu gửi lên quá lớn. Vui lòng giảm kích thước nội dung.',
    });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      message: 'Dữ liệu JSON không hợp lệ.',
    });
  }

  return next(err);
};

module.exports = {
  corsOptions,
  securityHeaders,
  requestLimiters,
  handleCorsError,
  handlePayloadError,
};
