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
  
  req.accessToken = tokenData.access_token;
  req.openId = openId;
  req.tokenScope = tokenData.scope;
  
  logger.debug('access_token验证成功', {
    openId: openId,
    hasAccessToken: !!req.accessToken,
    scope: req.tokenScope
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
  
  // 检查权限scope
  const requiredScopes = ['video.list.bind', 'data.external.item'];
  const hasRequiredScope = requiredScopes.some(scope => {
    if (typeof tokenScope === 'string') {
      return tokenScope.includes(scope);
    } else if (Array.isArray(tokenScope)) {
      return tokenScope.includes(scope);
    }
    return false;
  });
  
  if (!hasRequiredScope) {
    logger.error('权限不足：缺少视频访问权限', { 
      tokenScope: tokenScope, 
      requiredScopes: requiredScopes 
    });
    return res.status(403).json({
      success: false,
      message: '权限不足，需要视频访问权限',
      code: 'INSUFFICIENT_PERMISSIONS',
      required_scopes: requiredScopes,
      current_scope: tokenScope
    });
  }
  
  try {
    const result = await douyinApi.getUserVideos(accessToken, openId, cursor, count);
    
    if (result.success) {
      logger.info('Get user videos success:', { 
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
    if (error.response?.status === 401 || 
        (error.message && error.message.includes('28001'))) {
      return res.status(401).json({
        success: false,
        message: '访问令牌无效或权限不足',
        code: 'TOKEN_OR_PERMISSION_ERROR',
        details: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取视频服务异常',
      code: 'VIDEO_SERVICE_ERROR'
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

module.exports = router; 