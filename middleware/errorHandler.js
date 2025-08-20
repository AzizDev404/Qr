/**
 * Global Error Handler Middleware
 * Barcha xatoliklarni to'g'ri handle qilish va log qilish
 */

/**
 * Development environment uchun batafsil error response
 */
const sendErrorDev = (err, res) => {
  console.error('🐛 Development Error:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code
  });

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack, // Development da stack trace ko'rsatish
    details: err.details || null
  });
};

/**
 * Production environment uchun sodda error response
 */
const sendErrorProd = (err, res) => {
  // Operational (expected) errors - user ga ko'rsatish mumkin
  if (err.isOperational) {
    console.error('⚠️ Operational Error:', err.message);
    
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message
    });
  } 
  // Programming errors - generic message
  else {
    console.error('💥 Programming Error:', {
      message: err.message,
      stack: err.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Serverda xatolik yuz berdi'
    });
  }
};

/**
 * MongoDB cast error (noto'g'ri ID format)
 */
const handleCastErrorDB = (err) => {
  const message = `Noto'g'ri ${err.path}: ${err.value}`;
  return createAppError(message, 400);
};

/**
 * MongoDB duplicate key error
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field}: '${value}' allaqachon mavjud`;
  return createAppError(message, 400);
};

/**
 * MongoDB validation error
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Ma'lumotlar noto'g'ri: ${errors.join('. ')}`;
  return createAppError(message, 400);
};

/**
 * JWT token error
 */
const handleJWTError = () => {
  return createAppError('Noto\'g\'ri token. Qayta login qiling!', 401);
};

/**
 * JWT expired error
 */
const handleJWTExpiredError = () => {
  return createAppError('Token muddati tugagan. Qayta login qiling!', 401);
};

/**
 * File upload errors
 */
const handleMulterError = (err) => {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return createAppError('Fayl hajmi juda katta!', 400);
    case 'LIMIT_FILE_COUNT':
      return createAppError('Juda ko\'p fayl yuklandi!', 400);
    case 'LIMIT_UNEXPECTED_FILE':
      return createAppError('Kutilmagan fayl field!', 400);
    default:
      return createAppError(`Fayl yuklashda xatolik: ${err.message}`, 400);
  }
};

/**
 * Custom Application Error class
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Operational error flag
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * AppError yaratish helper function
 */
const createAppError = (message, statusCode) => {
  return new AppError(message, statusCode);
};

/**
 * Async function larni wrap qilish - try/catch ni avtomatlashtirish
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Asosiy Global Error Handler
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // MongoDB specific errors
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    
    // JWT errors
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    // Multer errors
    if (error.name === 'MulterError') error = handleMulterError(error);

    sendErrorProd(error, res);
  }
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const message = `Route topilmadi: ${req.originalUrl}`;
  const error = createAppError(message, 404);
  next(error);
};

/**
 * Request logging middleware (development uchun)
 */
const requestLogger = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`📡 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    
    // Request body log (parollarni yashirish)
    if (req.body && Object.keys(req.body).length > 0) {
      const logBody = { ...req.body };
      if (logBody.password) logBody.password = '***';
      console.log('📦 Body:', logBody);
    }
  }
  next();
};

/**
 * Response time logger
 */
const responseTimeLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode < 400 ? '✅' : '❌';
    console.log(`${statusColor} ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

/**
 * Safe JSON parse with error handling
 */
const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch (error) {
    throw createAppError('JSON format noto\'g\'ri', 400);
  }
};

/**
 * Validate required fields
 */
const validateRequiredFields = (fields, req) => {
  const missingFields = [];
  
  fields.forEach(field => {
    if (!req.body[field]) {
      missingFields.push(field);
    }
  });
  
  if (missingFields.length > 0) {
    throw createAppError(
      `Majburiy maydonlar: ${missingFields.join(', ')}`, 
      400
    );
  }
};

/**
 * Database connection error handler
 */
const handleDBConnection = () => {
  const mongoose = require('mongoose');
  
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB Error:', err);
  });
  
  mongoose.connection.on('disconnected', () => {
    console.log('🔌 MongoDB disconnected');
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close();
      console.log('🔒 MongoDB connection closed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error closing MongoDB:', error);
      process.exit(1);
    }
  });
};

module.exports = {
  AppError,
  createAppError,
  catchAsync,
  globalErrorHandler,
  notFoundHandler,
  requestLogger,
  responseTimeLogger,
  safeJsonParse,
  validateRequiredFields,
  handleDBConnection
};