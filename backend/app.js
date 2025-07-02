const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const systemCheck = require('./utils/systemCheck');
const authRoutes = require('./routes/auth');
const douyinRoutes = require('./routes/douyin');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3090;

// 安全中间件
app.use(helmet());

// CORS配置 - 支持小程序和跨域请求
const corsOptions = {
  origin: function (origin, callback) {
    // 允许所有来源，包括小程序请求（小程序请求可能没有origin）
    callback(null, true);
  },
  credentials: false, // 小程序不需要凭据
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // 兼容老版本浏览器
};

app.use(cors(corsOptions));

// 请求解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 最多100个请求
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version,
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// 调试端点 - 返回服务器配置信息
app.get('/api/debug/info', (req, res) => {
  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      server: {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        version: require('./package.json').version
      },
      config: {
        hasAppId: !!process.env.DOUYIN_APP_ID,
        hasAppSecret: !!process.env.DOUYIN_APP_SECRET,
        appId: process.env.DOUYIN_APP_ID ? `${process.env.DOUYIN_APP_ID.substring(0, 6)}***` : 'not configured',
        apiBaseUrl: process.env.DOUYIN_API_BASE_URL
      },
      request: {
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        ip: req.ip,
        method: req.method
      }
    }
  });
});

// 添加请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  const userAgent = req.get('User-Agent') || 'Unknown';
  const origin = req.get('Origin') || 'No-Origin';
  
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: userAgent.substring(0, 100), // 截取前100字符
    origin,
    contentType: req.get('Content-Type')
  });

  // 响应完成时记录日志
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Response: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/douyin', douyinRoutes);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    code: 'NOT_FOUND'
  });
});

// 错误处理中间件
app.use(errorHandler);

const server = app.listen(PORT, async () => {
  logger.info(`服务器启动成功，监听端口: ${PORT}`);
  logger.info(`服务器地址: http://localhost:${PORT}`);
  logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`日志级别: ${process.env.LOG_LEVEL || 'info'}`);
  logger.info(`抖音API配置: ${process.env.DOUYIN_APP_ID ? '已配置' : '未配置(使用模拟模式)'}`);
  logger.info('========================================');
  
  // 启动时显示日志监控提示
  console.log('\n==================== 服务器启动成功 ====================');
  console.log(`🚀 服务器已启动，监听端口: ${PORT}`);
  console.log(`🌐 服务器地址: http://localhost:${PORT}`);
  console.log(`📊 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 日志级别: ${process.env.LOG_LEVEL || 'info'}`);
  console.log(`🔑 抖音API: ${process.env.DOUYIN_APP_ID ? '已配置' : '未配置(使用模拟模式)'}`);
  console.log('========================================');
  
  // 执行系统配置检查
  try {
    console.log('🔍 正在执行系统配置检查...');
    const checkResult = await systemCheck.runFullCheck();
    
    if (checkResult.success) {
      console.log('✅ 系统配置检查完成，所有项目正常');
    } else {
      console.log(`⚠️ 系统配置检查完成，发现 ${checkResult.stats.failed} 个问题需要修复`);
      console.log('💡 详细信息请查看日志文件或控制台输出');
      
      // 输出权限申请指南
      const guide = systemCheck.getPermissionGuide();
      console.log('\n📋 权限申请指南:');
      console.log('🔗 小程序权限申请:', guide.小程序权限申请.平台);
      console.log('🔗 网站应用权限申请:', guide.网站应用权限申请.平台);
    }
  } catch (error) {
    console.log('❌ 系统配置检查失败:', error.message);
  }
  
  console.log('========================================');
  console.log('📋 实时日志监控已启用，服务器请求将在下方显示...');
  console.log('========================================\n');
  
  logger.info('服务器已启动完成，等待客户端连接...');
  logger.info('========================================');
});

// 优雅关闭处理
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    logger.info('服务器已关闭');
    process.exit(0);
  });
});

module.exports = app; 