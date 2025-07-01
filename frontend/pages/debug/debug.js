const douyinAuth = require('../../utils/login');
const apiConfig = require('../../config/api');

Page({
  data: {
    logs: [],
    isLogin: false,
    hasOAuth: false,
    debugInfo: '',
    serverStatus: '',
    authStatus: '',
    networkStatus: ''
  },

  onLoad() {
    this.addLog('调试页面已加载');
    this.checkStatus();
    this.refreshDebugInfo();
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
    const accessToken = douyinAuth._accessToken;
    const authorizedScopes = douyinAuth.authorizedScopes;
    
    this.setData({ isLogin, hasOAuth });
    this.addLog(`状态检查 - 登录:${isLogin}, OAuth:${hasOAuth}`);
    this.addLog(`详细信息 - AccessToken:${accessToken ? '已获取' : '未获取'}, 权限:${JSON.stringify(authorizedScopes)}`);
    
    // 额外的调试信息
    this.addLog(`调试信息 - Token长度:${accessToken ? accessToken.length : 0}, 权限数量:${authorizedScopes.length}`);
    if (accessToken) {
      this.addLog(`Token前10位: ${accessToken.substring(0, 10)}...`);
    }
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
      
      // 延迟一秒后检查状态，确保状态已保存
      setTimeout(() => {
        this.checkStatus();
        this.addLog('=== 授权完成，状态已更新 ===');
      }, 1000);
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
  async testSimulateAuth() {
    try {
      tt.showLoading({ title: '测试模拟授权...' });

      console.log('开始测试模拟授权...');
      console.log('授权前状态检查:', {
        isLoggedIn: douyinAuth.isLoggedIn,
        hasOAuthAuth: douyinAuth.hasOAuthAuth,
        hasAccessToken: !!douyinAuth._accessToken,
        authorizedScopes: douyinAuth.authorizedScopes
      });
      
      const result = await douyinAuth._simulateOAuthAuth(['ma.user.data']);

      console.log('模拟授权结果:', result);
      console.log('授权后状态检查:', {
        isLoggedIn: douyinAuth.isLoggedIn,
        hasOAuthAuth: douyinAuth.hasOAuthAuth,
        hasAccessToken: !!douyinAuth._accessToken,
        accessTokenLength: douyinAuth._accessToken ? douyinAuth._accessToken.length : 0,
        authorizedScopes: douyinAuth.authorizedScopes
      });

      tt.hideLoading();

      if (result.success) {
        const statusInfo = result.finalStatus || {
          hasOAuthAuth: douyinAuth.hasOAuthAuth,
          hasAccessToken: !!douyinAuth._accessToken,
          accessTokenLength: douyinAuth._accessToken ? douyinAuth._accessToken.length : 0,
          scopes: douyinAuth.authorizedScopes
        };
        
        tt.showModal({
          title: '模拟授权测试成功',
          content: `✅ 测试结果：\n• 权限获取：${result.scopes.join(', ')}\n• 访问令牌：${statusInfo.hasAccessToken ? '已生成' : '未生成'}\n• Token长度：${statusInfo.accessTokenLength}\n• OAuth状态：${statusInfo.hasOAuthAuth ? '已授权' : '未授权'}\n• 数据来源：${result.isRealData ? '真实API' : '模拟数据'}\n• 回退模式：${result.fallbackMode ? '是' : '否'}`,
          showCancel: false,
          confirmText: '我知道了',
          success: () => {
            // 刷新调试信息
            this.refreshDebugInfo();
          }
        });
      } else {
        tt.showModal({
          title: '模拟授权测试失败',
          content: '测试失败，请查看控制台日志了解详情',
          showCancel: false
        });
      }

    } catch (error) {
      tt.hideLoading();
      console.error('模拟授权测试失败:', error);
      tt.showModal({
        title: '测试失败',
        content: `错误信息：${error.message}\n\n请检查控制台日志获取更多详情。`,
        showCancel: false
      });
    }
  },

  // 测试真实数据获取
  async testRealData() {
    try {
      this.addLog('=== 开始测试真实数据获取流程 ===');
      
      // 第一步：检查登录状态
      if (!douyinAuth.isLoggedIn) {
        this.addLog('Step 1: 用户未登录，先进行登录...');
        await douyinAuth.login();
        this.addLog('✅ 登录完成');
      } else {
        this.addLog('✅ Step 1: 用户已登录');
      }

      // 第二步：检查OAuth授权状态
      if (!douyinAuth.hasOAuthAuth) {
        this.addLog('Step 2: 用户未授权，开始OAuth授权...');
        const authResult = await douyinAuth.authorizeWithScopes([
          'ma.user.data' // 抖音主页数据权限
        ]);
        this.addLog(`✅ 授权完成: ${JSON.stringify(authResult)}`);
        
        // 再次检查授权状态
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (douyinAuth.hasOAuthAuth) {
          this.addLog('✅ OAuth状态确认成功');
        } else {
          this.addLog('⚠️ OAuth状态检查异常，但继续尝试获取数据...');
        }
      } else {
        this.addLog('✅ Step 2: 用户已授权');
      }

      // 第三步：获取用户数据
      this.addLog('Step 3: 开始获取用户视频数据...');
      try {
        const videoResult = await douyinAuth.getUserVideos(0, 3);
        this.addLog(`✅ 视频数据获取成功!`);
        this.addLog(`数据概览: 获取${videoResult.data.length}个视频，hasMore:${videoResult.hasMore}`);
        this.addLog(`首个视频: ${videoResult.data[0] ? videoResult.data[0].title : '无数据'}`);
        
        if (videoResult.data.length > 0) {
          this.addLog('🎉 恭喜！成功获取到抖音真实数据！');
        }
      } catch (videoError) {
        this.addLog(`❌ 视频数据获取失败: ${videoError.message}`);
      }
      
      // 第四步：更新状态显示
      this.checkStatus();
      this.addLog('=== 真实数据测试完成 ===');
      
    } catch (error) {
      this.addLog(`❌ 测试失败: ${error.message}`);
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

  // 测试服务器连接
  async testConnection() {
    try {
      this.addLog('=== 开始网络连接测试 ===');
      
      // 显示当前环境信息
      const isDevTools = apiConfig.isDevToolsEnv();
      this.addLog(`当前环境: ${isDevTools ? '开发者工具' : '真机'}`);
      
      const currentBaseUrl = apiConfig.getApiBaseUrl();
      this.addLog(`目标服务器: ${currentBaseUrl}`);
      
      // 测试连接
      this.addLog('发起连接测试...');
      const result = await apiConfig.testServerConnection();
      
      if (result.success) {
        this.addLog(`✅ 连接成功！`);
        this.addLog(`服务器响应: ${JSON.stringify(result.data)}`);
        this.addLog(`状态码: ${result.statusCode || '200'}`);
      } else {
        this.addLog(`❌ 连接失败: ${result.error}`);
        this.addLog(`服务器地址: ${result.baseUrl}`);
        
        // 给出建议
        if (!isDevTools) {
          this.addLog('建议检查：');
          this.addLog('1. 小程序后台是否配置了服务器域名');
          this.addLog('2. 服务器是否正常运行');
          this.addLog('3. 网络是否正常');
        }
      }
      
      this.addLog('=== 连接测试完成 ===');
    } catch (error) {
      this.addLog(`连接测试异常: ${error.message}`);
    }
  },

  // 获取服务器调试信息
  async getServerInfo() {
    try {
      this.addLog('获取服务器调试信息...');
      const result = await douyinAuth.getDebugInfo();
      if (result.success) {
        this.addLog(`服务器信息: ${JSON.stringify(result.data)}`);
      } else {
        this.addLog(`获取失败: ${result.error}`);
      }
    } catch (error) {
      this.addLog(`获取服务器信息异常: ${error.message}`);
    }
  },

  // 测试多个服务器
  async testMultipleServers() {
    this.addLog('=== 测试所有可用服务器 ===');
    
    const servers = [
      { name: '主服务器', url: 'http://kuzchat.cn:3090' },
      { name: '本地服务器', url: 'http://localhost:3000' },
      { name: '备用服务器', url: 'http://47.108.240.146:3090' }
    ];
    
    for (const server of servers) {
      try {
        this.addLog(`测试 ${server.name}: ${server.url}`);
        const result = await apiConfig.testServerConnection(server.url);
        
        if (result.success) {
          this.addLog(`✅ ${server.name} 连接成功`);
          this.addLog(`响应时间: ${result.data ? '正常' : '未知'}`);
        } else {
          this.addLog(`❌ ${server.name} 连接失败: ${result.error}`);
        }
      } catch (error) {
        this.addLog(`❌ ${server.name} 测试异常: ${error.message}`);
      }
      
      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.addLog('=== 服务器测试完成 ===');
  },

  // 测试服务器调试信息
  async debugOAuthStatus() {
    try {
      this.addLog('=== 开始调试OAuth状态 ===');
      
      if (!douyinAuth.openId) {
        this.addLog('错误: 用户未登录，无法调试OAuth状态');
        return;
      }
      
      this.addLog(`正在调试用户 ${douyinAuth.openId} 的OAuth状态...`);
      
      // 调用后端调试接口
      const debugResult = await douyinAuth._callBackendAPI(`/api/auth/debug/${douyinAuth.openId}`);
      
      this.addLog('=== 后端调试信息 ===');
      this.addLog(`OpenID: ${debugResult.data.openId}`);
      this.addLog(`有Session: ${debugResult.data.hasSession}`);
      this.addLog(`有AccessToken: ${debugResult.data.hasAccessToken}`);
      
      if (debugResult.data.sessionInfo) {
        this.addLog(`Session创建时间: ${debugResult.data.sessionInfo.createdAt}`);
        this.addLog(`有UnionID: ${debugResult.data.sessionInfo.hasUnionid}`);
      }
      
      if (debugResult.data.tokenInfo) {
        this.addLog(`Token权限范围: ${debugResult.data.tokenInfo.scope}`);
        this.addLog(`Token创建时间: ${debugResult.data.tokenInfo.createdAt}`);
        this.addLog(`Token过期时间: ${debugResult.data.tokenInfo.expiresAt}`);
        this.addLog(`Token是否过期: ${debugResult.data.tokenInfo.isExpired}`);
      }
      
      this.addLog(`服务器环境: ${debugResult.data.environment.nodeEnv}`);
      this.addLog(`抖音API配置: ${debugResult.data.environment.hasAppId ? '已配置' : '未配置'}`);
      
      this.addLog('=== 前端状态对比 ===');
      this.addLog(`前端登录状态: ${douyinAuth.isLoggedIn}`);
      this.addLog(`前端OAuth状态: ${douyinAuth.hasOAuthAuth}`);
      this.addLog(`前端AccessToken: ${douyinAuth._accessToken ? '已获取' : '未获取'}`);
      this.addLog(`前端权限数量: ${douyinAuth.authorizedScopes.length}`);
      
      this.addLog('=== OAuth调试完成 ===');
      
    } catch (error) {
      this.addLog(`OAuth调试失败: ${error.message}`);
      this.addLog('这通常是因为真机环境无法连接后端服务器');
      
      // 显示前端本地状态
      this.addLog('=== 显示前端本地状态 ===');
      this.addLog(`登录状态: ${douyinAuth.isLoggedIn}`);
      this.addLog(`OAuth状态: ${douyinAuth.hasOAuthAuth}`);
      this.addLog(`OpenID: ${douyinAuth.openId || '未获取'}`);
      this.addLog(`AccessToken: ${douyinAuth._accessToken ? '已获取' : '未获取'}`);
      this.addLog(`权限列表: ${JSON.stringify(douyinAuth.authorizedScopes)}`);
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
  },

  /**
   * 刷新调试信息
   */
  async refreshDebugInfo() {
    try {
      // 基础状态检查
      const basicInfo = {
        isLoggedIn: douyinAuth.isLoggedIn,
        hasOAuthAuth: douyinAuth.hasOAuthAuth,
        openId: douyinAuth.openId ? '已获取' : '未获取',
        unionId: douyinAuth.unionId ? '已获取' : '未获取',
        userInfo: douyinAuth.userInfo ? '已获取' : '未获取',
        authorizedScopes: douyinAuth.authorizedScopes || [],
        hasAccessToken: !!douyinAuth._accessToken,
        accessTokenLength: douyinAuth._accessToken ? douyinAuth._accessToken.length : 0
      };

      console.log('基础状态信息:', basicInfo);

      this.setData({
        authStatus: JSON.stringify(basicInfo, null, 2)
      });

      // 检查服务器连接
      await this.checkServerConnection();

      // 检查网络状态
      this.checkNetworkStatus();

    } catch (error) {
      console.error('刷新调试信息失败:', error);
      this.setData({
        debugInfo: `刷新失败: ${error.message}`
      });
    }
  },

  /**
   * 检查服务器连接
   */
  async checkServerConnection() {
    try {
      const result = await douyinAuth.testConnection();
      this.setData({
        serverStatus: result.success ? '✅ 服务器连接正常' : `❌ 服务器连接失败: ${result.error}`
      });
    } catch (error) {
      this.setData({
        serverStatus: `❌ 服务器连接测试失败: ${error.message}`
      });
    }
  },

  /**
   * 检查网络状态
   */
  checkNetworkStatus() {
    try {
      const systemInfo = tt.getSystemInfoSync();
      const networkInfo = {
        platform: systemInfo.platform,
        brand: systemInfo.brand,
        model: systemInfo.model,
        version: systemInfo.version,
        isDevTools: systemInfo.platform === 'devtools'
      };

      this.setData({
        networkStatus: JSON.stringify(networkInfo, null, 2)
      });
    } catch (error) {
      this.setData({
        networkStatus: `获取网络信息失败: ${error.message}`
      });
    }
  },

  /**
   * 测试OAuth授权状态
   */
  async testOAuthStatus() {
    try {
      tt.showLoading({ title: '测试中...' });

      const testResult = {
        timestamp: new Date().toISOString(),
        loginStatus: douyinAuth.isLoggedIn,
        oauthStatus: douyinAuth.hasOAuthAuth,
        accessTokenExists: !!douyinAuth._accessToken,
        scopesCount: douyinAuth.authorizedScopes.length,
        scopes: douyinAuth.authorizedScopes
      };

      // 尝试调用一个需要OAuth授权的API
      try {
        await douyinAuth._ensureValidToken();
        testResult.tokenValidation = '✅ Token验证通过';
      } catch (tokenError) {
        testResult.tokenValidation = `❌ Token验证失败: ${tokenError.message}`;
      }

      tt.hideLoading();

      this.setData({
        debugInfo: JSON.stringify(testResult, null, 2)
      });

      console.log('OAuth状态测试结果:', testResult);

    } catch (error) {
      tt.hideLoading();
      console.error('OAuth状态测试失败:', error);
      this.setData({
        debugInfo: `测试失败: ${error.message}`
      });
    }
  },

  /**
   * 清除所有数据
   */
  clearAllData() {
    tt.showModal({
      title: '确认清除',
      content: '这将清除所有登录状态和授权信息，是否继续？',
      success: (res) => {
        if (res.confirm) {
          try {
            douyinAuth.logout();
            this.refreshDebugInfo();
            tt.showToast({
              title: '已清除',
              icon: 'success'
            });
          } catch (error) {
            tt.showToast({
              title: '清除失败',
              icon: 'fail'
            });
          }
        }
      }
    });
  },

  /**
   * 复制调试信息
   */
  copyDebugInfo() {
    const allInfo = {
      authStatus: this.data.authStatus,
      serverStatus: this.data.serverStatus,
      networkStatus: this.data.networkStatus,
      debugInfo: this.data.debugInfo
    };

    const infoText = JSON.stringify(allInfo, null, 2);

    if (tt.setClipboardData) {
      tt.setClipboardData({
        data: infoText,
        success: () => {
          tt.showToast({
            title: '已复制到剪贴板',
            icon: 'success'
          });
        },
        fail: () => {
          tt.showToast({
            title: '复制失败',
            icon: 'fail'
          });
        }
      });
    } else {
      tt.showModal({
        title: '调试信息',
        content: '复制功能不可用，请手动记录信息',
        showCancel: false
      });
    }
  },

  /**
   * 返回首页
   */
  goBack() {
    tt.navigateBack({
      fail: () => {
        // 如果无法返回，则跳转到首页
        tt.redirectTo({
          url: '../index/index'
        });
      }
    });
  },

  /**
   * 测试API调用
   */
  async testAPI() {
    try {
      tt.showLoading({ title: '测试API中...' });
      
      if (!douyinAuth.hasOAuthAuth) {
        tt.hideLoading();
        tt.showModal({
          title: '提示',
          content: '请先完成OAuth授权才能测试API',
          showCancel: false
        });
        return;
      }

      // 测试获取用户视频
      const result = await douyinAuth.getUserVideos(0, 1);
      
      tt.hideLoading();
      
      this.addLog(`API测试成功: 获取到${result.data?.length || 0}条视频数据`);
      
      tt.showToast({
        title: 'API测试成功',
        icon: 'success'
      });

    } catch (error) {
      tt.hideLoading();
      console.error('API测试失败:', error);
      this.addLog(`API测试失败: ${error.message}`);
      
      tt.showToast({
        title: 'API测试失败',
        icon: 'fail'
      });
    }
  },

  /**
   * 详细的网络连接测试（新增）
   */
  async testDetailedConnection() {
    try {
      tt.showLoading({ title: '测试连接中...' });
      
      const baseUrl = 'http://kuzchat.cn:3090';
      const testResults = [];
      
      // 测试1: 基础连接测试
      testResults.push('=== 基础连接测试 ===');
      try {
        const result = await new Promise((resolve) => {
          tt.request({
            url: `${baseUrl}/health`,
            method: 'GET',
            timeout: 5000,
            success: (res) => {
              resolve({ success: true, data: res });
            },
            fail: (err) => {
              resolve({ success: false, error: err });
            }
          });
        });
        
        if (result.success) {
          testResults.push(`✅ 基础连接成功`);
          testResults.push(`状态码: ${result.data.statusCode}`);
          testResults.push(`响应: ${JSON.stringify(result.data.data).substring(0, 100)}`);
        } else {
          testResults.push(`❌ 基础连接失败`);
          testResults.push(`错误: ${result.error.errMsg}`);
          testResults.push(`错误码: ${result.error.errNo || 'N/A'}`);
        }
      } catch (error) {
        testResults.push(`❌ 基础连接异常: ${error.message}`);
      }
      
      // 测试2: code2session接口测试
      testResults.push('\n=== code2session接口测试 ===');
      try {
        const result = await new Promise((resolve) => {
          tt.request({
            url: `${baseUrl}/api/auth/code2session`,
            method: 'POST',
            data: { code: 'test_code_123' },
            timeout: 10000,
            success: (res) => {
              resolve({ success: true, data: res });
            },
            fail: (err) => {
              resolve({ success: false, error: err });
            }
          });
        });
        
        if (result.success) {
          testResults.push(`✅ code2session接口可访问`);
          testResults.push(`状态码: ${result.data.statusCode}`);
          const responseText = JSON.stringify(result.data.data).substring(0, 200);
          testResults.push(`响应: ${responseText}`);
        } else {
          testResults.push(`❌ code2session接口失败`);
          testResults.push(`错误: ${result.error.errMsg}`);
        }
      } catch (error) {
        testResults.push(`❌ code2session接口异常: ${error.message}`);
      }
      
      // 测试3: get-access-token接口测试
      testResults.push('\n=== get-access-token接口测试 ===');
      try {
        const result = await new Promise((resolve) => {
          tt.request({
            url: `${baseUrl}/api/auth/get-access-token`,
            method: 'POST',
            data: { 
              ticket: 'test_ticket_123',
              openId: 'test_openid'
            },
            timeout: 10000,
            success: (res) => {
              resolve({ success: true, data: res });
            },
            fail: (err) => {
              resolve({ success: false, error: err });
            }
          });
        });
        
        if (result.success) {
          testResults.push(`✅ get-access-token接口可访问`);
          testResults.push(`状态码: ${result.data.statusCode}`);
          const responseText = JSON.stringify(result.data.data).substring(0, 200);
          testResults.push(`响应: ${responseText}`);
        } else {
          testResults.push(`❌ get-access-token接口失败`);
          testResults.push(`错误: ${result.error.errMsg}`);
        }
      } catch (error) {
        testResults.push(`❌ get-access-token接口异常: ${error.message}`);
      }
      
      // 测试4: 系统信息
      testResults.push('\n=== 系统信息 ===');
      try {
        const systemInfo = tt.getSystemInfoSync();
        testResults.push(`平台: ${systemInfo.platform}`);
        testResults.push(`系统: ${systemInfo.system}`);
        testResults.push(`版本: ${systemInfo.version}`);
        testResults.push(`网络类型: ${systemInfo.networkType || '未知'}`);
      } catch (error) {
        testResults.push(`❌ 获取系统信息失败: ${error.message}`);
      }
      
      tt.hideLoading();
      
      // 显示测试结果
      const resultText = testResults.join('\n');
      console.log('详细连接测试结果:', resultText);
      
      tt.showModal({
        title: '网络连接测试结果',
        content: resultText.length > 500 ? resultText.substring(0, 500) + '...' : resultText,
        showCancel: true,
        confirmText: '复制结果',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            // 复制完整结果
            if (tt.setClipboardData) {
              tt.setClipboardData({
                data: resultText,
                success: () => {
                  tt.showToast({ title: '已复制', icon: 'success' });
                }
              });
            }
          }
        }
      });
      
    } catch (error) {
      tt.hideLoading();
      console.error('连接测试失败:', error);
      tt.showModal({
        title: '测试失败',
        content: `连接测试失败: ${error.message}`,
        showCancel: false
      });
    }
  }
}); 