const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const douyinApi = require('../utils/douyinApi');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/code2session
 * 小程序登录，code换取session
 */
router.post('/code2session', asyncHandler(async (req, res) => {
  const { code } = req.body;
  
  // 记录请求详情
  logger.debug('Code2session request details:', {
    code: code,
    hasCode: !!code,
    codeLength: code ? code.length : 0,
    requestHeaders: req.headers,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin') || 'No-Origin',
    ip: req.ip,
    contentType: req.get('Content-Type')
  });
  
  if (!code) {
    logger.warn('Code2session failed - missing code parameter');
    return res.status(400).json({
      success: false,
      message: '缺少登录凭证code',
      code: 'MISSING_CODE'
    });
  }
  
  logger.info('Code2session request:', { code });
  logger.debug('Environment info:', {
    nodeEnv: process.env.NODE_ENV,
    hasAppId: !!process.env.DOUYIN_APP_ID,
    hasAppSecret: !!process.env.DOUYIN_APP_SECRET,
    logLevel: process.env.LOG_LEVEL || 'info'
  });
  
  try {
    const startTime = Date.now();
    const result = await douyinApi.code2session(code);
    const duration = Date.now() - startTime;
    
    logger.debug('Code2session API call completed:', {
      duration: `${duration}ms`,
      success: result.success,
      hasOpenid: !!result.openid,
      hasUnionid: !!result.unionid,
      hasSessionKey: !!result.session_key
    });
    
    if (result.success) {
      // 缓存session信息
      const sessionKey = `session:${result.openid}`;
      const sessionData = {
        openid: result.openid,
        unionid: result.unionid,
        session_key: result.session_key,
        created_at: Date.now()
      };
      
      await cache.set(sessionKey, sessionData, 7200); // 2小时过期
      
      logger.info('Code2session success:', { openid: result.openid });
      logger.debug('Session cached:', { 
        sessionKey, 
        hasUnionid: !!result.unionid,
        expiresIn: 7200 
      });
      
      res.json({
        success: true,
        openid: result.openid,
        unionid: result.unionid,
        session_key: result.session_key
      });
    } else {
      logger.error('Code2session API returned failure result:', result);
      res.status(400).json({
        success: false,
        message: '登录失败',
        code: 'LOGIN_FAILED'
      });
    }
  } catch (error) {
    logger.error('Code2session error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno
    });
    res.status(500).json({
      success: false,
      message: '登录服务异常',
      code: 'LOGIN_SERVICE_ERROR'
    });
  }
}));

/**
 * POST /api/auth/get-access-token
 * OAuth授权，ticket换取access_token
 */
router.post('/get-access-token', asyncHandler(async (req, res) => {
  const { ticket, openId } = req.body;
  
  // 记录请求详情
  logger.debug('Get access token request details:', {
    ticket: ticket,
    openId: openId,
    hasTicket: !!ticket,
    hasOpenId: !!openId,
    ticketLength: ticket ? ticket.length : 0,
    requestHeaders: req.headers,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin') || 'No-Origin',
    ip: req.ip,
    contentType: req.get('Content-Type')
  });
  
  if (!ticket || !openId) {
    logger.warn('Get access token failed - missing parameters:', {
      hasTicket: !!ticket,
      hasOpenId: !!openId
    });
    return res.status(400).json({
      success: false,
      message: '缺少必要参数',
      code: 'MISSING_PARAMETERS'
    });
  }
  
  logger.info('Get access token request:', { ticket, openId });
  logger.debug('Environment info for access token:', {
    nodeEnv: process.env.NODE_ENV,
    hasAppId: !!process.env.DOUYIN_APP_ID,
    hasAppSecret: !!process.env.DOUYIN_APP_SECRET,
    logLevel: process.env.LOG_LEVEL || 'info'
  });
  
  try {
    const startTime = Date.now();
    const result = await douyinApi.getAccessToken(ticket, openId);
    const duration = Date.now() - startTime;
    
    logger.debug('Get access token API call completed:', {
      duration: `${duration}ms`,
      success: result.success,
      hasAccessToken: !!result.access_token,
      hasRefreshToken: !!result.refresh_token,
      expiresIn: result.expires_in,
      scope: result.scope
    });
    
    if (result.success) {
      // 缓存access_token信息
      const tokenKey = `access_token:${openId}`;
      const tokenData = {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        scope: result.scope,
        created_at: Date.now()
      };
      
      await cache.set(tokenKey, tokenData, result.expires_in - 300); // 提前5分钟过期
      
      logger.info('Get access token success:', { openId });
      logger.debug('Access token cached:', { 
        tokenKey, 
        expiresIn: result.expires_in - 300,
        scope: result.scope 
      });
      
      res.json({
        success: true,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        scope: result.scope
      });
    } else {
      logger.error('Get access token API returned failure result:', result);
      res.status(400).json({
        success: false,
        message: '获取访问令牌失败',
        code: 'GET_TOKEN_FAILED'
      });
    }
  } catch (error) {
    logger.error('Get access token error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errno: error.errno,
      ticket: ticket,
      openId: openId
    });
    res.status(500).json({
      success: false,
      message: '授权服务异常',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
}));

/**
 * POST /api/auth/refresh-token
 * 刷新access_token
 */
router.post('/refresh-token', asyncHandler(async (req, res) => {
  const { refreshToken, openId } = req.body;
  
  if (!refreshToken || !openId) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数',
      code: 'MISSING_PARAMETERS'
    });
  }
  
  logger.info('Refresh token request:', { openId });
  
  try {
    const result = await douyinApi.refreshAccessToken(refreshToken, openId);
    
    if (result.success) {
      // 更新缓存
      const tokenKey = `access_token:${openId}`;
      await cache.set(tokenKey, {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        created_at: Date.now()
      }, result.expires_in - 300);
      
      logger.info('Refresh token success:', { openId });
      
      res.json({
        success: true,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in
      });
    } else {
      res.status(400).json({
        success: false,
        message: '刷新令牌失败',
        code: 'REFRESH_TOKEN_FAILED'
      });
    }
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: '刷新令牌服务异常',
      code: 'REFRESH_SERVICE_ERROR'
    });
  }
}));

/**
 * GET /api/auth/session/:openId
 * 获取session信息
 */
router.get('/session/:openId', asyncHandler(async (req, res) => {
  const { openId } = req.params;
  
  const sessionKey = `session:${openId}`;
  const sessionData = await cache.get(sessionKey);
  
  if (sessionData) {
    res.json({
      success: true,
      data: {
        openid: sessionData.openid,
        unionid: sessionData.unionid,
        created_at: sessionData.created_at
      }
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Session not found',
      code: 'SESSION_NOT_FOUND'
    });
  }
}));

/**
 * GET /api/auth/debug/:openId
 * 调试OAuth授权状态
 */
router.get('/debug/:openId', asyncHandler(async (req, res) => {
  const { openId } = req.params;
  
  logger.info('OAuth调试请求:', { openId });
  
  try {
    // 获取session信息
    const sessionKey = `session:${openId}`;
    const sessionData = await cache.get(sessionKey);
    
    // 获取access_token信息
    const tokenKey = `access_token:${openId}`;
    const tokenData = await cache.get(tokenKey);
    
    const debugInfo = {
      openId: openId,
      hasSession: !!sessionData,
      hasAccessToken: !!tokenData,
      sessionInfo: sessionData ? {
        openid: sessionData.openid,
        hasUnionid: !!sessionData.unionid,
        hasSessionKey: !!sessionData.session_key,
        createdAt: new Date(sessionData.created_at).toLocaleString('zh-CN')
      } : null,
      tokenInfo: tokenData ? {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        createdAt: new Date(tokenData.created_at).toLocaleString('zh-CN'),
        expiresAt: new Date(tokenData.created_at + tokenData.expires_in * 1000).toLocaleString('zh-CN'),
        isExpired: Date.now() > (tokenData.created_at + tokenData.expires_in * 1000)
      } : null,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAppId: !!process.env.DOUYIN_APP_ID,
        hasAppSecret: !!process.env.DOUYIN_APP_SECRET,
        logLevel: process.env.LOG_LEVEL || 'info'
      },
      timestamp: new Date().toLocaleString('zh-CN')
    };
    
    logger.debug('OAuth调试信息:', debugInfo);
    
    res.json({
      success: true,
      data: debugInfo
    });
  } catch (error) {
    logger.error('OAuth调试失败:', error);
    res.status(500).json({
      success: false,
      message: 'OAuth调试失败',
      code: 'DEBUG_ERROR'
    });
  }
}));

module.exports = router; 