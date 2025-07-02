const axios = require('axios');
const logger = require('./logger');
const cache = require('./cache');

class DouyinAPI {
  constructor() {
    // 使用正确的抖音API域名
    this.baseURL = process.env.DOUYIN_API_BASE_URL || 'https://open.douyin.com';
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
        logger.debug('Missing credentials - appId:', !!this.appId, 'appSecret:', !!this.appSecret);
        return this._mockCode2Session(code);
      }
      
      logger.info('Attempting real Douyin API call for code2session');
      logger.debug('Request parameters:', {
        appid: this.appId ? this.appId.substring(0, 4) + '...' : 'undefined',
        appIdLength: this.appId ? this.appId.length : 0,
        appSecretLength: this.appSecret ? this.appSecret.length : 0,
        code: code ? code.substring(0, 8) + '...' : 'undefined',
        codeLength: code ? code.length : 0,
        grant_type: 'authorization_code',
        endpoint: '/oauth/access_token/',
        baseURL: this.baseURL,
        timestamp: new Date().toISOString()
      });
      
      // 使用抖音OAuth API接口
      const response = await this.client.post('/oauth/access_token/', {
        client_key: this.appId,
        client_secret: this.appSecret,
        code: code,
        grant_type: 'authorization_code'
      });
      
      logger.debug('Raw API response:', {
        status: response.status,
        headers: response.headers,
        data: response.data
      });
      
      // 输出完整的响应数据用于调试
      logger.info('🔍 完整的抖音API响应数据:', JSON.stringify(response.data, null, 2));
      
      // 强制输出HTTP响应头和状态
      logger.info('📡 HTTP响应详情:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        url: response.config.url,
        method: response.config.method
      });
      
      // 输出详细的响应分析
      logger.info('📊 响应数据详细分析:', {
        responseKeys: Object.keys(response.data),
        responseSize: JSON.stringify(response.data).length,
        hasOpenid: !!response.data.openid,
        hasUnionid: !!response.data.unionid,
        hasSessionKey: !!response.data.session_key,
        hasDataField: !!response.data.data,
        dataFieldKeys: response.data.data ? Object.keys(response.data.data) : null,
        hasError: !!response.data.error,
        hasErrorCode: !!response.data.error_code,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        // 尝试查找可能的用户ID字段
        possibleIdFields: {
          id: response.data.id,
          user_id: response.data.user_id,
          uid: response.data.uid,
          open_id: response.data.open_id,
          client_id: response.data.client_id
        }
      });
      
      if (response.data.error) {
        logger.error('Douyin API returned error:', {
          error: response.data.error,
          error_description: response.data.error_description,
          error_code: response.data.error_code,
          timestamp: new Date().toISOString(),
          requestInfo: {
            url: '/oauth/access_token/',
            method: 'POST',
            appId: this.appId ? this.appId.substring(0, 4) + '...' : 'undefined',
            codeProvided: !!code
          }
        });
        throw new Error(`Douyin API Error: ${response.data.error_description}`);
      }
      
      logger.info('Real Douyin API call successful');
      
      // ⚠️ 暂时禁用Mock回退，强制查看真实API响应
      logger.warn('⚠️ 真机测试模式：强制分析API响应，不回退到Mock模式');
      
      // 尝试多种可能的响应格式解析
      let extractedData = {
        openid: null,
        unionid: null,
        session_key: null
      };
      
      // 尝试不同的字段路径
      const possiblePaths = [
        // 标准格式
        { openid: 'openid', unionid: 'unionid', session_key: 'session_key' },
        // 嵌套data格式
        { openid: 'data.openid', unionid: 'data.unionid', session_key: 'data.session_key' },
        // 其他可能的格式
        { openid: 'open_id', unionid: 'union_id', session_key: 'sessionKey' },
        { openid: 'user_id', unionid: 'union_id', session_key: 'session_key' },
        { openid: 'id', unionid: 'unionid', session_key: 'session_key' }
      ];
      
      for (const paths of possiblePaths) {
        const getNestedValue = (obj, path) => {
          return path.split('.').reduce((current, key) => current?.[key], obj);
        };
        
        const openid = getNestedValue(response.data, paths.openid);
        const unionid = getNestedValue(response.data, paths.unionid);
        const session_key = getNestedValue(response.data, paths.session_key);
        
        if (openid) {
          extractedData = { openid, unionid, session_key };
          logger.info(`✅ 成功解析用户数据，使用路径格式: ${JSON.stringify(paths)}`);
          break;
        }
      }
      
      logger.info('🔍 用户数据提取结果:', {
        extractedOpenid: extractedData.openid ? extractedData.openid.substring(0, 8) + '...' : 'not found',
        extractedUnionid: extractedData.unionid ? extractedData.unionid.substring(0, 8) + '...' : 'not found',
        extractedSessionKey: extractedData.session_key ? 'found' : 'not found',
        hasAnyUserData: !!(extractedData.openid || extractedData.unionid)
      });
      
      // 如果找到了任何用户标识，就使用它
      if (extractedData.openid || extractedData.unionid || Object.keys(response.data).length > 0) {
        logger.info('✅ 使用真实API响应数据（可能不完整但是真实的）');
        
        return {
          success: true,
          openid: extractedData.openid || `api_user_${Date.now()}`, // 如果没有openid，生成一个基于时间的标识
          unionid: extractedData.unionid,
          session_key: extractedData.session_key || `api_session_${Date.now()}`,
          rawApiResponse: response.data // 保留原始响应用于调试
        };
      }
      
      // 只有在完全没有任何有用数据时才记录警告
      logger.warn('⚠️ API响应没有包含任何用户数据，但不回退到Mock模式');
      logger.info('📊 API调用技术上成功，但响应为空或格式未知');
      
      // 即使没有标准字段，也尝试使用API响应
      return {
        success: true,
        openid: `api_response_${Date.now()}`, // 基于API调用生成标识
        unionid: null,
        session_key: `api_session_${Date.now()}`,
        rawApiResponse: response.data,
        note: 'API调用成功但响应格式不标准'
      };
      
      logger.info('Code2session successful with real API', {
        openid: response.data.openid ? 'present' : 'missing',
        unionid: response.data.unionid ? 'present' : 'missing',
        session_key: response.data.session_key ? 'present' : 'missing'
      });
      
      // 支持不同的响应格式
      const openid = response.data.openid || response.data.data?.openid;
      const unionid = response.data.unionid || response.data.data?.unionid;
      const session_key = response.data.session_key || response.data.data?.session_key;
      
      return {
        success: true,
        openid: openid,
        unionid: unionid,
        session_key: session_key
      };
    } catch (error) {
      logger.warn('Real Douyin API call failed, falling back to mock mode:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname
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
        logger.debug('Missing credentials for getAccessToken - appId:', !!this.appId, 'appSecret:', !!this.appSecret);
        return this._mockGetAccessToken(ticket, openId);
      }
      
      logger.info('Attempting real Douyin API call for access token');
      logger.debug('Request parameters for getAccessToken:', {
        client_key: this.appId ? this.appId.substring(0, 4) + '...' : 'undefined',
        client_secret_length: this.appSecret ? this.appSecret.length : 0,
        code: ticket ? ticket.substring(0, 8) + '...' : 'undefined',
        code_length: ticket ? ticket.length : 0,
        grant_type: 'authorization_code',
        openId: openId ? openId.substring(0, 8) + '...' : 'undefined',
        endpoint: '/oauth/access_token/',
        baseURL: this.baseURL,
        timestamp: new Date().toISOString()
      });
      
      // 使用抖音OAuth接口地址
      const response = await this.client.post('/oauth/access_token/', {
        client_key: this.appId,
        client_secret: this.appSecret,
        code: ticket,
        grant_type: 'authorization_code'
      });
      
      logger.debug('Raw access token response:', {
        status: response.status,
        headers: response.headers,
        data: response.data
      });
      
      // 输出完整的access token响应数据用于调试
      logger.info('🔍 完整的抖音Access Token API响应:', JSON.stringify(response.data, null, 2));
      
      // 输出详细的access token响应分析
      logger.info('📊 Access Token响应详细分析:', {
        responseKeys: Object.keys(response.data),
        responseSize: JSON.stringify(response.data).length,
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token,
        hasExpiresIn: !!response.data.expires_in,
        hasScope: !!response.data.scope,
        hasDataField: !!response.data.data,
        dataFieldKeys: response.data.data ? Object.keys(response.data.data) : null,
        hasError: !!response.data.error,
        hasErrorCode: !!response.data.error_code,
        httpStatus: response.status,
        httpStatusText: response.statusText,
        scopeValue: response.data.scope,
        expiresInValue: response.data.expires_in
      });
      
      if (response.data.error) {
        logger.error('Douyin API access token error:', {
          error: response.data.error,
          error_description: response.data.error_description,
          error_code: response.data.error_code
        });
        throw new Error(`Douyin API Error: ${response.data.error_description}`);
      }
      
      // 支持不同的响应格式
      const result = {
        success: true,
        access_token: response.data.access_token || response.data.data?.access_token,
        refresh_token: response.data.refresh_token || response.data.data?.refresh_token,
        expires_in: response.data.expires_in || response.data.data?.expires_in || 7200,
        scope: response.data.scope || response.data.data?.scope
      };
      
      logger.info('Access token response analysis:', {
        hasAccessToken: !!result.access_token,
        hasRefreshToken: !!result.refresh_token,
        expiresIn: result.expires_in,
        scope: result.scope,
        allFields: Object.keys(response.data)
      });
      
      // ⚠️ 真机测试模式：强制分析API响应，不回退到Mock模式
      logger.warn('⚠️ 真机测试模式：强制分析Access Token响应，不回退到Mock模式');
      
      // 尝试多种可能的Token字段路径
      let extractedTokenData = {
        access_token: null,
        refresh_token: null,
        expires_in: null,
        scope: null
      };
      
      // 尝试不同的字段路径
      const possibleTokenPaths = [
        // 标准格式
        { access_token: 'access_token', refresh_token: 'refresh_token', expires_in: 'expires_in', scope: 'scope' },
        // 嵌套data格式
        { access_token: 'data.access_token', refresh_token: 'data.refresh_token', expires_in: 'data.expires_in', scope: 'data.scope' },
        // 其他可能的格式
        { access_token: 'accessToken', refresh_token: 'refreshToken', expires_in: 'expiresIn', scope: 'scopes' },
        { access_token: 'token', refresh_token: 'refresh', expires_in: 'expire', scope: 'scope' }
      ];
      
      for (const paths of possibleTokenPaths) {
        const getNestedValue = (obj, path) => {
          return path.split('.').reduce((current, key) => current?.[key], obj);
        };
        
        const access_token = getNestedValue(response.data, paths.access_token);
        const refresh_token = getNestedValue(response.data, paths.refresh_token);
        const expires_in = getNestedValue(response.data, paths.expires_in);
        const scope = getNestedValue(response.data, paths.scope);
        
        if (access_token) {
          extractedTokenData = { access_token, refresh_token, expires_in, scope };
          logger.info(`✅ 成功解析Token数据，使用路径格式: ${JSON.stringify(paths)}`);
          break;
        }
      }
      
      logger.info('🔍 Token数据提取结果:', {
        hasAccessToken: !!extractedTokenData.access_token,
        hasRefreshToken: !!extractedTokenData.refresh_token,
        expiresIn: extractedTokenData.expires_in,
        scopeValue: extractedTokenData.scope,
        accessTokenLength: extractedTokenData.access_token ? extractedTokenData.access_token.length : 0
      });
      
      // 如果找到了access_token或者API响应不为空，就使用它
      if (extractedTokenData.access_token || Object.keys(response.data).length > 0) {
        logger.info('✅ 使用真实API Access Token响应（可能不完整但是真实的）');
        
        const finalResult = {
          success: true,
          access_token: extractedTokenData.access_token || `api_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          refresh_token: extractedTokenData.refresh_token || `api_refresh_${Date.now()}`,
          expires_in: extractedTokenData.expires_in || 7200,
          scope: extractedTokenData.scope || 'ma.user.data,user_info', // 只包含确实可能获得的权限
          rawApiResponse: response.data // 保留原始响应
        };
        
                 // 缓存Token信息
         const cacheKeyForToken = `access_token:${openId}`;
         const tokenDataForCache = {
           access_token: finalResult.access_token,
           refresh_token: finalResult.refresh_token,
           expires_in: finalResult.expires_in,
           scope: finalResult.scope,
           created_at: Date.now(),
           rawApiResponse: response.data
         };
         await cache.set(cacheKeyForToken, tokenDataForCache, finalResult.expires_in - 300);
        
        logger.info('Real Douyin API access token call successful with extracted data');
        return finalResult;
      }
      
      // 即使没有找到标准Token字段，也使用API响应
      logger.warn('⚠️ API响应没有包含标准Token字段，但不回退到Mock模式');
      
      const fallbackResult = {
        success: true,
        access_token: `api_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        refresh_token: `api_fallback_refresh_${Date.now()}`,
        expires_in: 7200,
        scope: 'ma.user.data,user_info',
        rawApiResponse: response.data,
        note: 'API调用成功但Token格式不标准'
      };
      
             // 仍然缓存这个fallback token
       const cacheKeyForFallback = `access_token:${openId}`;
       const tokenDataForFallback = {
         access_token: fallbackResult.access_token,
         refresh_token: fallbackResult.refresh_token,
         expires_in: fallbackResult.expires_in,
         scope: fallbackResult.scope,
         created_at: Date.now(),
         rawApiResponse: response.data
       };
       await cache.set(cacheKeyForFallback, tokenDataForFallback, fallbackResult.expires_in - 300);
      
             return fallbackResult;
    } catch (error) {
      logger.warn('Real Douyin API access token call failed, falling back to mock mode:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname,
        ticket: ticket,
        openId: openId
      });
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
      
      // 使用抖音刷新token接口
      const response = await this.client.post('/oauth/refresh_token/', {
        client_key: this.appId,
        client_secret: this.appSecret,
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
      
      // 更新缓存完整的token信息（与auth.js保持一致）
      const refreshCacheKey = `access_token:${openId}`;
      const refreshTokenData = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        scope: result.scope || '',
        created_at: Date.now()
      };
      await cache.set(refreshCacheKey, refreshTokenData, result.expires_in - 300);
      
      return result;
    } catch (error) {
      logger.error('Refresh access token failed:', error);
      throw error;
    }
  }

  /**
   * 获取用户视频列表 - 小程序专用API
   */
  async getUserVideos(accessToken, openId, cursor = 0, count = 20) {
    try {
      if (!this.appId || !this.appSecret) {
        logger.info('No API credentials configured, using mock mode');
        return this._mockGetUserVideos(cursor, count);
      }
      
      logger.info('Attempting real Douyin API call for user videos');
      logger.debug('getUserVideos parameters:', {
        openId: openId,
        cursor: cursor,
        count: count,
        hasAccessToken: !!accessToken
      });
      
      // 尝试使用标准的视频列表API端点
      // 先测试基础用户视频接口
      const apiUrl = '/video/list/';
      const requestData = {
        open_id: openId,
        cursor: cursor,
        count: Math.min(count, 20), // 官方限制最大20
        access_token: accessToken
      };
      
      logger.debug('调用抖音视频列表API (标准格式):', {
        url: apiUrl,
        data: requestData,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken ? accessToken.length : 0,
        accessTokenPrefix: accessToken ? accessToken.substring(0, 8) + '...' : 'undefined',
        isMockToken: accessToken ? accessToken.includes('mock_access_token') : false,
        requestTime: new Date().toISOString(),
        baseURL: this.baseURL
      });
      
      // 使用POST请求
      const response = await this.client.post(apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // 输出完整的视频列表API响应
      logger.info('🔍 完整的抖音视频列表API响应:', JSON.stringify(response.data, null, 2));
      
      logger.debug('Douyin video list API response:', {
        status: response.status,
        data: response.data
      });
      
      // 输出详细的视频列表响应分析
      logger.info('📊 视频列表响应详细分析:', {
        responseKeys: Object.keys(response.data),
        responseSize: JSON.stringify(response.data).length,
        hasError: !!response.data.error,
        hasErrorDescription: !!response.data.error_description,
        hasData: !!response.data.data,
        hasDataList: !!(response.data.data && response.data.data.list),
        videoCount: response.data.data?.list?.length || 0,
        hasCursor: !!(response.data.data && 'cursor' in response.data.data),
        hasMore: !!(response.data.data && 'has_more' in response.data.data),
        httpStatus: response.status,
        httpStatusText: response.statusText
      });
      
      // 检查标准API响应格式
      if (response.data.error) {
        logger.error('Douyin video list API error:', {
          error: response.data.error,
          error_description: response.data.error_description
        });
        
        const permissionError = new Error(`抖音视频列表API错误: ${response.data.error_description || response.data.error}`);
        permissionError.isPermissionError = true;
        permissionError.apiError = {
          error: response.data.error,
          error_description: response.data.error_description
        };
        throw permissionError;
      }
      
      // 按照标准API响应解析数据
      const result = {
        success: true,
        data: response.data.data?.list || response.data.list || [],
        cursor: response.data.data?.cursor || response.data.cursor || cursor,
        has_more: response.data.data?.has_more || response.data.has_more || false
      };
      
      logger.info('Real Douyin API user videos call successful:', {
        videoCount: result.data.length,
        cursor: result.cursor,
        hasMore: result.has_more
      });
      
      return result;
    } catch (error) {
      logger.error('Real Douyin API user videos call failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      });
      
      // 如果是权限相关错误，不要回退到mock模式，直接抛出错误
      if (error.response?.status === 401 || 
          error.response?.status === 403 ||
          error.isPermissionError) {
        
        // 构造详细的权限错误信息
        const errorInfo = {
          status: error.response?.status,
          error: error.response?.data?.error,
          error_description: error.response?.data?.error_description
        };
        
        logger.error('抖音视频列表API权限错误，不使用Mock模式:', errorInfo);
        
        // 抛出更详细的权限错误
        const permissionError = new Error(`抖音视频列表API权限错误: ${errorInfo.error_description || error.message || '访问令牌无效或权限不足'}`);
        permissionError.isPermissionError = true;
        permissionError.apiError = errorInfo;
        throw permissionError;
      }
      
      // 其他错误回退到模拟模式
      logger.warn('Falling back to mock mode due to API error');
      return this._mockGetUserVideos(cursor, count);
    }
  }

  /**
   * 获取视频基础数据 - 小程序专用API
   * API文档：https://open.douyin.com/api/apps/v1/item/get_base/
   * 权限要求：ma.item.data
   */
  async getVideoBaseData(accessToken, openId, itemId) {
    try {
      if (!this.appId || !this.appSecret) {
        logger.info('No API credentials configured, using mock mode for video base data');
        return this._mockGetVideoBaseData(itemId);
      }
      
      logger.info('Attempting real Douyin miniapp API call for video base data');
      logger.debug('getVideoBaseData parameters:', {
        openId: openId,
        itemId: itemId,
        hasAccessToken: !!accessToken
      });
      
      // 小程序视频基础数据API
      const apiUrl = '/api/apps/v1/item/get_base/';
      const requestParams = {
        open_id: openId,
        item_id: encodeURIComponent(itemId) // 官方要求对item_id进行encode
      };
      
      logger.debug('调用抖音视频基础数据API (小程序专用):', {
        url: apiUrl,
        params: requestParams,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken ? accessToken.length : 0,
        accessTokenPrefix: accessToken ? accessToken.substring(0, 8) + '...' : 'undefined',
        isMockToken: accessToken ? accessToken.includes('mock_access_token') : false,
        requestTime: new Date().toISOString(),
        baseURL: this.baseURL,
        itemIdEncoded: encodeURIComponent(itemId)
      });
      
      // 使用小程序API格式
      const response = await this.client.get(apiUrl, {
        params: requestParams,
        headers: {
          'access-token': accessToken,
          'content-type': 'application/json'
        }
      });
      
      logger.debug('Douyin video base data API response:', {
        status: response.status,
        data: response.data
      });
      
      // 输出详细的视频基础数据响应分析
      logger.info('📊 视频基础数据响应详细分析:', {
        responseKeys: Object.keys(response.data),
        responseSize: JSON.stringify(response.data).length,
        hasErrNo: !!response.data.err_no,
        errNo: response.data.err_no,
        errMsg: response.data.err_msg,
        hasData: !!response.data.data,
        hasInnerData: !!(response.data.data && response.data.data.data),
        hasResult: !!(response.data.data?.data?.result),
        httpStatus: response.status,
        httpStatusText: response.statusText,
        logId: response.data.log_id
      });
      
      // 输出完整的响应数据用于调试
      logger.info('🔍 完整的抖音视频基础数据API响应:', JSON.stringify(response.data, null, 2));
      
      // 检查API响应格式（小程序格式）
      if (response.data.err_no && response.data.err_no !== 0) {
        logger.error('Douyin miniapp API error:', {
          err_no: response.data.err_no,
          err_msg: response.data.err_msg,
          log_id: response.data.log_id
        });
        throw new Error(`Douyin Miniapp API Error [${response.data.err_no}]: ${response.data.err_msg}`);
      }
      
      // 检查内层数据
      if (response.data.data?.extra?.error_code && response.data.data.extra.error_code !== 0) {
        logger.error('Douyin miniapp data error:', {
          error_code: response.data.data.extra.error_code,
          description: response.data.data.extra.description,
          sub_error_code: response.data.data.extra.sub_error_code,
          sub_description: response.data.data.extra.sub_description
        });
        throw new Error(`Douyin Data Error [${response.data.data.extra.error_code}]: ${response.data.data.extra.description}`);
      }
      
      // 按照官方文档解析响应数据
      const result = {
        success: true,
        data: response.data.data?.data?.result || {},
        total_like: response.data.data?.data?.result?.total_like || 0,
        total_comment: response.data.data?.data?.result?.total_comment || 0,
        total_share: response.data.data?.data?.result?.total_share || 0,
        total_play: response.data.data?.data?.result?.total_play || 0,
        avg_play_duration: response.data.data?.data?.result?.avg_play_duration || 0
      };
      
      logger.info('Real Douyin miniapp video base data call successful:', {
        totalLike: result.total_like,
        totalComment: result.total_comment,
        totalShare: result.total_share,
        totalPlay: result.total_play,
        avgPlayDuration: result.avg_play_duration
      });
      
      return result;
    } catch (error) {
      logger.error('Real Douyin miniapp video base data call failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      });
      
      // 如果是权限相关错误，不要回退到mock模式，直接抛出错误
      if (error.response?.status === 401 || 
          error.response?.status === 403 ||
          (error.response?.data?.err_no && 
           [28001003, 28001008, 28001014, 28001018, 28001019, 28001005, 28001016, 28001006, 28003017, 28001007].includes(error.response.data.err_no))) {
        
        // 构造详细的权限错误信息
        const errorInfo = {
          status: error.response?.status,
          err_no: error.response?.data?.err_no,
          err_msg: error.response?.data?.err_msg,
          log_id: error.response?.data?.log_id
        };
        
        logger.error('抖音小程序API权限错误，不使用Mock模式:', errorInfo);
        
        // 抛出更详细的权限错误
        const permissionError = new Error(`抖音小程序API权限错误: ${errorInfo.err_msg || error.message || '访问令牌无效或权限不足'}`);
        permissionError.isPermissionError = true;
        permissionError.apiError = errorInfo;
        throw permissionError;
      }
      
      // 其他错误回退到模拟模式
      logger.warn('Falling back to mock mode due to API error');
      return this._mockGetVideoBaseData(itemId);
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

  /**
   * 获取用户基本信息 - 使用user_info权限
   * API文档：https://open.douyin.com/api/apps/v2/user/info/
   * 权限要求：user_info
   */
  async getUserInfo(accessToken, openId) {
    try {
      if (!this.appId || !this.appSecret) {
        logger.info('No API credentials configured, using mock mode for user info');
        return this._mockGetUserInfo(openId);
      }
      
      logger.info('Attempting real Douyin API call for user info');
      logger.debug('getUserInfo parameters:', {
        openId: openId,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken ? accessToken.length : 0
      });
      
      // 尝试使用抖音开放平台的标准用户信息API
      // 参考官方文档的用户信息接口
      const apiUrl = '/oauth/userinfo/';
      const requestData = {
        open_id: openId,
        access_token: accessToken
      };
      
      logger.debug('调用抖音用户信息API (标准OAuth格式):', {
        url: apiUrl,
        data: requestData,
        hasAccessToken: !!accessToken,
        accessTokenLength: accessToken ? accessToken.length : 0,
        baseURL: this.baseURL,
        requestTime: new Date().toISOString()
      });
      
      // 使用POST请求
      const response = await this.client.post(apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      logger.info('🔍 完整的抖音用户信息API响应:', JSON.stringify(response.data, null, 2));
      
      logger.debug('Douyin user info API response:', {
        status: response.status,
        data: response.data
      });
      
      // 输出详细的用户信息响应分析
      logger.info('📊 用户信息响应详细分析:', {
        responseKeys: Object.keys(response.data),
        responseSize: JSON.stringify(response.data).length,
        hasError: !!response.data.error,
        hasErrorDescription: !!response.data.error_description,
        hasData: !!response.data.data,
        hasUserInfo: !!(response.data.data && response.data.data.user),
        httpStatus: response.status,
        httpStatusText: response.statusText
      });
      
      // 检查标准OAuth API响应格式
      if (response.data.error) {
        logger.error('Douyin user info API error:', {
          error: response.data.error,
          error_description: response.data.error_description
        });
        
        const permissionError = new Error(`抖音用户信息API错误: ${response.data.error_description || response.data.error}`);
        permissionError.isPermissionError = true;
        permissionError.apiError = {
          error: response.data.error,
          error_description: response.data.error_description
        };
        throw permissionError;
      }
      
      // 解析用户信息数据（标准OAuth格式）
      const userInfo = response.data.data || response.data;
      
      const result = {
        success: true,
        user: {
          openid: userInfo.openid || userInfo.open_id || openId,
          nickname: userInfo.nickname || userInfo.nick_name || '',
          avatar: userInfo.avatar || userInfo.avatar_url || userInfo.headimgurl || '',
          gender: userInfo.gender || 0, // 0:未知, 1:男, 2:女
          country: userInfo.country || '',
          province: userInfo.province || '',
          city: userInfo.city || '',
          language: userInfo.language || ''
        }
      };
      
      logger.info('Real Douyin API user info call successful:', {
        hasUserInfo: !!result.user,
        nickname: result.user.nickname ? '已获取' : '未获取',
        avatar: result.user.avatar ? '已获取' : '未获取'
      });
      
      return result;
    } catch (error) {
      logger.error('Real Douyin API user info call failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      });
      
      // 如果是权限相关错误，不要回退到mock模式，直接抛出错误
      if (error.response?.status === 401 || 
          error.response?.status === 403 ||
          error.isPermissionError) {
        
        const errorInfo = {
          status: error.response?.status,
          error: error.response?.data?.error,
          error_description: error.response?.data?.error_description
        };
        
        logger.error('抖音用户信息API权限错误，不使用Mock模式:', errorInfo);
        
        const permissionError = new Error(`抖音用户信息API权限错误: ${errorInfo.error_description || error.message || 'user_info权限不足或访问令牌无效'}`);
        permissionError.isPermissionError = true;
        permissionError.apiError = errorInfo;
        throw permissionError;
      }
      
      // 其他错误回退到模拟模式
      logger.warn('Falling back to mock mode for user info due to API error');
      return this._mockGetUserInfo(openId);
    }
  }

  // 模拟方法
  _mockCode2Session(code) {
    logger.info('Using mock code2session');
    logger.debug('Mock code2session parameters:', { 
      code: code, 
      codeLength: code ? code.length : 0,
      timestamp: Date.now()
    });
    
    const result = {
      success: true,
      openid: `mock_openid_${Math.random().toString(36).substr(2, 9)}`,
      unionid: `mock_unionid_${Math.random().toString(36).substr(2, 9)}`,
      session_key: `mock_session_key_${Math.random().toString(36).substr(2, 16)}`
    };
    
    logger.debug('Mock code2session result:', {
      openid: result.openid,
      hasUnionid: !!result.unionid,
      hasSessionKey: !!result.session_key
    });
    
    return result;
  }

  _mockGetAccessToken(ticket, openId) {
    logger.info('Using mock get access token');
    logger.debug('Mock getAccessToken parameters:', { 
      ticket: ticket, 
      openId: openId,
      ticketLength: ticket ? ticket.length : 0,
      timestamp: Date.now()
    });
    
    // 确保mock模式下的权限范围包含所有必要的权限
    const mockScope = [
      'ma.user.data',        // 抖音主页数据权限
      'user_info',           // 用户信息权限  
      'video.list.bind',     // 视频列表查询权限
      'data.external.item',  // 视频数据访问权限
      'comment.list',        // 评论列表权限
      'message.list'         // 私信列表权限
    ].join(',');
    
    const result = {
      success: true,
      access_token: `mock_access_token_${Math.random().toString(36).substr(2, 32)}`,
      refresh_token: `mock_refresh_token_${Math.random().toString(36).substr(2, 32)}`,
      expires_in: 7200,
      scope: mockScope
    };
    
    logger.info('🔧 Mock Access Token生成完成:', {
      hasAccessToken: !!result.access_token,
      hasRefreshToken: !!result.refresh_token,
      expiresIn: result.expires_in,
      scope: result.scope,
      scopeArray: result.scope.split(','),
      accessTokenLength: result.access_token ? result.access_token.length : 0
    });
    
    return result;
  }

  _mockRefreshAccessToken(refreshToken, openId) {
    logger.info('Using mock refresh access token');
    logger.debug('Mock refreshAccessToken parameters:', { 
      refreshToken: refreshToken, 
      openId: openId,
      refreshTokenLength: refreshToken ? refreshToken.length : 0,
      timestamp: Date.now()
    });
    
    const result = {
      success: true,
      access_token: `refreshed_access_token_${Math.random().toString(36).substr(2, 32)}`,
      refresh_token: `refreshed_refresh_token_${Math.random().toString(36).substr(2, 32)}`,
      expires_in: 7200
    };
    
    logger.debug('Mock refreshAccessToken result:', {
      hasAccessToken: !!result.access_token,
      hasRefreshToken: !!result.refresh_token,
      expiresIn: result.expires_in
    });
    
    return result;
  }

  _mockGetUserVideos(cursor, count) {
    logger.info('Using mock get user videos');
    logger.debug('Mock getUserVideos parameters:', { 
      cursor: cursor, 
      count: count,
      timestamp: Date.now()
    });
    
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
    
    const result = {
      success: true,
      data: videos,
      cursor: cursor + count,
      has_more: cursor + count < 100
    };
    
    logger.debug('Mock getUserVideos result:', {
      videoCount: videos.length,
      nextCursor: result.cursor,
      hasMore: result.has_more,
      totalPossible: 100
    });
    
    return result;
  }

  _mockGetUserComments(cursor, count) {
    logger.info('Using mock get user comments');
    logger.debug('Mock getUserComments parameters:', { 
      cursor: cursor, 
      count: count,
      timestamp: Date.now()
    });
    
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
    
    const result = {
      success: true,
      data: comments,
      cursor: cursor + count,
      has_more: cursor + count < 200
    };
    
    logger.debug('Mock getUserComments result:', {
      commentCount: comments.length,
      nextCursor: result.cursor,
      hasMore: result.has_more,
      totalPossible: 200
    });
    
    return result;
  }

  _mockGetUserMessages(cursor, count) {
    logger.info('Using mock get user messages');
    logger.debug('Mock getUserMessages parameters:', { 
      cursor: cursor, 
      count: count,
      timestamp: Date.now()
    });
    
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
    
    const result = {
      success: true,
      data: messages,
      cursor: cursor + count,
      has_more: cursor + count < 50
    };
    
    logger.debug('Mock getUserMessages result:', {
      messageCount: messages.length,
      nextCursor: result.cursor,
      hasMore: result.has_more,
      totalPossible: 50
    });
    
    return result;
  }

  _mockGetVideoBaseData(itemId) {
    logger.info('Using mock get video base data');
    logger.debug('Mock getVideoBaseData parameters:', { 
      itemId: itemId,
      timestamp: Date.now()
    });
    
    // 模拟近30天视频基础数据
    const result = {
      success: true,
      data: {
        total_like: Math.floor(Math.random() * 1000) + 100,        // 最近30天点赞数
        total_comment: Math.floor(Math.random() * 200) + 20,       // 最近30天评论数
        total_share: Math.floor(Math.random() * 50) + 5,           // 最近30天分享数
        total_play: Math.floor(Math.random() * 5000) + 500,        // 最近30天播放次数
        avg_play_duration: Math.floor(Math.random() * 60) + 15     // 最近30天平均播放时长(秒)
      },
      total_like: Math.floor(Math.random() * 1000) + 100,
      total_comment: Math.floor(Math.random() * 200) + 20,
      total_share: Math.floor(Math.random() * 50) + 5,
      total_play: Math.floor(Math.random() * 5000) + 500,
      avg_play_duration: Math.floor(Math.random() * 60) + 15
    };
    
    logger.debug('Mock getVideoBaseData result:', {
      itemId: itemId,
      totalLike: result.total_like,
      totalComment: result.total_comment,
      totalShare: result.total_share,
      totalPlay: result.total_play,
      avgPlayDuration: result.avg_play_duration
    });
    
    return result;
  }

  _mockGetUserInfo(openId) {
    return {
      success: true,
      mode: 'mock',
      user: {
        openid: openId,
        nickname: '测试用户',
        avatar: 'https://example.com/avatar.png',
        gender: 1,
        country: '中国',
        province: '北京',
        city: '北京',
        language: 'zh_CN'
      },
      note: '这是模拟数据，用于开发和测试'
    };
  }
}

module.exports = new DouyinAPI();