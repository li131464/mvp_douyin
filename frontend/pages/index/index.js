const douyinAuth = require('../../utils/login');

const app = getApp()

Page({
  data: {
    openid: '',
    unionid: '',
    // 抖音登录状态
    isLogin: false,
    // 用户是否主动登录过
    hasManualLogin: false,
    // 是否已获得OAuth授权
    hasOAuthAuth: false,
    // 已授权的权限列表
    authorizedScopes: [],
    user: null,
  },

  // 页面加载状态标识
  _isLoginChecked: false,

  async onLoad() {
    console.log('Welcome to Mini Code');
    // 初始化登录状态
    await this.checkLoginStatus();
    this._isLoginChecked = true;
  },

  async onShow() {
    // 只有在页面已经加载完成后，从其他页面返回时才检查登录状态
    if (this._isLoginChecked) {
      console.log('onShow - checking login status');
      await this.checkLoginStatus();
    }
  },

  /**
   * @description: 检查登录状态并更新UI
   * @return {Promise<void>}
   */
  async checkLoginStatus() {
    try {
      // 检查是否已登录
      const isLogin = douyinAuth.isLoggedIn;
      const hasOAuthAuth = Boolean(douyinAuth.hasOAuthAuth); // 确保返回布尔值
      const authorizedScopes = douyinAuth.authorizedScopes || []; // 确保返回数组
      
      console.log('Check login status - isLogin:', isLogin, 'hasOAuthAuth:', hasOAuthAuth);
      console.log('🔍 详细OAuth状态检查:', {
        accessToken: douyinAuth._accessToken ? 'present' : 'missing',
        accessTokenLength: douyinAuth._accessToken ? douyinAuth._accessToken.length : 0,
        accessTokenPrefix: douyinAuth._accessToken ? douyinAuth._accessToken.substring(0, 8) + '...' : 'undefined',
        isMockToken: douyinAuth._accessToken ? douyinAuth._accessToken.includes('mock_access_token') : false,
        authorizedScopes: authorizedScopes,
        scopesLength: authorizedScopes.length,
        scopesType: typeof authorizedScopes,
        hasOAuthAuth: hasOAuthAuth,
        openId: douyinAuth.openId ? douyinAuth.openId.substring(0, 8) + '...' : 'undefined',
        unionId: douyinAuth.unionId ? douyinAuth.unionId.substring(0, 8) + '...' : 'undefined',
        sessionKey: douyinAuth.sessionKey ? 'present' : 'missing',
        userInfo: douyinAuth.userInfo ? 'present' : 'missing',
        timestamp: new Date().toISOString()
      });
      
      // 恢复用户主动登录状态
      const hasManualLogin = tt.getStorageSync('hasManualLogin') || false;
      
      if (isLogin) {
        // 已登录，获取用户信息
        this.setData({
          isLogin: true,
          hasManualLogin: hasManualLogin,
          hasOAuthAuth: hasOAuthAuth,
          authorizedScopes: authorizedScopes,
          openid: douyinAuth.openId,
          unionid: douyinAuth.unionId,
          user: douyinAuth.userInfo,
        });
        
        console.log('Already logged in, hasManualLogin:', hasManualLogin, 'hasOAuthAuth:', hasOAuthAuth);
        return;
      }
      
      // 未登录，重置状态
      this.setData({
        isLogin: false,
        hasManualLogin: false,
        hasOAuthAuth: false,
        authorizedScopes: [],
        openid: '',
        unionid: '',
        user: null,
      });
      
      // 清除本地存储的登录状态
      tt.removeStorageSync('hasManualLogin');
      
    } catch (err) {
      console.error('Check login status failed:', err);
      this.setData({
        isLogin: false,
        hasManualLogin: false,
        hasOAuthAuth: false,
        authorizedScopes: [],
        openid: '',
        unionid: '',
        user: null,
      });
    }
  },

  /**
   * @description: 点击事件，用户主动登录
   * @return {void}
   */
  async login() {
    try {
      console.log('=== 开始登录流程 ===');
      
      // 第一步：获取用户头像和昵称（必须在用户点击上下文中立即调用）
      console.log('第一步：获取用户头像和昵称（在用户点击上下文中）...');
      
      let userInfo = null;
      
      // 检查API是否存在
      if (typeof tt === 'undefined') {
        console.log('tt对象不存在，使用默认用户信息');
        userInfo = {
          nickName: '抖音用户',
          avatarUrl: '/icon.png'
        };
      } else if (!tt.getUserProfile) {
        console.log('tt.getUserProfile API不存在，使用默认用户信息');
        userInfo = {
          nickName: '抖音用户',
          avatarUrl: '/icon.png'
        };
      } else {
        // 立即调用tt.getUserProfile（在用户点击上下文中）
        try {
          console.log('调用tt.getUserProfile获取用户头像和昵称...');
          
          const result = await new Promise((resolve, reject) => {
            tt.getUserProfile({
              desc: '获取你的昵称、头像用于个性化展示', // 授权说明文案
              success: (res) => {
                console.log('tt.getUserProfile success:', res);
                resolve(res);
              },
              fail: (err) => {
                console.error('tt.getUserProfile fail:', err);
                reject(err);
              }
            });
          });
          
          console.log('获取用户信息成功:', result);
          
          if (result && result.userInfo) {
            userInfo = result.userInfo;
          } else {
            console.warn('获取到的结果中没有userInfo字段，使用默认信息');
            userInfo = {
              nickName: '抖音用户',
              avatarUrl: '/icon.png'
            };
          }
          
        } catch (error) {
          console.error('获取用户信息失败:', error);
          
          let errorMsg = '未知错误';
          if (error.errMsg) {
            errorMsg = error.errMsg;
          } else if (error.message) {
            errorMsg = error.message;
          }
          
          if (errorMsg.includes('cancel') || errorMsg.includes('deny')) {
            console.log('用户取消了头像昵称授权，使用默认信息');
          } else {
            console.log('其他错误，使用默认信息:', errorMsg);
          }
          
          // 使用默认用户信息
          userInfo = {
            nickName: '抖音用户',
            avatarUrl: '/icon.png'
          };
        }
      }
      
      console.log('第一步完成，用户信息:', userInfo);
      
      tt.showLoading({
        title: '正在登录...',
      });
      
      // 第二步：获取小程序登录凭证
      console.log('第二步：获取小程序登录凭证...');
      const loginResult = await new Promise((resolve, reject) => {
        tt.login({
          success: (res) => {
            console.log('📊 tt.login成功详情:', {
              code: res.code ? res.code.substring(0, 8) + '...' : 'undefined',
              codeLength: res.code ? res.code.length : 0,
              anonymousCode: res.anonymousCode ? 'present' : 'missing',
              isLogin: res.isLogin,
              errMsg: res.errMsg,
              timestamp: new Date().toISOString()
            });
            resolve(res);
          },
          fail: (err) => {
            console.error('❌ tt.login失败详情:', {
              errMsg: err.errMsg,
              errNo: err.errNo,
              timestamp: new Date().toISOString()
            });
            reject(err);
          }
        });
      });
      
      if (!loginResult.code) {
        throw new Error('获取登录凭证失败');
      }
      
      console.log('获取到临时凭证:', loginResult.code);
      
      // 第三步：调用后端API进行code2session
      console.log('第三步：调用后端进行身份验证...');
      console.log('📊 后端身份验证请求详情:', {
        code: loginResult.code ? loginResult.code.substring(0, 8) + '...' : 'undefined',
        codeLength: loginResult.code ? loginResult.code.length : 0,
        userInfoNickName: userInfo.nickName,
        userInfoAvatarUrl: userInfo.avatarUrl,
        timestamp: new Date().toISOString()
      });
      
      try {
        const sessionResult = await douyinAuth._callCode2Session(loginResult.code);
        console.log('📊 后端身份验证响应详情:', {
          success: sessionResult.success,
          openId: sessionResult.openid ? sessionResult.openid.substring(0, 8) + '...' : 'undefined',
          unionId: sessionResult.unionid ? sessionResult.unionid.substring(0, 8) + '...' : 'undefined',
          hasSessionKey: !!sessionResult.session_key,
          timestamp: new Date().toISOString()
        });
        console.log('身份验证成功:', sessionResult);
      } catch (error) {
        console.warn('❌ 后端身份验证失败，自动切换到模拟模式:', {
          errorMessage: error.message,
          errorCode: error.code,
          timestamp: new Date().toISOString()
        });
        // 不抛出错误，让登录继续进行（已经切换到模拟模式）
      }
      
      // 同步更新到douyinAuth中
      douyinAuth._userInfo = userInfo;
      douyinAuth._saveToStorage();
      
      tt.hideLoading();
      
      // 记录用户已主动登录
      tt.setStorageSync('hasManualLogin', true);
      
      this.setData({
        openid: douyinAuth.openId,
        unionid: douyinAuth.unionId,
        user: userInfo,
        isLogin: true,
        hasManualLogin: true,
      });
      
      console.log('=== 登录流程完成 ===');
      console.log('最终用户信息:', userInfo);
      
      tt.showToast({
        title: '登录成功',
        icon: 'success',
      });
      
    } catch (err) {
      console.error('Login failed:', err);
      
      tt.hideLoading();
      
      this.setData({
        isLogin: false,
        hasManualLogin: false,
      });
      
      tt.showToast({
        title: err.message || '登录失败',
        icon: 'fail',
      });
    }
  },

  /**
   * @description: OAuth授权，获取用户数据访问权限
   * @return {void}
   */
  async authorizeUserData() {
    try {
      tt.showLoading({ title: '申请权限中...' });
      
      // 申请抖音小程序数据权限 - 根据官方文档
      // ma.item.data: 近30天视频数据查询权限（小程序专用）
      // ma.user.data: 抖音主页数据权限
      // user_info: 用户基本信息权限
      const requestedScopes = [
        'ma.item.data',        // 近30天视频数据查询权限（小程序专用API）
        'ma.user.data',        // 抖音主页数据权限
        'user_info'           // 用户基本信息权限
      ];
      
      console.log('🔍 OAuth授权请求详情:', {
        requestedScopes: requestedScopes,
        scopesCount: requestedScopes.length,
        currentOAuthStatus: douyinAuth.hasOAuthAuth,
        currentScopes: douyinAuth.authorizedScopes || [],
        hasAccessToken: !!douyinAuth._accessToken,
        timestamp: new Date().toISOString()
      });
      
      const result = await douyinAuth.authorizeWithScopes(requestedScopes);
      
      tt.hideLoading();
      
      if (result.success) {
        console.log('✅ OAuth授权成功，详细结果:', {
          success: result.success,
          hasAccessToken: !!result.accessToken,
          accessTokenLength: result.accessToken ? result.accessToken.length : 0,
          accessTokenPrefix: result.accessToken ? result.accessToken.substring(0, 8) + '...' : 'undefined',
          isMockToken: result.accessToken ? result.accessToken.includes('mock_access_token') : false,
          authorizedScopes: result.authorizedScopes || [],
          scopesCount: result.authorizedScopes ? result.authorizedScopes.length : 0,
          fallbackMode: result.fallbackMode || false,
          isRealData: result.isRealData || false,
          message: result.message,
          timestamp: new Date().toISOString()
        });
        
        // 等待一小段时间确保状态保存完成
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 获取最新的OAuth状态，确保与底层对象同步
        const hasOAuthAuth = douyinAuth.hasOAuthAuth;
        const authorizedScopes = douyinAuth.authorizedScopes || [];
        const hasAccessToken = !!douyinAuth._accessToken;
        
        console.log('授权完成后状态更新:', {
          hasOAuthAuth,
          authorizedScopes,
          hasAccessToken,
          accessTokenLength: douyinAuth._accessToken ? douyinAuth._accessToken.length : 0,
          result,
          isFallback: result.fallbackMode || false
        });
        
        // 更新页面状态
        this.setData({
          hasOAuthAuth: hasOAuthAuth,
          authorizedScopes: authorizedScopes
        });
        
        // 根据是否为模拟模式显示不同的提示
        if (result.fallbackMode) {
          tt.showModal({
            title: '权限获取成功',
            content: `已成功获取抖音数据访问权限！\n\n⚠️ 检测到网络连接问题，已自动启用演示模式。\n\n✅ 当前状态：\n• 权限范围：${authorizedScopes.join(', ')}\n• 访问令牌：已生成\n• 功能状态：完全可用\n\n您现在可以查看功能演示和使用模拟数据。`,
            showCancel: false,
            confirmText: '开始使用'
          });
        } else {
          tt.showModal({
            title: '授权成功',
            content: `已成功获取抖音数据访问权限！\n\n✅ 权限范围：${authorizedScopes.join(', ')}\n✅ 访问令牌：已获取\n✅ 数据来源：${result.isRealData ? '真实API' : '演示模式'}\n\n您现在可以查看和分析您的抖音数据。`,
            showCancel: false,
            confirmText: '开始使用'
          });
        }
      }
    } catch (error) {
      tt.hideLoading();
      console.error('授权失败:', error);
      
      let errorContent = error.message || '无法获取数据访问权限';
      
      // 针对不同错误类型的特殊处理
      if (errorContent.includes('用户取消')) {
        tt.showModal({
          title: '授权被取消',
          content: '您取消了数据权限授权，无法获取您的抖音数据。如需使用完整功能，请重新进行授权。',
          showCancel: false,
          confirmText: '我知道了'
        });
      } else if (errorContent.includes('网络连接') || errorContent.includes('localhost')) {
        // 网络连接失败，可能是真机环境
        console.log('网络连接失败，可能是真机环境无法访问localhost');
        
        // 禁止使用模拟授权，直接显示网络错误
        console.log('网络连接失败，模拟授权已被禁用');
        
        tt.showModal({
          title: '网络连接失败',
          content: '无法连接到授权服务器，可能的原因：\n\n1. 真机环境无法访问localhost\n2. 网络连接不稳定\n3. 服务器未启动\n\n请检查网络连接或联系技术支持。',
          showCancel: false,
          confirmText: '我知道了'
        });
      } else {
        // 其他错误
        tt.showModal({
          title: '授权失败',
          content: errorContent,
          showCancel: false
        });
      }
    }
  },

  /**
   * @description: 加载用户数据（示例）
   * @return {void}
   */
  async loadUserData() {
    try {
      console.log('Loading user data samples...');
      
      // 获取少量示例数据用于展示
      const [videoResult, commentResult, messageResult] = await Promise.all([
        douyinAuth.getUserVideos(0, 3),
        douyinAuth.getUserComments(0, 3),
        douyinAuth.getUserMessages(0, 3)
      ]);
      
      console.log('Sample data loaded:', {
        videos: videoResult.data?.length || 0,
        comments: commentResult.data?.length || 0,
        messages: messageResult.data?.length || 0
      });
      
      tt.showToast({
        title: '数据预览加载完成',
        icon: 'success',
      });
    } catch (err) {
      console.error('Load user data failed:', err);
      tt.showToast({
        title: '数据加载失败',
        icon: 'fail',
      });
    }
  },

  /**
   * @description: 获取用户头像和昵称
   * @return {Promise<void>}
   */
  async getUserProfile() {
    try {
      // 先检查是否已登录
      if (!this.data.isLogin) {
        tt.showToast({
          title: '请先登录',
          icon: 'none',
        });
        return;
      }

      tt.showLoading({
        title: '获取用户信息...',
      });

      console.log('开始获取用户头像和昵称...');
      
      // 调用抖音小程序API获取用户头像和昵称
      const result = await new Promise((resolve, reject) => {
        tt.getUserProfile({
          desc: '获取你的昵称、头像用于个性化展示', // 授权说明文案
          success: resolve,
          fail: reject
        });
      });

      console.log('获取用户信息成功:', result);

      // 更新登录工具类中的用户信息
      if (result.userInfo) {
        douyinAuth._userInfo = result.userInfo;
        douyinAuth._saveToStorage();
      }

      this.setData({
        user: result.userInfo,
      });

      tt.showToast({
        title: '获取成功',
        icon: 'success',
      });
    } catch (err) {
      console.error('Get user profile failed:', err);
      
      const errorMsg = err.errMsg || '获取用户信息失败';
      
      if (errorMsg.includes('cancel') || errorMsg.includes('deny')) {
        tt.showModal({
          title: '授权被取消',
          content: '获取头像和昵称被取消，将使用默认信息显示',
          showCancel: false,
        });
      } else if (errorMsg.includes('privacy')) {
        tt.showModal({
          title: '权限配置',
          content: '获取用户信息需要在隐私协议中声明权限，请查看隐私政策页面。',
          showCancel: false,
        });
      } else {
        tt.showToast({
          title: '获取用户信息失败',
          icon: 'fail',
        });
      }
    } finally {
      tt.hideLoading();
    }
  },

  /**
   * @description: 查看已授权的权限
   * @return {void}
   */
  viewAuthorizedScopes() {
    const scopes = this.data.authorizedScopes;
    if (scopes.length === 0) {
      tt.showToast({
        title: '暂无授权权限',
        icon: 'none',
      });
      return;
    }

    const scopeNames = {
      'user_info': '用户基本信息',
      'video.list': '视频列表访问',
      'comment.list': '评论列表访问',
      'message.list': '私信列表访问'
    };

    const authorizedList = scopes.map(scope => scopeNames[scope] || scope).join('\n');
    
    tt.showModal({
      title: '已授权权限',
      content: authorizedList,
      showCancel: false,
      confirmText: '确定',
    });
  },

  /**
   * @description: 跳转到用户数据页面
   * @return {void}
   */
  goToUserData() {
    if (!this.data.hasOAuthAuth) {
      tt.showToast({
        title: '请先完成OAuth授权',
        icon: 'none',
      });
      return;
    }
    
    tt.navigateTo({ 
      url: "../user-data/user-data" 
    });
  },

  /**
   * @description: 跳转到隐私政策页面
   * @return {void}
   */
  goToPrivacy() {
    tt.navigateTo({ url: "../privacy/privacy" });
  },

  /**
   * @description: 跳转到调试工具页面
   * @return {void}
   */
  goToDebug() {
    tt.navigateTo({ url: "../debug/debug" });
  },

  /**
   * @description: 登出
   * @return {void}
   */
  async logout() {
    try {
      douyinAuth.logout();
      // 清除app中的用户信息
      app.userInfo = null;
      // 清除主动登录标记
      tt.removeStorageSync('hasManualLogin');
      
      this.setData({
        openid: '',
        unionid: '',
        user: null,
        isLogin: false,
        hasManualLogin: false,
        hasOAuthAuth: false,
        authorizedScopes: [],
      });
      tt.showToast({
        title: '已退出登录',
        icon: 'success',
      });
    } catch (err) {
      console.error('Logout failed:', err);
      tt.showToast({
        title: '退出登录失败',
        icon: 'fail',
      });
    }
  },

  /**
   * @description: 隐私授权同意处理
   */
  onPrivacyAgree(e) {
    console.log('✅ 用户同意隐私授权:', e.detail);
    
    // 用户同意隐私授权后，可以继续执行相关的隐私接口调用
    tt.showToast({
      title: '隐私授权成功',
      icon: 'success',
      duration: 2000
    });
    
    // 记录隐私授权状态
    tt.setStorageSync('privacyAuthorized', {
      authorized: true,
      timestamp: Date.now()
    });
  },

  /**
   * @description: 隐私授权拒绝处理
   */
  onPrivacyDisagree(e) {
    console.log('❌ 用户拒绝隐私授权:', e.detail);
    
    tt.showModal({
      title: '权限被拒绝',
      content: '为了使用完整功能，需要您同意隐私协议。您可以重新点击相关功能按钮再次授权。',
      showCancel: false,
      confirmText: '我知道了'
    });
    
    // 记录隐私拒绝状态
    tt.setStorageSync('privacyAuthorized', {
      authorized: false,
      timestamp: Date.now()
    });
  },

});
