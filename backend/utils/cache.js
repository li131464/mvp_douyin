const NodeCache = require('node-cache');
const logger = require('./logger');

class CacheManager {
  constructor() {
    // 内存缓存，TTL默认1小时
    this.cache = new NodeCache({
      stdTTL: 3600,
      checkperiod: 600, // 每10分钟检查过期键
      useClones: false
    });
    
    // 监听缓存事件
    this.cache.on('set', (key, value) => {
      logger.debug(`Cache SET: ${key}`);
    });
    
    this.cache.on('del', (key, value) => {
      logger.debug(`Cache DEL: ${key}`);
    });
    
    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache EXPIRED: ${key}`);
    });
  }

  /**
   * 设置缓存
   */
  async set(key, value, ttl = null) {
    try {
      if (ttl) {
        return this.cache.set(key, value, ttl);
      }
      return this.cache.set(key, value);
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * 获取缓存
   */
  async get(key) {
    try {
      return this.cache.get(key);
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   */
  async del(key) {
    try {
      return this.cache.del(key);
    } catch (error) {
      logger.error('Cache del error:', error);
      return false;
    }
  }

  /**
   * 检查缓存是否存在
   */
  async has(key) {
    try {
      return this.cache.has(key);
    } catch (error) {
      logger.error('Cache has error:', error);
      return false;
    }
  }

  /**
   * 清空所有缓存
   */
  async flush() {
    try {
      this.cache.flushAll();
      logger.info('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return this.cache.getStats();
  }
}

module.exports = new CacheManager(); 