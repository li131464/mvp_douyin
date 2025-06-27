const douyinAuth = require('../../utils/login');

Page({
  data: {
    logs: [],
    isLogin: false,
    hasOAuth: false
  },

  onLoad() {
    this.addLog('调试页面已加载');
    this.checkStatus();
  },

  // 添加日志
  addLog(message) {
    const now = new Date().toLocaleTimeString();
    const logs = this.data.logs;
    logs.unshift(`${now}: ${message}`);
    this.setData({ logs: logs.slice(0, 20) }); // 只保留最新20条
  },

  // 检查状态
  checkStatus() {
    const isLogin = douyinAuth.isLoggedIn;
    const hasOAuth = douyinAuth.hasOAuthAuth;
    
    this.setData({ isLogin, hasOAuth });
    this.addLog(`状态检查 - 登录:${isLogin}, OAuth:${hasOAuth}`);
  },

  // 测试登录
  async testLogin() {
    try {
      this.addLog('开始测试登录...');
      const result = await douyinAuth.login();
      this.addLog(`登录结果: ${JSON.stringify(result)}`);
      this.checkStatus();
    } catch (error) {
      this.addLog(`登录失败: ${error.message}`);
    }
  },

  // 测试授权
  async testAuth() {
    try {
      this.addLog('开始测试授权...');
      
      // 检查tt对象
      if (typeof tt === 'undefined') {
        this.addLog('错误: tt对象未定义，不在抖音环境中');
        return;
      }

      // 检查授权API
      if (!tt.showDouyinOpenAuth) {
        this.addLog('错误: tt.showDouyinOpenAuth 方法不存在');
        return;
      }

      this.addLog('环境检查通过，开始OAuth授权...');
      
      // 先测试是否已登录
      if (!douyinAuth.isLoggedIn) {
        this.addLog('警告: 用户未登录，先进行登录...');
        await douyinAuth.login();
        this.addLog('登录完成，继续授权...');
      }
      
      const result = await douyinAuth.authorizeWithScopes(['ma.user.data']);
      this.addLog(`授权结果: ${JSON.stringify(result)}`);
      this.checkStatus();
    } catch (error) {
      this.addLog(`授权失败: ${error.message}`);
      this.addLog(`错误详情: ${JSON.stringify(error)}`);
      console.error('授权详细错误:', error);
    }
  },

  // 测试直接调用抖音API
  async testDirectAuth() {
    try {
      this.addLog('测试直接调用抖音授权API...');
      
      if (typeof tt === 'undefined' || !tt.showDouyinOpenAuth) {
        this.addLog('错误: 抖音授权API不可用');
        return;
      }

      const authResult = await new Promise((resolve, reject) => {
        tt.showDouyinOpenAuth({
          scopeList: ['ma.user.data'], // 使用正确的权限
          success: resolve,
          fail: reject
        });
      });

      this.addLog(`直接授权成功: ${JSON.stringify(authResult)}`);
      
      // 检查返回的关键字段
      if (authResult.ticket) {
        this.addLog(`获取到ticket: ${authResult.ticket}`);
      }
      if (authResult.code) {
        this.addLog(`获取到code: ${authResult.code}`);
      }
      if (authResult.grantPermissions) {
        this.addLog(`授权权限: ${JSON.stringify(authResult.grantPermissions)}`);
      }
    } catch (error) {
      this.addLog(`直接授权失败: ${JSON.stringify(error)}`);
      this.addLog(`错误类型: ${error.errNo}, 错误代码: ${error.errorCode}`);
    }
  },

  // 测试模拟授权
  async testMockAuth() {
    try {
      this.addLog('开始测试模拟授权...');
      
      const result = await douyinAuth._simulateOAuthAuth(['user_info']);
      this.addLog(`模拟授权成功: ${JSON.stringify(result)}`);
      this.checkStatus();
    } catch (error) {
      this.addLog(`模拟授权失败: ${error.message}`);
    }
  },

  // 测试真实数据获取
  async testRealData() {
    try {
      this.addLog('开始测试真实数据获取...');
      
      if (!douyinAuth.isLoggedIn) {
        this.addLog('用户未登录，先进行登录...');
        await douyinAuth.login();
      }

      if (!douyinAuth.hasOAuthAuth) {
        this.addLog('用户未授权，先进行授权...');
        const authResult = await douyinAuth.authorizeWithScopes([
          'ma.user.data' // 抖音主页数据权限
        ]);
        this.addLog(`授权结果: ${JSON.stringify(authResult)}`);
      }

      this.addLog('开始获取用户视频数据...');
      const videoResult = await douyinAuth.getUserVideos(0, 3);
      this.addLog(`视频数据获取结果: ${JSON.stringify(videoResult)}`);
      
      this.checkStatus();
    } catch (error) {
      this.addLog(`测试失败: ${error.message}`);
      this.addLog(`错误详情: ${JSON.stringify(error)}`);
    }
  },

  // 测试不同的权限申请方式
  async testDifferentScopes() {
    const scopeTests = [
      { name: '抖音主页数据', scopes: ['ma.user.data'] },
      { name: '视频数据查询', scopes: ['ma.video.bind'] },
      { name: '近30天视频数据', scopes: ['ma.item.data'] },
      { name: '视频评论数据', scopes: ['ma.item.comment'] }
    ];

    for (const test of scopeTests) {
      try {
        this.addLog(`测试${test.name}: ${JSON.stringify(test.scopes)}`);
        
        if (typeof tt === 'undefined' || !tt.showDouyinOpenAuth) {
          this.addLog(`${test.name}失败: 不在抖音环境中`);
          continue;
        }

        const authResult = await new Promise((resolve, reject) => {
          tt.showDouyinOpenAuth({
            scopeList: test.scopes,
            success: resolve,
            fail: reject
          });
        });

        this.addLog(`${test.name}成功: ${JSON.stringify(authResult)}`);
        if (authResult.ticket) {
          this.addLog(`获取到ticket: ${authResult.ticket.substring(0, 20)}...`);
        }
        if (authResult.grantPermissions) {
          this.addLog(`授权权限: ${JSON.stringify(authResult.grantPermissions)}`);
        }
        break; // 如果成功就停止测试
      } catch (error) {
        this.addLog(`${test.name}失败: ${error.errMsg || error.message}`);
        this.addLog(`错误码: ${error.errNo}, 错误详情: ${JSON.stringify(error)}`);
      }
    }
  },

  // 测试单一权限申请
  async testSingleScope() {
    try {
      this.addLog('开始测试单一权限申请...');
      
      if (typeof tt === 'undefined' || !tt.showDouyinOpenAuth) {
        this.addLog('错误: 不在抖音环境中');
        return;
      }

      // 只申请一个权限：抖音主页数据
      this.addLog('申请ma.user.data权限...');
      
      const authResult = await new Promise((resolve, reject) => {
        tt.showDouyinOpenAuth({
          scopeList: ['ma.user.data'],
          success: (res) => {
            this.addLog(`授权API调用成功: ${JSON.stringify(res)}`);
            resolve(res);
          },
          fail: (err) => {
            this.addLog(`授权API调用失败: ${JSON.stringify(err)}`);
            reject(err);
          }
        });
      });

      this.addLog(`授权成功，结果: ${JSON.stringify(authResult)}`);
      
      if (authResult.ticket) {
        this.addLog(`获取到ticket: ${authResult.ticket.substring(0, 30)}...`);
      } else {
        this.addLog('警告: 未获取到ticket字段');
      }
      
      if (authResult.grantPermissions) {
        this.addLog(`用户授权的权限: ${JSON.stringify(authResult.grantPermissions)}`);
      }
      
    } catch (error) {
      this.addLog(`单一权限测试失败: ${error.errMsg || error.message}`);
      this.addLog(`错误码: ${error.errNo}`);
      this.addLog(`完整错误信息: ${JSON.stringify(error)}`);
    }
  },

  // 详细测试权限配置
  async testDetailedAuth() {
    try {
      this.addLog('=== 开始详细权限测试 ===');
      
      if (typeof tt === 'undefined') {
        this.addLog('错误: tt对象未定义');
        return;
      }
      
      if (!tt.showDouyinOpenAuth) {
        this.addLog('错误: tt.showDouyinOpenAuth方法不存在');
        return;
      }
      
      this.addLog('环境检查通过，开始权限测试...');
      
      // 测试权限申请
      this.addLog('申请权限: ["ma.user.data"]');
      
      const authResult = await new Promise((resolve, reject) => {
        tt.showDouyinOpenAuth({
          scopeList: ['ma.user.data'],
          success: (res) => {
            this.addLog(`SUCCESS回调触发: ${JSON.stringify(res)}`);
            resolve(res);
          },
          fail: (err) => {
            this.addLog(`FAIL回调触发: ${JSON.stringify(err)}`);
            reject(err);
          },
          complete: (result) => {
            this.addLog(`COMPLETE回调触发: ${JSON.stringify(result)}`);
          }
        });
      });

      this.addLog('=== 权限申请成功 ===');
      this.addLog(`完整结果: ${JSON.stringify(authResult)}`);
      
      // 检查关键字段
      if (authResult.ticket) {
        this.addLog(`✓ 获取到ticket: ${authResult.ticket.substring(0, 30)}...`);
      } else {
        this.addLog('✗ 未获取到ticket字段');
      }
      
      if (authResult.grantPermissions) {
        this.addLog(`✓ 授权权限: ${JSON.stringify(authResult.grantPermissions)}`);
      } else {
        this.addLog('✗ 未获取到grantPermissions字段');
      }
      
      if (authResult.errMsg) {
        this.addLog(`消息: ${authResult.errMsg}`);
      }
      
    } catch (error) {
      this.addLog('=== 权限申请失败 ===');
      this.addLog(`错误类型: ${typeof error}`);
      this.addLog(`错误消息: ${error.message || error.errMsg || '未知错误'}`);
      this.addLog(`错误码: ${error.errNo || '无'}`);
      this.addLog(`完整错误: ${JSON.stringify(error)}`);
      
      // 分析具体错误
      if (error.errNo === 117403) {
        this.addLog('分析: 这是权限信息获取失败，可能权限未在后台配置');
      } else if (error.errNo === 117405) {
        this.addLog('分析: 没有可用的授权权限，权限可能未开通');
      } else if (error.errNo === 117490) {
        this.addLog('分析: 用户取消了授权');
      } else if (error.errNo === 117492) {
        this.addLog('分析: 小程序未配置相应权限');
      }
    }
  },

  // 清除日志
  clearLogs() {
    this.setData({ logs: [] });
  },

  // 注销
  logout() {
    douyinAuth.logout();
    this.checkStatus();
    this.addLog('已注销');
  }
}); 