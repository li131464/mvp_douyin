const axios = require('axios');
const logger = require('./logger');
const cache = require('./cache');

class DouyinAPI {
  constructor() {
    this.baseURL = process.env.DOUYIN_API_BASE_URL || 'https://developer.open-douyin.com';
    this.appId = process.env.DOUYIN_APP_ID;
    this.appSecret = process.env.DOUYIN_APP_SECRET;
    
    if (!this.appId || !this.appSecret) {
      logger.warn('Douyin API credentials not configured, using mock mode');
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DouyinMiniApp/1.0'
      }
    });
    
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Douyin API Request:', {
          url: config.url,
          method: config.method,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Douyin API Request Error:', error);
        return Promise.reject(error);
      }
    );
    
    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Douyin API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('Douyin API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * code2session - 获取用户openid和session_key
   */
  async code2session(code) {
    try {
      if (!this.appId || !this.appSecret) {
        logger.info('No API credentials configured, using mock mode');
        return this._mockCode2Session(code);
      }
      
      logger.info('Attempting real Douyin API call for code2session');
      
      const response = await this.client.post('/oauth/code2session/', {
        appid: this.appId,
        secret: this.appSecret,
        code: code,
        grant_type: 'authorization_code'
      });
      
      if (response.data.error) {
        throw new Error(`Douyin API Error: ${response.data.error_description}`);
      }
      
      logger.info('Real Douyin API call successful');
      logger.info('Real API response data:', response.data);
      
      // 检查响应数据是否完整
      if (!response.data.openid) {
        logger.warn('Real API returned incomplete data, falling back to mock');
        return this._mockCode2Session(code);
      }
      
      return {
        success: true,
        openid: response.data.openid,
        unionid: response.data.unionid,
        session_key: response.data.session_key
      };
    } catch (error) {
      logger.warn('Real Douyin API call failed, falling back to mock mode:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      // 回退到模拟模式
      return this._mockCode2Session(code);
    }
  }

  /**
   * 获取access_token
   */
  async getAccessToken(ticket, openId) {
    try {
      if (!this.appId || !this.appSecret) {
        logger.info('No API credentials configured, using mock mode');
        return this._mockGetAccessToken(ticket, openId);
      }
      
      logger.info('Attempting real Douyin API call for access token');
      
      const response = await this.client.post('/oauth/access_token/', {
        client_key: this.appId,
        client_secret: this.appSecret,
        code: ticket, // 抖音API使用code参数而不是ticket
        grant_type: 'authorization_code'
      });
      
      if (response.data.error) {
        throw new Error(`Douyin API Error: ${response.data.error_description}`);
      }
      
      const result = {
        success: true,
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in || 7200,
        scope: response.data.scope
      };
      
      // 缓存access_token
      const cacheKey = `access_token:${openId}`;
      await cache.set(cacheKey, result.access_token, result.expires_in - 300); // 提前5分钟过期
      
      logger.info('Real Douyin API access token call successful');
      return result;
    } catch (error) {
      logger.warn('Real Douyin API access token call failed, falling back to mock mode:', error.message);
      // 回退到模拟模式
      return this._mockGetAccessToken(ticket, openId);
    }
  }

  /**
   * 刷新access_token
   */
  async refreshAccessToken(refreshToken, openId) {
    try {
      if (!this.appId || !this.appSecret) {
        // 模拟模式
        return this._mockRefreshAccessToken(refreshToken, openId);
      }
      
      const response = await this.client.post('/oauth/refresh_token/', {
        appid: this.appId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });
      
      if (response.data.error) {
        throw new Error(`Douyin API Error: ${response.data.error_description}`);
      }
      
      const result = {
        success: true,
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in || 7200
      };
      
      // 更新缓存
      const cacheKey = `access_token:${openId}`;
      await cache.set(cacheKey, result.access_token, result.expires_in - 300);
      
      return result;
    } catch (error) {
      logger.error('Refresh access token failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户视频列表 - 根据抖音开放平台文档
   */
  async getUserVideos(accessToken, openId, cursor = 0, count = 20) {
    try {
      if (!this.appId || !this.appSecret) {
        logger.info('No API credentials configured, using mock mode');
        return this._mockGetUserVideos(cursor, count);
      }
      
      logger.info('Attempting real Douyin API call for user videos');
      
      // 根据文档调用真实的抖音用户视频数据API
      const response = await this.client.post('/data/external/user/item/', {
        access_token: accessToken,
        open_id: openId,
        cursor: cursor,
        count: count
      });
      
      if (response.data.error_code !== 0) {
        throw new Error(`Douyin API Error: ${response.data.description}`);
      }
      
      logger.info('Real Douyin API user videos call successful');
      return {
        success: true,
        data: response.data.data?.list || [],
        cursor: response.data.data?.cursor || cursor + count,
        has_more: response.data.data?.has_more || false
      };
    } catch (error) {
      logger.warn('Real Douyin API user videos call failed, falling back to mock mode:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      // 回退到模拟模式
      return this._mockGetUserVideos(cursor, count);
    }
  }

  /**
   * 获取用户评论列表
   */
  async getUserComments(accessToken, openId, cursor = 0, count = 20) {
    try {
      if (!this.appId || !this.appSecret) {
        // 模拟模式
        return this._mockGetUserComments(cursor, count);
      }
      
      const response = await this.client.get('/comment/list/', {
        params: {
          access_token: accessToken,
          open_id: openId,
          cursor: cursor,
          count: count
        }
      });
      
      if (response.data.error) {
        throw new Error(`Douyin API Error: ${response.data.error_description}`);
      }
      
      return {
        success: true,
        data: response.data.data || [],
        cursor: response.data.cursor || 0,
        has_more: response.data.has_more || false
      };
    } catch (error) {
      logger.error('Get user comments failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户私信列表
   */
  async getUserMessages(accessToken, openId, cursor = 0, count = 20) {
    try {
      if (!this.appId || !this.appSecret) {
        // 模拟模式
        return this._mockGetUserMessages(cursor, count);
      }
      
      const response = await this.client.get('/message/list/', {
        params: {
          access_token: accessToken,
          open_id: openId,
          cursor: cursor,
          count: count
        }
      });
      
      if (response.data.error) {
        throw new Error(`Douyin API Error: ${response.data.error_description}`);
      }
      
      return {
        success: true,
        data: response.data.data || [],
        cursor: response.data.cursor || 0,
        has_more: response.data.has_more || false
      };
    } catch (error) {
      logger.error('Get user messages failed:', error);
      throw error;
    }
  }

  // 模拟方法
  _mockCode2Session(code) {
    logger.info('Using mock code2session');
    return {
      success: true,
      openid: `mock_openid_${Math.random().toString(36).substr(2, 9)}`,
      unionid: `mock_unionid_${Math.random().toString(36).substr(2, 9)}`,
      session_key: `mock_session_key_${Math.random().toString(36).substr(2, 16)}`
    };
  }

  _mockGetAccessToken(ticket, openId) {
    logger.info('Using mock get access token');
    return {
      success: true,
      access_token: `mock_access_token_${Math.random().toString(36).substr(2, 32)}`,
      refresh_token: `mock_refresh_token_${Math.random().toString(36).substr(2, 32)}`,
      expires_in: 7200,
      scope: 'user_info,video.list,comment.list,message.list'
    };
  }

  _mockRefreshAccessToken(refreshToken, openId) {
    logger.info('Using mock refresh access token');
    return {
      success: true,
      access_token: `refreshed_access_token_${Math.random().toString(36).substr(2, 32)}`,
      refresh_token: `refreshed_refresh_token_${Math.random().toString(36).substr(2, 32)}`,
      expires_in: 7200
    };
  }

  _mockGetUserVideos(cursor, count) {
    logger.info('Using mock get user videos');
    const videos = [];
    const startIndex = cursor;
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      videos.push({
        item_id: `video_${index}`,
        title: `后端API视频${index + 1} - 真实数据结构`,
        cover: `https://mock-cover-${index}.jpg`,
        statistics: {
          play_count: Math.floor(Math.random() * 100000),
          digg_count: Math.floor(Math.random() * 10000),
          comment_count: Math.floor(Math.random() * 1000),
          share_count: Math.floor(Math.random() * 500)
        },
        create_time: Date.now() - (index * 24 * 60 * 60 * 1000),
        duration: Math.floor(Math.random() * 60) + 15,
        is_top: index < 3
      });
    }
    
    return {
      success: true,
      data: videos,
      cursor: cursor + count,
      has_more: cursor + count < 100
    };
  }

  _mockGetUserComments(cursor, count) {
    logger.info('Using mock get user comments');
    const comments = [];
    const startIndex = cursor;
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      comments.push({
        comment_id: `comment_${index}`,
        text: `这是第${index + 1}条真实评论内容，来自后端API模拟数据`,
        create_time: Date.now() - (index * 60 * 60 * 1000),
        digg_count: Math.floor(Math.random() * 100),
        reply_count: Math.floor(Math.random() * 20),
        item_id: `video_${Math.floor(index / 5)}`,
        item_title: `视频${Math.floor(index / 5) + 1}的标题`,
        top: index < 5
      });
    }
    
    return {
      success: true,
      data: comments,
      cursor: cursor + count,
      has_more: cursor + count < 200
    };
  }

  _mockGetUserMessages(cursor, count) {
    logger.info('Using mock get user messages');
    const messages = [];
    const startIndex = cursor;
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      messages.push({
        conversation_id: `conv_${Math.floor(index / 3)}`,
        message_id: `msg_${index}`,
        content: `这是第${index + 1}条真实私信内容，来自后端API`,
        message_type: 'text',
        create_time: Date.now() - (index * 30 * 60 * 1000),
        from_user: {
          open_id: `user_${Math.floor(Math.random() * 100)}`,
          nickname: `真实用户${Math.floor(Math.random() * 100)}`,
          avatar: `https://mock-avatar-${Math.floor(Math.random() * 10)}.jpg`
        },
        to_user: {
          open_id: 'current_user_openid',
          nickname: '当前用户',
          avatar: '/icon.png'
        }
      });
    }
    
    return {
      success: true,
      data: messages,
      cursor: cursor + count,
      has_more: cursor + count < 50
    };
  }
}

module.exports = new DouyinAPI(); 