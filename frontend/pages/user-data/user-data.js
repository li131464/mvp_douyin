const douyinAuth = require('../../utils/login');

Page({
  data: {
    activeTab: 'videos',
    loading: false,
    
    // 视频数据
    videos: [],
    videoCursor: 0,
    videoHasMore: true,
    videoLoading: false,
    videoError: null,
    
    // 评论数据
    comments: [],
    commentCursor: 0,
    commentHasMore: true,
    commentLoading: false,
    commentError: null,
    
    // 私信数据
    messages: [],
    messageCursor: 0,
    messageHasMore: true,
    messageLoading: false,
    messageError: null,
    
    // 用户信息
    userInfo: null
  },

  onLoad() {
    console.log('用户数据页面加载');
    
    // 强制重新加载授权状态
    console.log('🔄 强制重新加载授权状态...');
    douyinAuth._loadFromStorage();
    
    // 详细的状态调试信息
    console.log('📊 OAuth授权状态详细检查:', {
      hasOAuthAuth: douyinAuth.hasOAuthAuth,
      accessToken: douyinAuth._accessToken ? douyinAuth._accessToken.substring(0, 20) + '...' : 'null',
      accessTokenLength: douyinAuth._accessToken ? douyinAuth._accessToken.length : 0,
      authorizedScopes: douyinAuth.authorizedScopes,
      scopesLength: douyinAuth.authorizedScopes ? douyinAuth.authorizedScopes.length : 0,
      openId: douyinAuth._openId ? douyinAuth._openId.substring(0, 8) + '...' : 'undefined',
      unionId: douyinAuth._unionId ? douyinAuth._unionId.substring(0, 8) + '...' : 'undefined',
      sessionKey: douyinAuth._sessionKey ? 'present' : 'missing',
      timestamp: new Date().toISOString(),
      storageCheck: this.checkStorageState()
    });
    
    // 检查授权状态
    if (!douyinAuth.hasOAuthAuth) {
      console.error('❌ OAuth授权检查失败 - 显示错误提示');
      
      // 尝试手动检查存储中的数据
      const storageData = this.checkStorageState();
      console.log('🔍 存储中的数据:', storageData);
      
      tt.showModal({
        title: 'OAuth授权状态异常',
        content: `未检测到有效的OAuth授权状态\n\n请重新进行OAuth授权\n\n调试信息:\n- Access Token: ${douyinAuth._accessToken ? '有' : '无'}\n- 权限范围: ${douyinAuth.authorizedScopes ? douyinAuth.authorizedScopes.length : 0}个`,
        showCancel: true,
        cancelText: '查看详情',
        confirmText: '重新授权',
        success: (res) => {
          if (res.confirm) {
            // 跳转回首页重新授权
        tt.navigateBack();
          } else {
            // 显示详细的调试信息
            console.table({
              'Access Token': douyinAuth._accessToken ? douyinAuth._accessToken.substring(0, 30) + '...' : 'null',
              'Token长度': douyinAuth._accessToken ? douyinAuth._accessToken.length : 0,
              'OpenID': douyinAuth._openId ? douyinAuth._openId.substring(0, 15) + '...' : 'undefined', 
              'UnionID': douyinAuth._unionId ? douyinAuth._unionId.substring(0, 15) + '...' : 'undefined',
              '权限列表': JSON.stringify(douyinAuth.authorizedScopes),
              '权限数量': douyinAuth.authorizedScopes ? douyinAuth.authorizedScopes.length : 0,
              '存储状态': storageData ? '有数据' : '无数据'
            });
          }
        }
      });
      return;
    }
    
    console.log('✅ OAuth授权状态检查通过');
    
    // 获取用户信息
    const isRealData = douyinAuth._accessToken && !douyinAuth._accessToken.includes('mock');
    this.setData({
      userInfo: douyinAuth.userInfo,
      dataSource: isRealData ? '🔴 真实数据模式' : '🟡 模拟数据模式'
    });
    
    // 根据当前标签页加载数据
    this.loadCurrentTabData();
    
    // 输出详细的调试信息
    console.log('📊 用户数据页面详细调试信息:', {
      userInfo: this.data.userInfo,
      dataSource: this.data.dataSource,
      hasOAuthAuth: douyinAuth.hasOAuthAuth,
      authorizedScopes: douyinAuth.authorizedScopes,
      scopesCount: douyinAuth.authorizedScopes ? douyinAuth.authorizedScopes.length : 0,
      scopesType: typeof douyinAuth.authorizedScopes,
      accessToken: douyinAuth._accessToken ? douyinAuth._accessToken.substring(0, 20) + '...' : 'null',
      accessTokenLength: douyinAuth._accessToken ? douyinAuth._accessToken.length : 0,
      isMockToken: douyinAuth._accessToken ? douyinAuth._accessToken.includes('mock_access_token') : false,
      openId: douyinAuth._openId ? douyinAuth._openId.substring(0, 8) + '...' : 'undefined',
      unionId: douyinAuth._unionId ? douyinAuth._unionId.substring(0, 8) + '...' : 'undefined',
      sessionKey: douyinAuth._sessionKey ? 'present' : 'missing',
      activeTab: this.data.activeTab,
      timestamp: new Date().toISOString()
    });
  },

  // 检查存储状态
  checkStorageState() {
    try {
      let storageData = null;
      if (typeof tt !== 'undefined' && tt.getStorageSync) {
        storageData = tt.getStorageSync('douyin_auth_state');
      }
      
      if (storageData) {
        const parsed = JSON.parse(storageData);
        return {
          hasData: true,
          hasAccessToken: !!parsed.accessToken,
          hasScopes: !!parsed.authorizedScopes && parsed.authorizedScopes.length > 0,
          scopesCount: parsed.authorizedScopes ? parsed.authorizedScopes.length : 0,
          hasOpenId: !!parsed.openId,
          tokenLength: parsed.accessToken ? parsed.accessToken.length : 0
        };
      } else {
        return { hasData: false };
      }
    } catch (error) {
      console.error('检查存储状态失败:', error);
      return { hasData: false, error: error.message };
    }
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    
    if (tab === this.data.activeTab) return;
    
    this.setData({
      activeTab: tab
    });
    
    this.loadCurrentTabData();
  },

  // 加载当前标签页数据
  loadCurrentTabData() {
    const { activeTab } = this.data;
    
    switch (activeTab) {
      case 'videos':
        if (this.data.videos.length === 0) {
          this.loadVideos();
        }
        break;
      case 'comments':
        if (this.data.comments.length === 0) {
          this.loadComments();
        }
        break;
      case 'messages':
        if (this.data.messages.length === 0) {
          this.loadMessages();
        }
        break;
    }
  },

  // 加载视频数据
  async loadVideos(loadMore = false) {
    if (this.data.videoLoading || (!loadMore && !this.data.videoHasMore && this.data.videos.length > 0)) {
      return;
    }

    this.setData({
      videoLoading: true,
      loading: !loadMore && this.data.videos.length === 0,
      videoError: null
    });

    try {
      const cursor = loadMore ? this.data.videoCursor : 0;
      
      console.log('📊 请求视频数据详情:', {
        loadMore: loadMore,
        cursor: cursor,
        count: 10,
        currentVideoCount: this.data.videos.length,
        hasOAuthAuth: douyinAuth.hasOAuthAuth,
        accessTokenPrefix: douyinAuth._accessToken ? douyinAuth._accessToken.substring(0, 8) + '...' : 'undefined',
        isMockToken: douyinAuth._accessToken ? douyinAuth._accessToken.includes('mock_access_token') : false,
        authorizedScopes: douyinAuth.authorizedScopes,
        timestamp: new Date().toISOString()
      });
      
      const result = await douyinAuth.getUserVideos(cursor, 10);
      
      console.log('📊 视频数据响应详情:', {
        success: result.success,
        dataCount: result.data ? result.data.length : 0,
        cursor: result.cursor,
        hasMore: result.hasMore,
        mode: result.mode || 'unknown',
        errorMessage: result.message,
        timestamp: new Date().toISOString()
      });
      
      if (result.success) {
        const newVideos = loadMore ? 
          [...this.data.videos, ...result.data] : 
          result.data;
          
        this.setData({
          videos: newVideos,
          videoCursor: result.cursor,
          videoHasMore: result.hasMore,
          videoError: null
        });
        
        console.log(`加载了 ${result.data.length} 个视频，总计 ${newVideos.length} 个`);
      }
    } catch (error) {
      console.error('❌ 加载视频失败详情:', {
        errorMessage: error.message,
        errorCode: error.code,
        isPermissionError: error.isPermissionError,
        apiError: error.apiError,
        status: error.status,
        response: error.response?.data,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      let errorMsg = error.message || '加载视频失败';
      
      // 处理权限相关错误，提供更详细的解决建议
      if (error.isPermissionError || errorMsg.includes('401') || errorMsg.includes('权限')) {
        errorMsg = '权限验证失败，请重新进行OAuth授权：\n\n1. 返回首页重新进行数据授权\n2. 确保申请了视频查看权限\n3. 检查网络连接状态';
        
        // 显示详细的权限错误对话框
        tt.showModal({
          title: '权限验证失败',
          content: errorMsg,
          showCancel: true,
          cancelText: '我知道了',
          confirmText: '重新授权',
          success: (res) => {
            if (res.confirm) {
              // 跳转回首页重新授权
              tt.navigateBack();
            }
          }
        });
      } else {
        // 普通错误处理
        this.setData({
          videoError: errorMsg
        });
        
        // 只在非网络错误时显示toast
        if (!errorMsg.includes('网络')) {
          tt.showToast({
            title: errorMsg,
            icon: 'none'
          });
        }
      }
    } finally {
      this.setData({
        videoLoading: false,
        loading: false
      });
    }
  },

  // 加载评论数据
  async loadComments(loadMore = false) {
    if (this.data.commentLoading || (!loadMore && !this.data.commentHasMore && this.data.comments.length > 0)) {
      return;
    }

    this.setData({
      commentLoading: true,
      loading: !loadMore && this.data.comments.length === 0,
      commentError: null
    });

    try {
      const cursor = loadMore ? this.data.commentCursor : 0;
      const result = await douyinAuth.getUserComments(cursor, 15);
      
      if (result.success) {
        const newComments = loadMore ? 
          [...this.data.comments, ...result.data] : 
          result.data;
          
        this.setData({
          comments: newComments,
          commentCursor: result.cursor,
          commentHasMore: result.hasMore,
          commentError: null
        });
        
        console.log(`加载了 ${result.data.length} 条评论，总计 ${newComments.length} 条`);
      }
    } catch (error) {
      console.error('加载评论失败:', error);
      
      const errorMsg = error.message || '加载评论失败';
      this.setData({
        commentError: errorMsg
      });
      
      // 只在非网络错误时显示toast
      if (!errorMsg.includes('网络')) {
        tt.showToast({
          title: errorMsg,
          icon: 'none'
        });
      }
    } finally {
      this.setData({
        commentLoading: false,
        loading: false
      });
    }
  },

  // 加载私信数据
  async loadMessages(loadMore = false) {
    if (this.data.messageLoading || (!loadMore && !this.data.messageHasMore && this.data.messages.length > 0)) {
      return;
    }

    this.setData({
      messageLoading: true,
      loading: !loadMore && this.data.messages.length === 0,
      messageError: null
    });

    try {
      const cursor = loadMore ? this.data.messageCursor : 0;
      const result = await douyinAuth.getUserMessages(cursor, 20);
      
      if (result.success) {
        const newMessages = loadMore ? 
          [...this.data.messages, ...result.data] : 
          result.data;
          
        this.setData({
          messages: newMessages,
          messageCursor: result.cursor,
          messageHasMore: result.hasMore,
          messageError: null
        });
        
        console.log(`加载了 ${result.data.length} 条私信，总计 ${newMessages.length} 条`);
      }
    } catch (error) {
      console.error('加载私信失败:', error);
      
      const errorMsg = error.message || '加载私信失败';
      this.setData({
        messageError: errorMsg
      });
      
      // 只在非网络错误时显示toast
      if (!errorMsg.includes('网络')) {
        tt.showToast({
          title: errorMsg,
          icon: 'none'
        });
      }
    } finally {
      this.setData({
        messageLoading: false,
        loading: false
      });
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    console.log('下拉刷新');
    
    const { activeTab } = this.data;
    
    try {
      switch (activeTab) {
        case 'videos':
          await this.loadVideos(false);
          break;
        case 'comments':
          await this.loadComments(false);
          break;
        case 'messages':
          await this.loadMessages(false);
          break;
      }
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      tt.stopPullDownRefresh();
    }
  },

  // 上拉加载更多
  onReachBottom() {
    console.log('触底加载更多');
    
    const { activeTab } = this.data;
    
    switch (activeTab) {
      case 'videos':
        if (this.data.videoHasMore) {
          this.loadVideos(true);
        }
        break;
      case 'comments':
        if (this.data.commentHasMore) {
          this.loadComments(true);
        }
        break;
      case 'messages':
        if (this.data.messageHasMore) {
          this.loadMessages(true);
        }
        break;
    }
  },

  // 查看视频详情
  viewVideoDetail(e) {
    const { index } = e.currentTarget.dataset;
    const video = this.data.videos[index];
    
    tt.showModal({
      title: '视频详情',
      content: `标题：${video.title}\n播放量：${this.formatNumber(video.statistics.play_count)}\n点赞量：${this.formatNumber(video.statistics.digg_count)}\n评论量：${this.formatNumber(video.statistics.comment_count)}\n时长：${this.formatDuration(video.duration)}\n发布时间：${this.formatTime(video.create_time)}`,
      showCancel: false
    });
  },

  // 查看评论详情
  viewCommentDetail(e) {
    const { index } = e.currentTarget.dataset;
    const comment = this.data.comments[index];
    
    tt.showModal({
      title: '评论详情',
      content: `内容：${comment.text}\n点赞量：${comment.digg_count}\n回复量：${comment.reply_count}\n视频：${comment.item_title}\n发布时间：${this.formatTime(comment.create_time)}`,
      showCancel: false
    });
  },

  // 查看私信详情
  viewMessageDetail(e) {
    const { index } = e.currentTarget.dataset;
    const message = this.data.messages[index];
    
    tt.showModal({
      title: '私信详情',
      content: `发送者：${message.from_user.nickname}\n内容：${message.content}\n时间：${this.formatTime(message.create_time)}`,
      showCancel: false
    });
  },

  // 格式化数字
  formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    return num.toString();
  },

  // 格式化时长
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  // 格式化时间
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return Math.floor(diff / 60000) + '分钟前';
    } else if (diff < 86400000) { // 1天内
      return Math.floor(diff / 3600000) + '小时前';
    } else if (diff < 2592000000) { // 30天内
      return Math.floor(diff / 86400000) + '天前';
    } else {
      return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
    }
  },

  // 返回首页
  goBack() {
    tt.navigateBack();
  },

  /**
   * 测试获取用户信息 - 使用user_info权限
   */
  async testGetUserInfo() {
    try {
      console.log('🔍 开始测试user_info权限...');
      
      // 首先重新检查授权状态
      console.log('🔄 重新检查授权状态...');
      douyinAuth._loadFromStorage();
      
      // 输出当前状态详情
      console.log('📊 当前授权状态详情:', {
        hasOAuthAuth: douyinAuth.hasOAuthAuth,
        hasAccessToken: !!douyinAuth._accessToken,
        accessTokenLength: douyinAuth._accessToken ? douyinAuth._accessToken.length : 0,
        accessTokenPrefix: douyinAuth._accessToken ? douyinAuth._accessToken.substring(0, 20) + '...' : 'null',
        hasOpenId: !!douyinAuth._openId,
        openIdPrefix: douyinAuth._openId ? douyinAuth._openId.substring(0, 8) + '...' : 'undefined',
        authorizedScopes: douyinAuth.authorizedScopes,
        scopesLength: douyinAuth.authorizedScopes ? douyinAuth.authorizedScopes.length : 0,
        hasUserInfoScope: douyinAuth.authorizedScopes ? douyinAuth.authorizedScopes.includes('user_info') : false
      });
      
      // 如果没有基本的token或openId，显示错误
      if (!douyinAuth._accessToken || !douyinAuth._openId) {
        console.error('❌ 缺少基本的授权信息');
        tt.showModal({
          title: '权限测试失败',
          content: `缺少基本的授权信息：\n\n- Access Token: ${douyinAuth._accessToken ? '有' : '无'}\n- OpenID: ${douyinAuth._openId ? '有' : '无'}\n\n请重新进行OAuth授权`,
          showCancel: false,
          confirmText: '重新授权',
          success: () => {
            tt.navigateBack();
          }
        });
        return;
      }
      
      // 即使OAuth状态检查失败，也尝试调用API（可能是状态同步问题）
      if (!douyinAuth.hasOAuthAuth) {
        console.warn('⚠️ OAuth状态检查失败，但仍尝试调用API...');
        tt.showModal({
          title: '状态异常但继续测试',
          content: '检测到OAuth状态异常，但检测到有效的Token，是否继续测试user_info权限？',
          showCancel: true,
          cancelText: '取消',
          confirmText: '继续测试',
          success: async (res) => {
            if (res.confirm) {
              await this.forceTestUserInfo();
            }
          }
        });
        return;
      }
      
      // 显示加载状态
      tt.showLoading({
        title: '获取用户信息中...'
      });
      
      const result = await douyinAuth.getUserInfo();
      
      tt.hideLoading();
      
      if (result.success) {
        console.log('✅ user_info权限测试成功:', result);
        
        // 更新页面数据
        this.setData({
          userInfo: result.user
        });
        
        tt.showToast({
          title: 'user_info权限有效！',
          icon: 'success'
        });
        
        // 输出详细信息到控制台
        console.log('📊 用户信息详情:', {
          nickname: result.user.nickname,
          avatar: result.user.avatar,
          gender: result.user.gender,
          location: `${result.user.country}-${result.user.province}-${result.user.city}`,
          mode: result.mode
        });
        
      } else {
        tt.showToast({
          title: '获取用户信息失败',
          icon: 'none'
        });
      }
      
    } catch (error) {
      tt.hideLoading();
      
      console.error('❌ user_info权限测试失败:', error);
      
      let errorMessage = 'user_info权限测试失败';
      if (error.isPermissionError) {
        errorMessage = 'user_info权限不足';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      tt.showModal({
        title: '权限测试失败',
        content: `${errorMessage}\n\n错误详情: ${error.message || '未知错误'}\n\n是否查看详细调试信息？`,
        showCancel: true,
        cancelText: '我知道了',
        confirmText: '查看详情',
        success: (res) => {
          if (res.confirm) {
            // 输出详细错误信息
            console.table({
              '错误类型': error.name || 'Error',
              '错误消息': error.message || '未知',
              '是否权限错误': error.isPermissionError ? '是' : '否',
              'HTTP状态': error.status || '未知',
              '当前Token': douyinAuth._accessToken ? douyinAuth._accessToken.substring(0, 30) + '...' : '无',
              '当前OpenID': douyinAuth._openId ? douyinAuth._openId.substring(0, 15) + '...' : '无',
              '权限列表': JSON.stringify(douyinAuth.authorizedScopes || [])
            });
          }
        }
      });
    }
  },

  /**
   * 强制测试用户信息API - 忽略OAuth状态检查
   */
  async forceTestUserInfo() {
    try {
      console.log('🚀 强制测试user_info权限（忽略OAuth状态检查）...');
      
      tt.showLoading({
        title: '强制测试中...'
      });
      
      // 直接调用后端API，绕过前端的OAuth状态检查
      const result = await douyinAuth._callBackendAPI('/api/douyin/user-info', {
        method: 'POST',
        body: {
          openId: douyinAuth._openId
        }
      });
      
      tt.hideLoading();
      
      console.log('🎉 强制测试成功:', result);
      
      // 更新页面数据
      this.setData({
        userInfo: result.user
      });
      
      tt.showToast({
        title: '强制测试成功！user_info权限有效',
        icon: 'success'
      });
      
    } catch (error) {
      tt.hideLoading();
      
      console.error('❌ 强制测试失败:', error);
      
      tt.showToast({
        title: `强制测试失败: ${error.message}`,
        icon: 'none',
        duration: 3000
      });
    }
  },
}); 