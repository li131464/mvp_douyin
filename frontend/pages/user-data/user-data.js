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
    
    // 检查授权状态
    if (!douyinAuth.hasOAuthAuth) {
      tt.showToast({
        title: '请先完成OAuth授权',
        icon: 'none',
        duration: 2000
      });
      
      setTimeout(() => {
        tt.navigateBack();
      }, 2000);
      return;
    }
    
    // 获取用户信息
    const isRealData = douyinAuth._accessToken && !douyinAuth._accessToken.includes('mock');
    this.setData({
      userInfo: douyinAuth.userInfo,
      dataSource: isRealData ? '🔴 真实数据模式' : '🟡 模拟数据模式'
    });
    
    // 根据当前标签页加载数据
    this.loadCurrentTabData();
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
      const result = await douyinAuth.getUserVideos(cursor, 10);
      
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
      console.error('加载视频失败:', error);
      
      const errorMsg = error.message || '加载视频失败';
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
  }
}); 