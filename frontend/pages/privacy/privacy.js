Page({
  data: {
    updateTime: new Date().toLocaleDateString('zh-CN'),
    effectiveTime: '2024-01-01'
  },

  onLoad() {
    console.log('Privacy policy page loaded');
    
    // 记录用户查看隐私政策的行为
    console.log('📖 用户查看隐私保护指引:', {
      timestamp: new Date().toISOString(),
      userAgent: tt.getSystemInfoSync()
    });
  },

  onShow() {
    // 记录隐私政策展示事件
    tt.reportAnalytics('privacy_policy_viewed', {
      timestamp: Date.now()
    });
  }
}); 