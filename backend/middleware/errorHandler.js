const logger = require('../utils/logger');

/**
 * 错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误日志
  logger.error('Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose错误处理
  if (err.name === 'CastError') {
    const message = '资源未找到';
    error = { message, statusCode: 404 };
  }

  // Mongoose重复字段错误
  if (err.code === 11000) {
    const message = '重复的字段值';
    error = { message, statusCode: 400 };
  }

  // Mongoose验证错误
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    const message = '无效的token';
    error = { message, statusCode: 401 };
  }

  // JWT过期错误
  if (err.name === 'TokenExpiredError') {
    const message = 'Token已过期';
    error = { message, statusCode: 401 };
  }

  // Axios错误
  if (err.response && err.response.data) {
    const message = err.response.data.message || '外部API调用失败';
    error = { message, statusCode: err.response.status || 500 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || '服务器内部错误',
    code: error.code || 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 异步错误捕获包装器
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  asyncHandler
}; 