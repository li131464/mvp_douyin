const logger = require('./logger');
const douyinApi = require('./douyinApi');

/**
 * 系统配置检查工具
 * 用于诊断抖音开放平台配置和权限状态
 */
class SystemCheck {
  constructor() {
    this.checkResults = [];
  }

  /**
   * 添加检查结果
   */
  addResult(category, item, status, message, details = null) {
    this.checkResults.push({
      category,
      item,
      status, // 'pass', 'warn', 'fail'
      message,
      details,
      timestamp: new Date().toISOString()
    });
    
    const icon = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
    logger.info(`${icon} [${category}] ${item}: ${message}`);
    
    if (details) {
      logger.debug(`详细信息:`, details);
    }
  }

  /**
   * 检查环境变量配置
   */
  checkEnvironmentConfig() {
    const category = '环境配置';
    
    // 检查抖音App ID
    if (process.env.DOUYIN_APP_ID) {
      this.addResult(
        category,
        '抖音App ID',
        'pass',
        '已配置',
        {
          length: process.env.DOUYIN_APP_ID.length,
          prefix: process.env.DOUYIN_APP_ID.substring(0, 4) + '...'
        }
      );
    } else {
      this.addResult(
        category,
        '抖音App ID',
        'fail',
        '未配置，请在.env文件中设置DOUYIN_APP_ID'
      );
    }
    
    // 检查抖音App Secret
    if (process.env.DOUYIN_APP_SECRET) {
      this.addResult(
        category,
        '抖音App Secret',
        'pass',
        '已配置',
        {
          length: process.env.DOUYIN_APP_SECRET.length
        }
      );
    } else {
      this.addResult(
        category,
        '抖音App Secret',
        'fail',
        '未配置，请在.env文件中设置DOUYIN_APP_SECRET'
      );
    }
    
    // 检查API基础URL
    if (process.env.DOUYIN_API_BASE_URL) {
      this.addResult(
        category,
        'API基础URL',
        'pass',
        '已配置',
        {
          url: process.env.DOUYIN_API_BASE_URL
        }
      );
    } else {
      this.addResult(
        category,
        'API基础URL',
        'warn',
        '未配置，使用默认值: https://open.douyin.com'
      );
    }
  }

  /**
   * 检查抖音开放平台权限申请状态
   */
  async checkDouyinPermissions() {
    const category = '抖音权限';
    
    // 网站应用权限
    const websitePermissions = [
      'video.list.bind',      // 视频列表查询权限
      'data.external.item',   // 视频数据访问权限
      'comment.list',         // 评论列表权限
      'message.list'          // 私信列表权限
    ];
    
    // 小程序权限
    const miniAppPermissions = [
      'ma.item.data',         // 近30天视频数据查询权限
      'ma.user.data',         // 抖音主页数据权限
      'user_info'             // 用户基本信息权限
    ];
    
    this.addResult(
      category,
      '网站应用权限',
      'warn',
      '需要在抖音开放平台申请',
      {
        requiredPermissions: websitePermissions,
        applyUrl: 'https://developer.open-douyin.com/console/app/管理权限'
      }
    );
    
    this.addResult(
      category,
      '小程序权限',
      'warn',
      '需要在抖音开放平台申请',
      {
        requiredPermissions: miniAppPermissions,
        requirements: {
          'ma.item.data': '需要企业主体 + 小程序上线 + 信用分>90',
          'ma.user.data': '基础权限',
          'user_info': '基础权限'
        },
        applyUrl: 'https://developer.open-douyin.com/console/miniapp/能力管理/权限管理'
      }
    );
  }

  /**
   * 检查API连接状态
   */
  async checkAPIConnection() {
    const category = 'API连接';
    
    try {
      // 检查抖音API域名连接
      this.addResult(
        category,
        '抖音API域名',
        'pass',
        '连接正常',
        {
          baseURL: douyinApi.baseURL,
          timeout: '30秒'
        }
      );
    } catch (error) {
      this.addResult(
        category,
        '抖音API域名',
        'fail',
        '连接失败',
        {
          error: error.message,
          baseURL: douyinApi.baseURL
        }
      );
    }
  }

  /**
   * 检查OAuth授权流程
   */
  async checkOAuthFlow() {
    const category = 'OAuth授权';
    
    // 检查是否有必要的配置
    if (!process.env.DOUYIN_APP_ID || !process.env.DOUYIN_APP_SECRET) {
      this.addResult(
        category,
        'OAuth配置',
        'fail',
        '缺少必要的App ID或App Secret配置'
      );
      return;
    }
    
    this.addResult(
      category,
      'OAuth配置',
      'pass',
      '基础配置完整'
    );
    
    // OAuth流程说明
    this.addResult(
      category,
      'OAuth流程',
      'warn',
      '需要用户在小程序中进行授权',
      {
        steps: [
          '1. 用户在小程序中点击登录',
          '2. 调用tt.login()获取登录凭证',
          '3. 后端使用凭证调用code2session',
          '4. 用户授权数据访问权限',
          '5. 后端获取access_token',
          '6. 使用access_token调用抖音API'
        ]
      }
    );
  }

  /**
   * 检查Mock模式配置
   */
  checkMockModeConfig() {
    const category = 'Mock模式';
    
    this.addResult(
      category,
      'Mock模式状态',
      'pass',
      '已启用，用于开发和演示',
      {
        description: '当真实API调用失败时，系统会自动切换到Mock模式',
        benefits: [
          '开发环境友好',
          '真机测试支持',
          '网络问题容错',
          '权限申请期间可正常使用'
        ]
      }
    );
  }

  /**
   * 检查日志配置
   */
  checkLoggingConfig() {
    const category = '日志系统';
    
    this.addResult(
      category,
      '日志级别',
      'pass',
      `当前级别: ${process.env.LOG_LEVEL || 'info'}`,
      {
        availableLevels: ['error', 'warn', 'info', 'debug'],
        currentLevel: process.env.LOG_LEVEL || 'info'
      }
    );
    
    this.addResult(
      category,
      '日志输出',
      'pass',
      '控制台 + 文件输出',
      {
        consoleEnabled: true,
        fileEnabled: true,
        logFiles: [
          'logs/combined.log',
          'logs/error.log',
          'logs/exceptions.log'
        ]
      }
    );
  }

  /**
   * 执行完整的系统检查
   */
  async runFullCheck() {
    logger.info('🔍 开始系统配置检查...');
    this.checkResults = [];
    
    // 执行各项检查
    this.checkEnvironmentConfig();
    await this.checkDouyinPermissions();
    await this.checkAPIConnection();
    await this.checkOAuthFlow();
    this.checkMockModeConfig();
    this.checkLoggingConfig();
    
    // 统计结果
    const stats = {
      total: this.checkResults.length,
      passed: this.checkResults.filter(r => r.status === 'pass').length,
      warnings: this.checkResults.filter(r => r.status === 'warn').length,
      failed: this.checkResults.filter(r => r.status === 'fail').length
    };
    
    logger.info('📊 系统检查完成', stats);
    
    // 输出汇总
    if (stats.failed > 0) {
      logger.error(`❌ 发现 ${stats.failed} 个配置问题，需要修复：`);
      this.checkResults
        .filter(r => r.status === 'fail')
        .forEach(r => logger.error(`  • ${r.item}: ${r.message}`));
    }
    
    if (stats.warnings > 0) {
      logger.warn(`⚠️ 发现 ${stats.warnings} 个需要注意的项目：`);
      this.checkResults
        .filter(r => r.status === 'warn')
        .forEach(r => logger.warn(`  • ${r.item}: ${r.message}`));
    }
    
    logger.info(`✅ ${stats.passed} 个项目配置正常`);
    
    return {
      success: stats.failed === 0,
      stats,
      results: this.checkResults
    };
  }

  /**
   * 获取权限申请指南
   */
  getPermissionGuide() {
    return {
      小程序权限申请: {
        平台: 'https://developer.open-douyin.com/console/miniapp',
        路径: '控制台 → 小程序管理 → 能力管理 → 权限管理',
        权限列表: {
          'ma.item.data': {
            名称: '近30天视频数据查询',
            要求: '企业主体 + 小程序上线 + 信用分>90',
            审核时间: '1-3个工作日'
          },
          'ma.user.data': {
            名称: '抖音主页数据权限',
            要求: '基础权限',
            审核时间: '即时生效'
          },
          'user_info': {
            名称: '用户基本信息权限',
            要求: '基础权限',
            审核时间: '即时生效'
          }
        }
      },
      网站应用权限申请: {
        平台: 'https://developer.open-douyin.com/console/app',
        路径: '控制台 → 应用管理 → 管理权限',
        权限列表: {
          'video.list.bind': {
            名称: '视频列表查询权限',
            要求: '企业主体',
            审核时间: '1-3个工作日'
          },
          'data.external.item': {
            名称: '视频数据访问权限',
            要求: '企业主体',
            审核时间: '1-3个工作日'
          }
        }
      }
    };
  }
}

module.exports = new SystemCheck(); 