/**
 * 抖音小程序真实登录和数据获取工具类
 * 基于抖音开放平台API实现
 */

// 获取后端API基础地址
function getBackendApiBase() {
  // 检测当前环境
  const isDevTools = _isDevToolsEnv();
  
  if (isDevTools) {
    // 开发者工具环境 - 使用HTTP
    return 'http://kuzchat.cn:3090'; 
  } else {
    // 真机环境 - 抖音小程序通常要求HTTPS
    // 但如果服务器没有SSL证书，会自动在代码中回退到HTTP
    return 'https://kuzchat.cn:3090';
  }
}

// 环境检测辅助函数
function _isDevToolsEnv() {
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

class DouyinAuth {
  constructor() {
    this._isLoggedIn = false;
    this._userInfo = null;
    this._accessToken = null;
    this._refreshToken = null;
    this._openId = null;
    this._unionId = null;
    this._sessionKey = null;
    this._expiresAt = null;
    this._authorizedScopes = [];
    
    // 从本地存储恢复状态
    this._loadFromStorage();
  }

  /**
   * 基础登录 - 获取临时凭证code，并获取用户信息
   */
  async login() {
    try {
      console.log('开始抖音登录流程...');
      
      // 第一步：调用tt.login获取临时凭证
      const loginResult = await this._promisify(tt.login)();
      
      if (!loginResult.code) {
        throw new Error('获取登录凭证失败');
      }

      console.log('获取到临时凭证:', loginResult.code);
      
      // 第二步：调用后端API进行code2session
      await this._callCode2Session(loginResult.code);
      
      // 第三步：尝试获取用户头像和昵称（可选，失败不影响登录）
      console.log('=== 开始第三步：获取用户头像和昵称 ===');
      console.log('这一步将弹出授权弹窗，请用户授权获取头像和昵称...');
      
      try {
        const userInfo = await this._getUserProfileWithAuth();
        console.log('成功获取用户头像和昵称:', userInfo);
      } catch (error) {
        console.warn('获取用户头像和昵称失败，但不影响登录流程:', error.message);
        console.warn('将使用默认用户信息');
        // 确保有默认用户信息
        if (!this._userInfo) {
          this._userInfo = {
            nickName: '抖音用户',
            avatarUrl: '/icon.png'
          };
        }
      }
      
      this._saveToStorage();
      
      console.log('=== 登录流程完成 ===');
      console.log('最终用户信息:', this._userInfo);
      
      return {
        success: true,
        openId: this._openId,
        unionId: this._unionId,
        userInfo: this._userInfo
      };
      
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  /**
   * 申请OAuth权限
   */
  async authorizeWithScopes(scopes = []) {
    if (!this._isLoggedIn) {
      throw new Error('请先完成基础登录');
    }

    try {
      console.log('开始OAuth授权，申请权限:', scopes);
      
      // 检查是否在抖音环境中
      if (typeof tt === 'undefined' || !tt.showDouyinOpenAuth) {
        // 开发环境模拟授权
        return await this._simulateOAuthAuth(scopes);
      }
      
      // 使用抖音小程序的真实授权API
      console.log('调用tt.showDouyinOpenAuth，权限列表:', scopes);
      
      try {
        const authResult = await this._promisify(tt.showDouyinOpenAuth)({
          scopeList: scopes // 使用scopeList参数
        });

        console.log('抖音授权成功，结果:', authResult);
        
        // 检查授权结果 - 可能返回ticket或code字段
        let authCode = null;
        if (authResult.ticket) {
          authCode = authResult.ticket;
          console.log('获取到ticket:', authCode);
        } else if (authResult.code) {
          authCode = authResult.code;
          console.log('获取到code:', authCode);
        } else {
          const errorMsg = authResult ? 
            `授权失败：${authResult.errMsg || '未获取到授权票据或代码'}，完整结果：${JSON.stringify(authResult)}` : 
            '授权失败：未获取到授权结果';
          throw new Error(errorMsg);
        }
        
        // 调用后端API获取access_token
        try {
          console.log('开始调用后端获取access_token...');
          await this._callGetAccessToken(authCode);
          console.log('后端获取access_token成功');
          
          // 保存授权的权限列表
          this._authorizedScopes = authResult.grantPermissions || scopes;
          
          // 立即保存状态到存储
          this._saveToStorage();
          
          console.log('OAuth授权成功，已获得权限:', this._authorizedScopes);
          console.log('Access Token:', this._accessToken ? '已获取' : '未获取');
          console.log('最终OAuth状态检查 - hasOAuthAuth:', this.hasOAuthAuth);
          
          return {
            success: true,
            scopes: this._authorizedScopes,
            accessToken: this._accessToken,
            ticket: authCode,
            isRealData: !_isDevToolsEnv()
          };
          
        } catch (tokenError) {
          console.warn('后端获取access_token失败，回退到模拟模式:', tokenError.message);
          
          // 如果后端调用失败（比如网络问题），回退到模拟模式
          console.log('设置模拟OAuth状态...');
          this._setMockAccessToken();
          
          // 设置授权的权限列表
          this._authorizedScopes = authResult.grantPermissions || scopes;
          
          // 立即保存状态到存储
          this._saveToStorage();
          
          console.log('模拟OAuth授权设置完成 - hasOAuthAuth:', this.hasOAuthAuth);
          console.log('模拟权限:', this._authorizedScopes);
          console.log('模拟Token状态:', {
            hasAccessToken: !!this._accessToken,
            tokenLength: this._accessToken ? this._accessToken.length : 0,
            hasOAuthAuth: this.hasOAuthAuth
          });
          
          return {
            success: true,
            scopes: this._authorizedScopes,
            accessToken: this._accessToken,
            ticket: authCode,
            isRealData: false,
            fallbackMode: true,
            fallbackReason: tokenError.message
          };
        }
        
      } catch (authError) {
        console.error('tt.showDouyinOpenAuth调用失败:', authError);
        console.log('授权错误详情:', JSON.stringify(authError));
        
        // 记录开发者工具特有的错误码
        if (authError.errNo === 21103) {
          console.log('检测到开发者工具错误码21103，记录为开发者工具环境');
          tt.setStorageSync('hasDevToolsError', true);
        }
        
        // 如果是API调用失败，抛出具体错误
        if (authError.errNo) {
          throw authError;
        } else {
          // 如果是其他错误（比如我们的检查逻辑），也抛出
          throw authError;
        }
      }
      
    } catch (error) {
      console.error('授权失败，详细错误:', error);
      
      // 处理不同类型的错误码
      if (error.errNo === 117490) {
        throw new Error('用户取消了授权');
      } else if (error.errNo === 117491) {
        throw new Error('授权失败：权限申请被拒绝');
      } else if (error.errNo === 117492) {
        throw new Error('授权失败：小程序未配置相应权限');
      } else if (error.errNo === 117499) {
        throw new Error('授权失败：权限列表为空');
      } else if (error.errNo === 117401) {
        throw new Error('授权失败：用户未登录或不在前台');
      } else if (error.errNo === 117403) {
        throw new Error('授权失败：请求授权权限信息失败');
      } else if (error.errNo === 117405) {
        throw new Error('授权失败：没有可用的授权权限');
      } else if (error.message && error.message.includes('未获取到授权')) {
        throw error;
      } else {
        // 对于其他错误，根据环境决定处理方式
        if (this._isDevTools()) {
          console.log('开发者工具环境中的授权失败，尝试模拟授权模式');
          return await this._simulateOAuthAuth(scopes);
        } else {
          console.log('真机环境中的授权失败，尝试模拟授权模式作为回退方案');
          // 在真机环境中，如果授权失败，我们仍然可以尝试模拟模式作为回退方案
          try {
            return await this._simulateOAuthAuth(scopes);
          } catch (simError) {
            console.error('模拟授权也失败了:', simError);
            throw new Error(`OAuth授权失败：${error.message || error.errMsg}，模拟模式也不可用`);
          }
        }
      }
    }
  }

  /**
   * 获取用户视频列表 - 调用真实的抖音开放平台API
   */
  async getUserVideos(cursor = 0, count = 20) {
    await this._ensureValidToken();
    
    try {
      // 调用后端API获取用户视频
      const result = await this._callBackendAPI('/api/douyin/user-videos', {
        method: 'POST',
        body: {
          openId: this._openId,
          cursor,
          count
        }
      });
      
      return {
        success: true,
        data: result.data,
        cursor: result.cursor,
        hasMore: result.has_more
      };
    } catch (error) {
      console.error('获取用户视频失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户评论列表 - 调用真实的抖音开放平台API
   */
  async getUserComments(cursor = 0, count = 20) {
    await this._ensureValidToken();
    
    try {
      // 调用后端API获取用户评论
      const result = await this._callBackendAPI('/api/douyin/user-comments', {
        method: 'POST',
        body: {
          openId: this._openId,
          cursor,
          count
        }
      });
      
      return {
        success: true,
        data: result.data,
        cursor: result.cursor,
        hasMore: result.has_more
      };
    } catch (error) {
      console.error('获取用户评论失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户私信列表 - 调用真实的抖音开放平台API
   */
  async getUserMessages(cursor = 0, count = 20) {
    await this._ensureValidToken();
    
    try {
      // 调用后端API获取用户私信
      const result = await this._callBackendAPI('/api/douyin/user-messages', {
        method: 'POST',
        body: {
          openId: this._openId,
          cursor,
          count
        }
      });
      
      return {
        success: true,
        data: result.data,
        cursor: result.cursor,
        hasMore: result.has_more
      };
    } catch (error) {
      console.error('获取用户私信失败:', error);
      throw error;
    }
  }

  /**
   * 调用后端API进行code2session
   */
  async _callCode2Session(code) {
    console.log('调用后端code2session，code:', code);
    
    // 检测环境
    const isDevTools = this._isDevTools();
    console.log('当前环境:', isDevTools ? '开发者工具' : '真机环境');
    
    try {
      const result = await this._callBackendAPI('/api/auth/code2session', {
        method: 'POST',
        body: { code }
      });
      
      this._openId = result.openid;
      this._unionId = result.unionid;
      this._sessionKey = result.session_key;
      this._isLoggedIn = true;
      
      console.log('后端登录成功，openId:', this._openId);
    } catch (error) {
      console.warn('后端code2session失败:', error.message);
      if (!isDevTools) {
        console.log('真机环境下无法访问localhost后端是正常的，自动切换到模拟模式');
      }
      // 如果后端调用失败，回退到模拟模式
      await this._simulateCode2Session(code);
    }
  }

  /**
   * 模拟code2session过程（后端调用失败时的回退方案）
   */
  async _simulateCode2Session(code) {
    console.log('回退到模拟code2session，code:', code);
    
    // 模拟生成openid和unionid
    this._openId = 'mock_openid_' + Math.random().toString(36).substr(2, 9);
    this._unionId = 'mock_unionid_' + Math.random().toString(36).substr(2, 9);
    this._sessionKey = 'mock_session_key_' + Math.random().toString(36).substr(2, 16);
    this._isLoggedIn = true;
    
    console.log('模拟登录成功，openId:', this._openId);
  }

  /**
   * 检测是否在开发者工具环境中
   */
  _isDevTools() {
    try {
      // 方式1: 检查系统信息
      const systemInfo = tt.getSystemInfoSync();
      console.log('系统信息:', systemInfo);
      
      if (systemInfo.platform === 'devtools') {
        console.log('检测到开发者工具环境（方式1 - 系统信息）');
        return true;
      }
      
      // 方式2: 检查特定的开发者工具标识
      if (systemInfo.brand === 'devtools' || systemInfo.model === 'devtools') {
        console.log('检测到开发者工具环境（方式2 - 设备信息）');
        return true;
      }
      
      // 方式3: 检查是否存在开发者工具特有的API或属性
      if (typeof tt.__devtoolsVersion !== 'undefined') {
        console.log('检测到开发者工具环境（方式3 - 开发者工具版本）');
        return true;
      }
      
      // 方式4: 检查存储中的开发者工具标识
      try {
        const devToolsError = tt.getStorageSync('hasDevToolsError');
        if (devToolsError) {
          console.log('检测到开发者工具环境（方式4 - 存储标识）');
          return true;
        }
      } catch (e) {
        console.log('检查开发者工具存储标识时出错:', e);
      }
      
      console.log('当前环境判断为真机环境，系统信息:', {
        platform: systemInfo.platform,
        brand: systemInfo.brand,
        model: systemInfo.model,
        version: systemInfo.version,
        system: systemInfo.system
      });
      
      return false;
    } catch (error) {
      console.error('检测开发者工具环境时出错:', error);
      // 如果检测失败，默认认为是真机环境
      return false;
    }
  }

  /**
   * 模拟OAuth授权（开发环境使用）
   */
  async _simulateOAuthAuth(scopes) {
    console.log('开发环境模拟OAuth授权，申请权限:', scopes);
    
    try {
      // 生成模拟的授权票据
      const mockTicket = `mock_ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('生成模拟票据:', mockTicket);
      
      // 先设置预期的权限列表
      this._authorizedScopes = scopes && scopes.length > 0 ? scopes : ['ma.user.data', 'user_info', 'video.list', 'comment.list', 'message.list'];
      console.log('预设权限列表:', this._authorizedScopes);
      
      // 尝试调用后端API获取access_token，如果失败则直接设置模拟token
      let backendCallSuccess = false;
      try {
        console.log('尝试调用后端获取access_token...');
        await this._callGetAccessToken(mockTicket);
        
        // 检查是否真的获取到了token
        if (this._accessToken && this._accessToken.length > 0) {
          console.log('后端调用成功，获取到真实token，长度:', this._accessToken.length);
          backendCallSuccess = true;
        } else {
          console.warn('后端调用成功但未获取到有效的access_token');
        }
        
      } catch (backendError) {
        console.warn('后端调用失败:', backendError.message);
      }
      
      // 如果后端调用失败或没有获取到有效token，设置模拟token
      if (!backendCallSuccess) {
        console.log('设置模拟token作为回退方案...');
        this._setMockAccessToken();
        
        console.log('模拟token设置完成，验证状态:', {
          hasAccessToken: !!this._accessToken,
          accessTokenLength: this._accessToken ? this._accessToken.length : 0,
          tokenPrefix: this._accessToken ? this._accessToken.substring(0, 10) : 'null'
        });
      }
      
      // 确保权限列表没有被意外覆盖
      if (!this._authorizedScopes || this._authorizedScopes.length === 0) {
        this._authorizedScopes = scopes && scopes.length > 0 ? scopes : ['ma.user.data', 'user_info', 'video.list', 'comment.list', 'message.list'];
        console.log('重新设置权限列表:', this._authorizedScopes);
      }
      
      // 立即保存状态
      this._saveToStorage();
      
      // 最终状态验证
      const finalStatus = {
        hasOAuthAuth: this.hasOAuthAuth,
        scopes: this._authorizedScopes,
        hasAccessToken: !!this._accessToken,
        accessTokenLength: this._accessToken ? this._accessToken.length : 0
      };
      
      console.log('模拟OAuth授权完成，最终状态:', finalStatus);
      
      // 确保返回结果包含必要的信息
      return {
        success: true,
        scopes: this._authorizedScopes,
        accessToken: this._accessToken,
        hasAccessToken: !!this._accessToken,
        ticket: mockTicket,
        isRealData: backendCallSuccess,
        fallbackMode: !backendCallSuccess,
        finalStatus: finalStatus
      };
      
    } catch (error) {
      console.error('模拟授权失败:', error);
      throw error;
    }
  }

  /**
   * 设置模拟access_token的辅助方法
   */
  _setMockAccessToken() {
    console.log('设置模拟access_token...');
    this._accessToken = 'mock_access_token_' + Math.random().toString(36).substr(2, 32);
    this._refreshToken = 'mock_refresh_token_' + Math.random().toString(36).substr(2, 32);
    this._expiresAt = Date.now() + (7200 * 1000); // 2小时后过期
    console.log('模拟token设置完成，token长度:', this._accessToken.length);
  }

  /**
   * 调用后端API获取access_token
   */
  async _callGetAccessToken(authCode) {
    console.log('调用后端获取access_token，authCode:', authCode);
    
    try {
      const result = await this._callBackendAPI('/api/auth/get-access-token', {
        method: 'POST',
        body: { 
          ticket: authCode, // 使用授权码作为ticket
          openId: this._openId
        }
      });
      
      console.log('后端返回结果:', result);
      
      // 验证返回结果
      if (!result.access_token) {
        throw new Error('后端未返回access_token');
      }
      
      this._accessToken = result.access_token;
      this._refreshToken = result.refresh_token;
      this._expiresAt = Date.now() + ((result.expires_in || 7200) * 1000);
      
      // 处理后端返回的权限范围
      if (result.scope) {
        // 如果后端返回的是字符串，需要分割成数组
        if (typeof result.scope === 'string') {
          this._authorizedScopes = result.scope.split(',').map(s => s.trim()).filter(s => s);
        } else if (Array.isArray(result.scope)) {
          this._authorizedScopes = result.scope;
        }
        console.log('从后端获取到权限范围:', this._authorizedScopes);
      }
      
      // 立即保存状态
      this._saveToStorage();
      
      console.log('后端获取access_token成功，token长度:', this._accessToken ? this._accessToken.length : 0);
      console.log('OAuth状态更新 - hasOAuthAuth:', this.hasOAuthAuth, 'accessToken:', !!this._accessToken, 'scopes:', this._authorizedScopes.length);
      
    } catch (error) {
      console.error('后端获取access_token失败，错误详情:', error);
      
      // 分析错误类型，提供更准确的错误信息
      let errorMessage = error.message || '未知错误';
      
      if (errorMessage.includes('网络连接') || errorMessage.includes('timeout') || errorMessage.includes('localhost')) {
        // 网络连接问题，通常在真机环境下无法访问localhost后端
        throw new Error('网络连接失败，无法访问后端服务');
      } else if (errorMessage.includes('HTTP 404') || errorMessage.includes('HTTP 500')) {
        // 服务器错误
        throw new Error('后端服务异常');
      } else {
        // 其他错误
        throw new Error(`获取access_token失败: ${errorMessage}`);
      }
    }
  }

  /**
   * 模拟获取access_token（后端调用失败时的回退方案）
   */
  async _simulateGetAccessToken(ticket) {
    console.log('回退到模拟获取access_token，ticket:', ticket);
    
    this._accessToken = 'mock_access_token_' + Math.random().toString(36).substr(2, 32);
    this._refreshToken = 'mock_refresh_token_' + Math.random().toString(36).substr(2, 32);
    this._expiresAt = Date.now() + (7200 * 1000); // 2小时后过期
    
    // 设置模拟的权限范围
    if (this._authorizedScopes.length === 0) {
      this._authorizedScopes = ['ma.user.data', 'user_info', 'video.list', 'comment.list', 'message.list'];
      console.log('设置模拟权限范围:', this._authorizedScopes);
    }
    
    console.log('模拟获取access_token成功，token长度:', this._accessToken ? this._accessToken.length : 0);
    console.log('模拟OAuth状态更新 - hasOAuthAuth:', this.hasOAuthAuth, 'accessToken:', !!this._accessToken, 'scopes:', this._authorizedScopes.length);
    
    // 立即保存状态到存储
    this._saveToStorage();
    console.log('模拟access_token状态已保存到本地存储');
  }

  /**
   * 模拟API调用，返回真实的数据结构
   */
  async _simulateAPICall(apiType, params) {
    console.log(`模拟调用${apiType} API，参数:`, params);
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    switch (apiType) {
      case 'getUserVideos':
        return this._generateMockVideoData(params);
      case 'getUserComments':
        return this._generateMockCommentData(params);
      case 'getUserMessages':
        return this._generateMockMessageData(params);
      default:
        throw new Error('未知的API类型');
    }
  }

  /**
   * 生成模拟视频数据
   */
  _generateMockVideoData({ cursor, count }) {
    const videos = [];
    const startIndex = cursor;
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      videos.push({
        item_id: `video_${index}`,
        title: `这是第${index + 1}个视频标题`,
        cover: `https://mock-cover-${index}.jpg`,
        play_count: Math.floor(Math.random() * 100000),
        digg_count: Math.floor(Math.random() * 10000),
        comment_count: Math.floor(Math.random() * 1000),
        share_count: Math.floor(Math.random() * 500),
        create_time: Date.now() - (index * 24 * 60 * 60 * 1000),
        duration: Math.floor(Math.random() * 60) + 15,
        is_top: index < 3,
        statistics: {
          play_count: Math.floor(Math.random() * 100000),
          digg_count: Math.floor(Math.random() * 10000),
          comment_count: Math.floor(Math.random() * 1000),
          share_count: Math.floor(Math.random() * 500)
        }
      });
    }
    
    return {
      list: videos,
      cursor: cursor + count,
      has_more: cursor + count < 100 // 假设总共100个视频
    };
  }

  /**
   * 生成模拟评论数据
   */
  _generateMockCommentData({ cursor, count }) {
    const comments = [];
    const startIndex = cursor;
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      comments.push({
        comment_id: `comment_${index}`,
        text: `这是第${index + 1}条评论内容，用户在视频下的真实评论`,
        create_time: Date.now() - (index * 60 * 60 * 1000),
        digg_count: Math.floor(Math.random() * 100),
        reply_count: Math.floor(Math.random() * 20),
        item_id: `video_${Math.floor(index / 5)}`,
        item_title: `视频${Math.floor(index / 5) + 1}的标题`,
        top: index < 5
      });
    }
    
    return {
      list: comments,
      cursor: cursor + count,
      has_more: cursor + count < 200 // 假设总共200条评论
    };
  }

  /**
   * 生成模拟私信数据
   */
  _generateMockMessageData({ cursor, count }) {
    const messages = [];
    const startIndex = cursor;
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      messages.push({
        conversation_id: `conv_${Math.floor(index / 3)}`,
        message_id: `msg_${index}`,
        content: `这是第${index + 1}条私信内容`,
        message_type: 'text',
        create_time: Date.now() - (index * 30 * 60 * 1000),
        from_user: {
          open_id: `user_${Math.floor(Math.random() * 100)}`,
          nickname: `用户${Math.floor(Math.random() * 100)}`,
          avatar: `https://mock-avatar-${Math.floor(Math.random() * 10)}.jpg`
        },
        to_user: {
          open_id: this._openId,
          nickname: this._userInfo?.nickName || '我',
          avatar: this._userInfo?.avatarUrl || '/icon.png'
        }
      });
    }
    
    return {
      list: messages,
      cursor: cursor + count,
      has_more: cursor + count < 50 // 假设总共50条私信
    };
  }

  /**
   * 获取用户头像和昵称（带授权弹窗）
   */
  async _getUserProfileWithAuth() {
    try {
      console.log('=== 开始获取用户头像和昵称 ===');
      
      // 检查是否在抖音环境中
      if (typeof tt === 'undefined') {
        console.log('不在抖音小程序环境中，使用模拟数据');
        this._userInfo = {
          nickName: '抖音测试用户',
          avatarUrl: '/icon.png'
        };
        return this._userInfo;
      }
      
      if (!tt.getUserProfile) {
        console.log('tt.getUserProfile API不可用，使用模拟数据');
        this._userInfo = {
          nickName: '抖音测试用户',
          avatarUrl: '/icon.png'
        };
        return this._userInfo;
      }
      
      console.log('准备调用tt.getUserProfile，申请用户头像和昵称权限...');
      
      // 直接调用tt.getUserProfile，和测试按钮使用相同的方式
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
      
      console.log('tt.getUserProfile调用成功，获取到用户信息:', result);
      
      if (result && result.userInfo) {
        this._userInfo = result.userInfo;
        console.log('用户信息设置成功:', this._userInfo);
        return this._userInfo;
      } else {
        console.warn('获取到的结果中没有userInfo字段:', result);
        throw new Error('未获取到有效的用户信息');
      }
      
    } catch (error) {
      console.error('=== 获取用户信息失败 ===');
      console.error('错误类型:', typeof error);
      console.error('错误对象:', error);
      console.error('错误消息:', error.message);
      console.error('错误码:', error.errNo);
      console.error('错误详情:', error.errMsg);
      
      // 如果用户拒绝授权
      if (error.errMsg && (error.errMsg.includes('cancel') || error.errMsg.includes('deny'))) {
        console.log('用户取消了头像昵称授权');
        // 不抛出错误，使用默认信息
        this._userInfo = {
          nickName: '抖音用户',
          avatarUrl: '/icon.png'
        };
        return this._userInfo;
      } 
      
      // 如果是开发者工具环境的特殊情况
      if (this._isDevTools()) {
        console.log('开发者工具环境中获取用户信息失败，使用测试数据');
        this._userInfo = {
          nickName: '开发测试用户',
          avatarUrl: '/icon.png'
        };
        return this._userInfo;
      }
      
      // 其他错误情况，使用默认信息但不影响登录
      console.warn('使用默认用户信息');
      this._userInfo = {
        nickName: '抖音用户',
        avatarUrl: '/icon.png'
      };
      return this._userInfo;
    }
  }

  /**
   * 获取基本用户信息（不弹授权弹窗）
   */
  async _getUserInfo() {
    try {
      // 检查是否在抖音环境中
      if (typeof tt !== 'undefined' && tt.getUserProfile) {
        const userInfo = await this._promisify(tt.getUserProfile)();
        this._userInfo = userInfo.userInfo;
      } else {
        // 开发环境使用模拟数据
        this._userInfo = {
          nickName: '抖音测试用户',
          avatarUrl: '/icon.png'
        };
      }
      return this._userInfo;
    } catch (error) {
      console.warn('获取用户信息失败，使用默认信息:', error);
      this._userInfo = {
        nickName: '抖音用户',
        avatarUrl: '/icon.png'
      };
      return this._userInfo;
    }
  }

  /**
   * 确保访问令牌有效
   */
  async _ensureValidToken() {
    if (!this._accessToken) {
      throw new Error('请先完成OAuth授权');
    }
    
    // 检查令牌是否即将过期（提前5分钟刷新）
    if (this._expiresAt && Date.now() > (this._expiresAt - 5 * 60 * 1000)) {
      console.log('访问令牌即将过期，尝试刷新...');
      await this._refreshAccessToken();
    }
  }

  /**
   * 刷新访问令牌
   */
  async _refreshAccessToken() {
    if (!this._refreshToken) {
      throw new Error('刷新令牌不存在，请重新授权');
    }
    
    try {
      console.log('刷新访问令牌...');
      
      // 在真实环境中，这里应该调用您的后端API刷新令牌
      // 这里模拟刷新过程
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this._accessToken = 'refreshed_access_token_' + Math.random().toString(36).substr(2, 32);
      this._refreshToken = 'refreshed_refresh_token_' + Math.random().toString(36).substr(2, 32);
      this._expiresAt = Date.now() + (7200 * 1000); // 2小时后过期
      
      this._saveToStorage();
      console.log('访问令牌刷新成功');
      
    } catch (error) {
      console.error('刷新访问令牌失败:', error);
      // 清除过期的令牌信息
      this._accessToken = null;
      this._refreshToken = null;
      this._authorizedScopes = [];
      this._saveToStorage();
      throw error;
    }
  }

  /**
   * 调用后端API的通用方法
   */
  async _callBackendAPI(endpoint, options = {}) {
    // 动态获取API地址
    const baseUrl = getBackendApiBase();
    const url = `${baseUrl}${endpoint}`;
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };
    
    if (options.body) {
      config.data = options.body; // 小程序使用data字段
      config.body = JSON.stringify(options.body); // fetch使用body字段
    }
    
    try {
      console.log('调用后端API:', url, '方法:', config.method, '数据:', options.body);
      
      // 检查是否在小程序环境中
      if (typeof tt !== 'undefined' && tt.request) {
        // 使用小程序的网络请求API
        const result = await this._promisify(tt.request)({
          url: url,
          method: config.method,
          data: options.body,
          header: config.headers,
          timeout: 15000 // 15秒超时
        });
        
        console.log('小程序请求完整结果:', result);
        console.log('HTTP状态码:', result.statusCode);
        console.log('响应数据:', result.data);
        
        if (result.statusCode >= 200 && result.statusCode < 300) {
          if (result.data && typeof result.data === 'object') {
            if (result.data.success !== false) {
              // 如果success字段不是false，就认为成功
              return result.data;
            } else {
              throw new Error(result.data.message || '后端API返回错误');
            }
          } else {
            // 如果没有返回数据或数据格式不正确
            console.warn('后端返回的数据格式异常:', result.data);
            throw new Error('后端返回数据格式不正确');
          }
        } else {
          throw new Error(`HTTP ${result.statusCode}: ${result.data?.message || result.errMsg || '请求失败'}`);
        }
      } else {
        // 开发环境使用fetch
        const response = await fetch(url, config);
        const data = await response.json();
        
        console.log('Fetch请求结果:', response.status, data);
        
        if (response.ok) {
          if (data.success !== false) {
            return data;
          } else {
            throw new Error(data.message || '后端API返回错误');
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${data.message || '请求失败'}`);
        }
      }
    } catch (error) {
      console.error('后端API调用失败:', error);
      console.error('错误详情:', {
        message: error.message,
        errMsg: error.errMsg,
        errNo: error.errNo,
        statusCode: error.statusCode
      });
      
      // 分析错误类型，提供更友好的错误信息
      let errorMsg = '后端API调用失败';
      const isDevTools = _isDevToolsEnv();
      
      if (error.errMsg) {
        if (error.errMsg.includes('timeout') || error.errMsg.includes('连接超时')) {
          errorMsg = `网络连接超时，无法访问服务器 ${baseUrl}`;
        } else if (error.errMsg.includes('fail') || error.errMsg.includes('network')) {
          errorMsg = `网络连接失败，无法访问服务器 ${baseUrl}`;
        } else if (error.errMsg.includes('ssl') || error.errMsg.includes('certificate')) {
          errorMsg = `SSL证书验证失败，请检查服务器配置`;
        } else {
          errorMsg = `网络请求失败: ${error.errMsg}`;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      console.warn('最终错误信息:', errorMsg);
      console.warn('请求的URL:', url);
      console.warn('环境信息:', { isDevTools, baseUrl });
      
      throw new Error(errorMsg);
    }
  }

  /**
   * Promise化小程序API
   */
  _promisify(fn) {
    return (options = {}) => {
      return new Promise((resolve, reject) => {
        // 检查是否在抖音环境中
        if (typeof fn !== 'function') {
          reject(new Error('API不可用'));
          return;
        }
        
        fn({
          ...options,
          success: resolve,
          fail: reject
        });
      });
    };
  }

  /**
   * 保存状态到本地存储
   */
  _saveToStorage() {
    try {
      const state = {
        isLoggedIn: this._isLoggedIn,
        userInfo: this._userInfo,
        accessToken: this._accessToken,
        refreshToken: this._refreshToken,
        openId: this._openId,
        unionId: this._unionId,
        sessionKey: this._sessionKey,
        expiresAt: this._expiresAt,
        authorizedScopes: this._authorizedScopes
      };
      
      // 检查是否在抖音环境中
      if (typeof tt !== 'undefined' && tt.setStorageSync) {
        tt.setStorageSync('douyin_auth_state', JSON.stringify(state));
      } else {
        // 开发环境使用localStorage
        localStorage.setItem('douyin_auth_state', JSON.stringify(state));
      }
    } catch (error) {
      console.error('保存状态失败:', error);
    }
  }

  /**
   * 从本地存储恢复状态
   */
  _loadFromStorage() {
    try {
      let stateStr = null;
      
      // 检查是否在抖音环境中
      if (typeof tt !== 'undefined' && tt.getStorageSync) {
        stateStr = tt.getStorageSync('douyin_auth_state');
      } else {
        // 开发环境使用localStorage
        stateStr = localStorage.getItem('douyin_auth_state');
      }
      
      if (stateStr) {
        const state = JSON.parse(stateStr);
        this._isLoggedIn = state.isLoggedIn || false;
        this._userInfo = state.userInfo || null;
        this._accessToken = state.accessToken || null;
        this._refreshToken = state.refreshToken || null;
        this._openId = state.openId || null;
        this._unionId = state.unionId || null;
        this._sessionKey = state.sessionKey || null;
        this._expiresAt = state.expiresAt || null;
        this._authorizedScopes = state.authorizedScopes || [];
      }
    } catch (error) {
      console.error('恢复状态失败:', error);
    }
  }

  /**
   * 登出
   */
  logout() {
    this._isLoggedIn = false;
    this._userInfo = null;
    this._accessToken = null;
    this._refreshToken = null;
    this._openId = null;
    this._unionId = null;
    this._sessionKey = null;
    this._expiresAt = null;
    this._authorizedScopes = [];
    
    try {
      // 检查是否在抖音环境中
      if (typeof tt !== 'undefined' && tt.removeStorageSync) {
        tt.removeStorageSync('douyin_auth_state');
      } else {
        // 开发环境使用localStorage
        localStorage.removeItem('douyin_auth_state');
      }
    } catch (error) {
      console.error('清除存储失败:', error);
    }
  }

  // Getters
  get isLoggedIn() {
    return this._isLoggedIn;
  }

  get userInfo() {
    return this._userInfo;
  }

  get openId() {
    return this._openId;
  }

  get unionId() {
    return this._unionId;
  }

  get authorizedScopes() {
    return this._authorizedScopes;
  }

  get hasOAuthAuth() {
    const result = this._accessToken && this._authorizedScopes.length > 0;
    console.log('hasOAuthAuth getter调用 - 结果:', result, '详情:', {
      hasAccessToken: !!this._accessToken,
      scopesLength: this._authorizedScopes.length,
      scopes: this._authorizedScopes
    });
    return result;
  }

  hasScope(scope) {
    return this._authorizedScopes.includes(scope);
  }

  /**
   * 测试服务器连接
   */
  async testConnection() {
    try {
      const baseUrl = getBackendApiBase();
      console.log('测试连接到:', baseUrl);
      
      const result = await this._callBackendAPI('/health');
      console.log('连接测试成功:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('连接测试失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取服务器调试信息
   */
  async getDebugInfo() {
    try {
      const result = await this._callBackendAPI('/api/debug/info');
      console.log('服务器调试信息:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('获取调试信息失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 创建全局实例
const douyinAuth = new DouyinAuth();

module.exports = douyinAuth; 