const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const douyinApi = require('../utils/douyinApi');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * 验证access_token中间件
 */
const verifyAccessToken = asyncHandler(async (req, res, next) => {
  const { openId } = req.body;
  
  logger.debug('验证access_token中间件，openId:', openId);
  
  if (!openId) {
    logger.warn('access_token验证失败：缺少openId参数');
    return res.status(400).json({
      success: false,
      message: '缺少openId参数',
      code: 'MISSING_OPEN_ID'
    });
  }
  
  // 从缓存获取access_token
  const tokenKey = `access_token:${openId}`;
  const tokenData = await cache.get(tokenKey);
  
  logger.debug('从缓存获取token结果:', {
    tokenKey: tokenKey,
    hasToken: !!tokenData,
    hasAccessToken: !!(tokenData && tokenData.access_token),
    scope: tokenData ? tokenData.scope : null
  });
  
  if (!tokenData || !tokenData.access_token) {
    logger.error('access_token验证失败：令牌无效或已过期', {
      hasTokenData: !!tokenData,
      hasAccessToken: !!(tokenData && tokenData.access_token)
    });
    return res.status(401).json({
      success: false,
      message: '访问令牌无效或已过期',
      code: 'INVALID_ACCESS_TOKEN'
    });
  }
  
  // 设置req.auth对象，统一格式
  req.auth = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    scope: tokenData.scope,
    expires_in: tokenData.expires_in,
    created_at: tokenData.created_at
  };
  
  // 兼容旧的属性名
  req.accessToken = tokenData.access_token;
  req.openId = openId;
  req.tokenScope = tokenData.scope;
  
  logger.debug('access_token验证成功', {
    openId: openId,
    hasAccessToken: !!req.auth.access_token,
    scope: req.auth.scope,
    authObjectKeys: Object.keys(req.auth)
  });
  
  next();
});

/**
 * POST /api/douyin/user-videos
 * 获取用户视频列表
 */
router.post('/user-videos', verifyAccessToken, asyncHandler(async (req, res) => {
  const { cursor = 0, count = 20 } = req.body;
  const { accessToken, openId, tokenScope } = req;
  
  logger.info('Get user videos request:', { openId, cursor, count });
  logger.debug('Token scope:', tokenScope);
  
  // 检查权限scope - 支持小程序和网站应用权限格式
  const requiredScopes = ['ma.item.data', 'ma.user.data', 'video.list.bind', 'data.external.item'];
  const hasRequiredScope = requiredScopes.some(scope => {
    if (typeof tokenScope === 'string') {
      // 支持逗号分隔的字符串格式
      return tokenScope.split(',').some(s => s.trim() === scope);
    } else if (Array.isArray(tokenScope)) {
      return tokenScope.includes(scope);
    }
    return false;
  });
  
  // 定义权限检查函数
  const hasScope = (tokenScope, targetScope) => {
    if (typeof tokenScope === 'string') {
      return tokenScope.split(',').some(s => s.trim() === targetScope);
    } else if (Array.isArray(tokenScope)) {
      return tokenScope.includes(targetScope);
    }
    return false;
  };

  // 记录详细的权限检查信息
  logger.info('🔍 权限检查详情分析:', {
    accessTokenPrefix: accessToken ? accessToken.substring(0, 8) + '...' : 'undefined',
    accessTokenLength: accessToken ? accessToken.length : 0,
    isMockToken: accessToken ? accessToken.includes('mock_access_token') : false,
    tokenScope: tokenScope,
    tokenScopeType: typeof tokenScope,
    tokenScopeArray: typeof tokenScope === 'string' ? tokenScope.split(',') : tokenScope,
    requiredScopes: requiredScopes,
    hasRequiredScope: hasRequiredScope,
    scopeCheckResults: requiredScopes.map(scope => ({
      scope: scope,
      hasScope: hasScope(tokenScope, scope)
    })),
    openId: openId ? openId.substring(0, 8) + '...' : 'undefined',
    timestamp: new Date().toISOString()
  });
  
  if (!hasRequiredScope) {
    logger.error('权限不足：缺少视频访问权限', { 
      tokenScope: tokenScope, 
      requiredScopes: requiredScopes,
      scopeFormat: typeof tokenScope
    });
    return res.status(403).json({
      success: false,
      message: '权限不足，需要视频访问权限。请重新进行OAuth授权并申请必要的权限。',
      code: 'INSUFFICIENT_PERMISSIONS',
      required_scopes: requiredScopes,
      current_scope: tokenScope,
      help: '小程序请申请ma.item.data或ma.user.data权限；网站应用请申请video.list.bind、data.external.item权限'
    });
  }
  
  // 检测是否为mock token，如果是则直接使用mock模式
  const isMockToken = accessToken && accessToken.includes('mock_access_token');
  
  if (isMockToken) {
    logger.info('检测到Mock Token，直接使用模拟模式，不调用真实API');
    
    // 直接调用mock方法，避免使用fake token调用真实API
    const result = await douyinApi._mockGetUserVideos(cursor, count);
    
    logger.info('Mock mode user videos success:', { 
      openId, 
      count: result.data?.length || 0,
      cursor: result.cursor,
      hasMore: result.has_more,
      mode: 'mock'
    });
    
    return res.json({
      success: true,
      data: result.data,
      cursor: result.cursor,
      has_more: result.has_more,
      mode: 'mock'
    });
  }

  try {
    const result = await douyinApi.getUserVideos(accessToken, openId, cursor, count);
    
    if (result.success) {
      logger.info('Get user videos success:', { 
        openId, 
        count: result.data?.length || 0,
        cursor: result.cursor,
        hasMore: result.has_more,
        mode: 'real'
      });
      
      res.json({
        success: true,
        data: result.data,
        cursor: result.cursor,
        has_more: result.has_more,
        mode: 'real'
      });
    } else {
      res.status(400).json({
        success: false,
        message: '获取视频列表失败',
        code: 'GET_VIDEOS_FAILED'
      });
    }
  } catch (error) {
    logger.error('Get user videos error:', error);
    
    // 判断是否是权限相关错误
    if (error.isPermissionError || 
        error.response?.status === 401 || 
        error.response?.status === 403 ||
        (error.message && (error.message.includes('28001') || error.message.includes('权限')))) {
      
      let errorMessage = '访问令牌无效或权限不足';
      let helpMessage = '请重新进行OAuth授权并申请必要的权限';
      
      // 如果是详细的权限错误，提供更具体的信息
      if (error.apiError) {
        errorMessage = error.apiError.err_msg || error.apiError.description || errorMessage;
        // 小程序API错误码
        if (error.apiError.err_no === 28001018 || error.apiError.error_code === 28001018) {
          helpMessage = '权限申请未通过或已过期，请在抖音开放平台重新申请ma.item.data权限';
        } else if (error.apiError.err_no === 28001003 || error.apiError.error_code === 28001003) {
          helpMessage = 'access_token无效，请重新获取';
        } else if (error.apiError.error_code === 2100004) {
          helpMessage = '权限申请未通过或已过期，请在抖音开放平台重新申请video.list.bind权限';
        }
      }
      
      return res.status(401).json({
        success: false,
        message: errorMessage,
        code: 'TOKEN_OR_PERMISSION_ERROR',
        help: helpMessage,
        details: error.message,
        api_error: error.apiError || null
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取视频服务异常',
      code: 'VIDEO_SERVICE_ERROR',
      details: error.message
    });
  }
}));

/**
 * POST /api/douyin/user-comments
 * 获取用户评论列表
 */
router.post('/user-comments', verifyAccessToken, asyncHandler(async (req, res) => {
  const { cursor = 0, count = 20 } = req.body;
  const { accessToken, openId } = req;
  
  logger.info('Get user comments request:', { openId, cursor, count });
  
  // 检测是否为mock token，如果是则直接使用mock模式  
  const isMockToken = accessToken && accessToken.includes('mock_access_token');
  
  if (isMockToken) {
    logger.info('检测到Mock Token，使用模拟评论数据');
  }
  
  try {
    // 模拟评论数据
    const comments = [];
    const startIndex = cursor;
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      comments.push({
        comment_id: `comment_${index}`,
        text: `这是第${index + 1}条后端API评论内容，真实数据结构`,
        create_time: Date.now() - (index * 60 * 60 * 1000),
        digg_count: Math.floor(Math.random() * 100),
        reply_count: Math.floor(Math.random() * 20),
        item_id: `video_${Math.floor(index / 5)}`,
        item_title: `后端视频${Math.floor(index / 5) + 1}的标题`,
        top: index < 5
      });
    }
    
    const result = {
      success: true,
      data: comments,
      cursor: cursor + count,
      has_more: cursor + count < 200
    };
    
    logger.info('Get user comments success:', { 
      openId, 
      count: result.data?.length || 0,
      cursor: result.cursor,
      hasMore: result.has_more
    });
    
    res.json({
      success: true,
      data: result.data,
      cursor: result.cursor,
      has_more: result.has_more
    });
  } catch (error) {
    logger.error('Get user comments error:', error);
    res.status(500).json({
      success: false,
      message: '获取评论服务异常',
      code: 'COMMENT_SERVICE_ERROR'
    });
  }
}));

/**
 * POST /api/douyin/user-messages
 * 获取用户私信列表
 */
router.post('/user-messages', verifyAccessToken, asyncHandler(async (req, res) => {
  const { cursor = 0, count = 20 } = req.body;
  const { accessToken, openId } = req;
  
  logger.info('Get user messages request:', { openId, cursor, count });
  
  // 检测是否为mock token，如果是则直接使用mock模式
  const isMockToken = accessToken && accessToken.includes('mock_access_token');
  
  if (isMockToken) {
    logger.info('检测到Mock Token，使用模拟私信数据');
  }
  
  try {
    // 模拟私信数据
    const messages = [];
    const startIndex = cursor;
    
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      messages.push({
        conversation_id: `conv_${Math.floor(index / 3)}`,
        message_id: `msg_${index}`,
        content: `这是第${index + 1}条后端API私信内容，真实数据结构`,
        message_type: 'text',
        create_time: Date.now() - (index * 30 * 60 * 1000),
        from_user: {
          open_id: `user_${Math.floor(Math.random() * 100)}`,
          nickname: `后端用户${Math.floor(Math.random() * 100)}`,
          avatar: `https://mock-avatar-${Math.floor(Math.random() * 10)}.jpg`
        },
        to_user: {
          open_id: openId,
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
    
    logger.info('Get user messages success:', { 
      openId, 
      count: result.data?.length || 0,
      cursor: result.cursor,
      hasMore: result.has_more
    });
    
    res.json({
      success: true,
      data: result.data,
      cursor: result.cursor,
      has_more: result.has_more
    });
  } catch (error) {
    logger.error('Get user messages error:', error);
    res.status(500).json({
      success: false,
      message: '获取私信服务异常',
      code: 'MESSAGE_SERVICE_ERROR'
    });
  }
}));

/**
 * POST /api/douyin/video-base-data
 * 获取视频基础数据 - 小程序专用API
 * 权限要求：ma.item.data
 */
router.post('/video-base-data', verifyAccessToken, asyncHandler(async (req, res) => {
  const { item_id } = req.body;
  const { accessToken, openId, tokenScope } = req;
  
  logger.info('Get video base data request:', { 
    openId: openId ? openId.substring(0, 8) + '...' : 'unknown',
    itemId: item_id ? item_id.substring(0, 10) + '...' : 'unknown'
  });
  
  // 检查参数
  if (!item_id) {
    return res.status(400).json({
      success: false,
      message: 'item_id is required',
      code: 'MISSING_ITEM_ID'
    });
  }
  
  // 检查权限scope - ma.item.data权限
  const requiredScopes = ['ma.item.data', 'ma.user.data'];
  const hasRequiredScope = requiredScopes.some(scope => {
    if (typeof tokenScope === 'string') {
      return tokenScope.split(',').some(s => s.trim() === scope);
    } else if (Array.isArray(tokenScope)) {
      return tokenScope.includes(scope);
    }
    return false;
  });
  
  logger.debug('视频基础数据权限检查:', {
    tokenScope: tokenScope,
    requiredScopes: requiredScopes,
    hasRequiredScope: hasRequiredScope
  });
  
  if (!hasRequiredScope) {
    logger.error('权限不足：缺少视频数据访问权限', { 
      tokenScope: tokenScope, 
      requiredScopes: requiredScopes
    });
    return res.status(403).json({
      success: false,
      message: '权限不足，需要视频数据访问权限。请申请ma.item.data权限。',
      code: 'INSUFFICIENT_PERMISSIONS',
      required_scopes: requiredScopes,
      current_scope: tokenScope,
      help: '请在抖音开放平台申请"近30天视频数据查询"能力权限'
    });
  }
  
  // 检测是否为mock token
  const isMockToken = accessToken && accessToken.includes('mock_access_token');
  
  if (isMockToken) {
    logger.info('检测到Mock Token，使用模拟视频基础数据');
    const result = douyinApi._mockGetVideoBaseData(item_id);
    
    logger.info('Get video base data success (mock):', {
      itemId: item_id.substring(0, 10) + '...',
      totalLike: result.total_like,
      totalComment: result.total_comment,
      totalShare: result.total_share,
      totalPlay: result.total_play
    });
    
    return res.json(result);
  }
  
  try {
    const result = await douyinApi.getVideoBaseData(accessToken, openId, item_id);
    
    logger.info('Get video base data success:', {
      itemId: item_id.substring(0, 10) + '...',
      totalLike: result.total_like,
      totalComment: result.total_comment,
      totalShare: result.total_share,
      totalPlay: result.total_play
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Get video base data error:', error);
    
    if (error.isPermissionError || 
        error.response?.status === 401 || 
        error.response?.status === 403 ||
        (error.message && (error.message.includes('28001') || error.message.includes('权限')))) {
      
      let errorMessage = '访问令牌无效或权限不足';
      let helpMessage = '请在抖音开放平台申请"近30天视频数据查询"能力权限';
      
      if (error.apiError) {
        errorMessage = error.apiError.err_msg || errorMessage;
        if (error.apiError.err_no === 28001018) {
          helpMessage = '权限申请未通过，请在抖音开放平台申请ma.item.data权限';
        }
      }
      
      return res.status(401).json({
        success: false,
        message: errorMessage,
        code: 'TOKEN_OR_PERMISSION_ERROR',
        help: helpMessage,
        details: error.message,
        api_error: error.apiError || null
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取视频基础数据服务异常',
      code: 'VIDEO_BASE_DATA_SERVICE_ERROR',
      details: error.message
    });
  }
}));

/**
 * GET /api/douyin/user-profile/:openId
 * 获取用户基本信息
 */
router.get('/user-profile/:openId', asyncHandler(async (req, res) => {
  const { openId } = req.params;
  
  logger.info('Get user profile request:', { openId });
  
  try {
    // 从缓存获取session信息
    const sessionKey = `session:${openId}`;
    const sessionData = await cache.get(sessionKey);
    
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: '用户session不存在',
        code: 'SESSION_NOT_FOUND'
      });
    }
    
    // 模拟用户信息
    const userProfile = {
      openid: sessionData.openid,
      unionid: sessionData.unionid,
      nickname: '抖音用户',
      avatar: '/icon.png',
      created_at: sessionData.created_at
    };
    
    logger.info('Get user profile success:', { openId });
    
    res.json({
      success: true,
      data: userProfile
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息服务异常',
      code: 'PROFILE_SERVICE_ERROR'
    });
  }
}));

/**
 * POST /api/douyin/user-info
 * 获取用户基本信息 (使用user_info权限)
 */
router.post('/user-info', verifyAccessToken, asyncHandler(async (req, res) => {
  const { openId } = req.body;
  const { access_token } = req.auth;
  
  logger.info('Get user info request:', { openId });
  logger.debug('Token scope:', req.auth.scope);
  
  // 权限检查
  logger.info('🔍 user_info权限检查详情分析:', {
    requestedScope: 'user_info',
    tokenScope: req.auth.scope,
    hasScopeField: !!req.auth.scope,
    scopeType: typeof req.auth.scope,
    scopeValue: req.auth.scope,
    hasUserInfoPermission: req.auth.scope ? req.auth.scope.includes('user_info') : false,
    openId: openId,
    hasAccessToken: !!access_token,
    accessTokenLength: access_token ? access_token.length : 0
  });
  
  try {
    const result = await douyinApi.getUserInfo(access_token, openId);
    
    logger.info('Get user info success:', {
      hasUserInfo: !!result.user,
      nickname: result.user?.nickname ? '已获取' : '未获取',
      mode: result.mode || 'real'
    });
    
    res.json({
      success: true,
      user: result.user,
      mode: result.mode
    });
  } catch (error) {
    logger.error('Get user info error:', error.message);
    
    // 处理权限错误
    if (error.isPermissionError) {
      return res.status(401).json({
        success: false,
        message: error.message,
        code: 'PERMISSION_ERROR',
        apiError: error.apiError
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      code: 'API_ERROR'
    });
  }
}));

module.exports = router; 