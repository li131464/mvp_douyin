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
      const hasOAuthAuth = douyinAuth.hasOAuthAuth;
      const authorizedScopes = douyinAuth.authorizedScopes;
      
      console.log('Check login status - isLogin:', isLogin, 'hasOAuthAuth:', hasOAuthAuth);
      
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
      tt.showLoading({
        title: '正在登录...',
      });
      
      const loginResult = await douyinAuth.login();
      console.log('Manual login result:', loginResult);
      
      if (loginResult.success) {
        // 记录用户已主动登录
        tt.setStorageSync('hasManualLogin', true);
        
        this.setData({
          openid: loginResult.openId,
          unionid: loginResult.unionId,
          user: loginResult.userInfo,
          isLogin: true,
          hasManualLogin: true,
        });
        
        tt.showToast({
          title: '登录成功',
          icon: 'success',
        });
      } else {
        this.setData({
          isLogin: false,
          hasManualLogin: false,
        });
        tt.showToast({
          title: '登录失败',
          icon: 'fail',
        });
      }
    } catch (err) {
      console.error('Login failed:', err);
      this.setData({
        isLogin: false,
        hasManualLogin: false,
      });
      tt.showToast({
        title: err.message || '登录失败',
        icon: 'fail',
      });
    } finally {
      tt.hideLoading();
    }
  },

  /**
   * @description: OAuth授权，获取用户数据访问权限
   * @return {void}
   */
  async authorizeUserData() {
    try {
      tt.showLoading({ title: '申请权限中...' });
      
      // 申请抖音数据权限
      const result = await douyinAuth.authorizeWithScopes([
        'ma.user.data' // 抖音主页数据权限（包含近30天视频数据查询）
      ]);
      
      tt.hideLoading();
      
      if (result.success) {
        tt.showToast({
          title: '授权成功',
          icon: 'success'
        });
        
        this.setData({
          hasOAuthAuth: true,
          authorizedScopes: result.scopes
        });
      }
    } catch (error) {
      tt.hideLoading();
      console.error('授权失败:', error);
      
      tt.showModal({
        title: '授权失败',
        content: error.message || '无法获取数据访问权限',
        showCancel: false
      });
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
   * @description: 获取用户数据
   * @return {Promise<void>}
   */
  async getUserProfile() {
    try {
      // 先检查是否已登录且用户已主动登录
      if (!this.data.isLogin || !this.data.hasManualLogin) {
        tt.showToast({
          title: '请先登录',
          icon: 'none',
        });
        return;
      }

      const user = await app.getUserProfile();
      this.setData({
        user,
      });
      tt.showToast({
        title: '获取成功',
        icon: 'success',
      });
    } catch (err) {
      console.error('Get user profile failed:', err);
      const errorMsg = err.errMsg || '获取用户信息失败';
      
      if (errorMsg.includes('privacy agreement')) {
        tt.showModal({
          title: '权限不足',
          content: '获取用户信息需要在隐私协议中声明权限，请联系开发者配置相关权限。',
          showCancel: false,
        });
      } else {
        tt.showToast({
          title: '获取用户信息失败',
          icon: 'fail',
        });
      }
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
});
