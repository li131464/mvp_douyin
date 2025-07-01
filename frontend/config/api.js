/**
 * API配置文件
 */

// 环境检测
function isDevToolsEnv() {
  try {
    if (typeof tt !== 'undefined' && tt.getSystemInfoSync) {
      const systemInfo = tt.getSystemInfoSync();
      return systemInfo.platform === 'devtools';
    }
  } catch (error) {
    console.warn('检测环境信息失败:', error);
  }
  return false;
}

// API配置
const API_CONFIG = {
  development: {
    baseUrl: 'http://localhost:3000',
    timeout: 10000
  },
  production: {
    baseUrl: 'http://kuzchat.cn:3090',
    timeout: 15000
  }
};

function getApiBaseUrl() {
  const isDevTools = isDevToolsEnv();
  if (isDevTools) {
    return API_CONFIG.development.baseUrl;
  } else {
    return API_CONFIG.production.baseUrl;
  }
}

async function testServerConnection(baseUrl = null) {
  const testUrl = baseUrl || getApiBaseUrl();
  
  return new Promise((resolve) => {
    tt.request({
      url: `${testUrl}/health`,
      method: 'GET',
      timeout: 5000,
      success: (res) => {
        resolve({
          success: true,
          baseUrl: testUrl,
          data: res.data
        });
      },
      fail: (err) => {
        resolve({
          success: false,
          baseUrl: testUrl,
          error: err.errMsg || '连接失败'
        });
      }
    });
  });
}

module.exports = {
  getApiBaseUrl,
  testServerConnection,
  isDevToolsEnv,
  API_CONFIG
};
