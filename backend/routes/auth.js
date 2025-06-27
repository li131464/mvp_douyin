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
  
  if (!code) {
    return res.status(400).json({
      success: false,
      message: '缺少登录凭证code',
      code: 'MISSING_CODE'
    });
  }
  
  logger.info('Code2session request:', { code });
  
  try {
    const result = await douyinApi.code2session(code);
    
    if (result.success) {
      // 缓存session信息
      const sessionKey = `session:${result.openid}`;
      await cache.set(sessionKey, {
        openid: result.openid,
        unionid: result.unionid,
        session_key: result.session_key,
        created_at: Date.now()
      }, 7200); // 2小时过期
      
      logger.info('Code2session success:', { openid: result.openid });
      
      res.json({
        success: true,
        openid: result.openid,
        unionid: result.unionid,
        session_key: result.session_key
      });
    } else {
      res.status(400).json({
        success: false,
        message: '登录失败',
        code: 'LOGIN_FAILED'
      });
    }
  } catch (error) {
    logger.error('Code2session error:', error);
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
  
  if (!ticket || !openId) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数',
      code: 'MISSING_PARAMETERS'
    });
  }
  
  logger.info('Get access token request:', { ticket, openId });
  
  try {
    const result = await douyinApi.getAccessToken(ticket, openId);
    
    if (result.success) {
      // 缓存access_token信息
      const tokenKey = `access_token:${openId}`;
      await cache.set(tokenKey, {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        scope: result.scope,
        created_at: Date.now()
      }, result.expires_in - 300); // 提前5分钟过期
      
      logger.info('Get access token success:', { openId });
      
      res.json({
        success: true,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_in: result.expires_in,
        scope: result.scope
      });
    } else {
      res.status(400).json({
        success: false,
        message: '获取访问令牌失败',
        code: 'GET_TOKEN_FAILED'
      });
    }
  } catch (error) {
    logger.error('Get access token error:', error);
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

module.exports = router; 