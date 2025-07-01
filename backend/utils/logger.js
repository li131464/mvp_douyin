const winston = require('winston');
const path = require('path');

// 创建日志目录
const logDir = 'logs';
require('fs').mkdirSync(logDir, { recursive: true });

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 控制台输出格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(info => {
      return `${info.timestamp} [${info.level}]: ${info.message}`;
    })
  ),
  transports: [
    // 控制台输出 - 在开发环境显示详细日志
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(info => {
          const timestamp = new Date().toLocaleTimeString('zh-CN', { 
            hour12: false,
            timeZone: 'Asia/Shanghai'
          });
          return `${timestamp} [${info.level}]: ${info.message}`;
        })
      )
    }),
    
    // 文件输出 - 记录所有日志
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => {
          return `${info.timestamp} [${info.level}]: ${info.message}`;
        })
      )
    }),
    
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => {
          return `${info.timestamp} [${info.level}]: ${info.message}`;
        })
      )
    })
  ],
  
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/exceptions.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => {
          return `${info.timestamp} [EXCEPTION]: ${info.message}`;
        })
      )
    })
  ]
});

// 处理未捕获的异常
logger.exceptions.handle(
  new winston.transports.File({ filename: path.join(logDir, 'exceptions.log') })
);

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

module.exports = logger; 