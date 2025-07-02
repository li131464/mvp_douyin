Component({
  data: {
    miniprogramName: '抖音数据获取小程序',
    show: false,
    showPrivacy: false
  },
  
  properties: {
    // 是否自动显示弹窗
    auto: {
      type: Boolean,
      value: true
    },
    // 手动控制显示弹窗
    show: {
      type: Boolean,
      value: false,
      observer(newVal) {
        this.setData({
          showPrivacy: newVal
        });
      }
    }
  },
  
  lifetimes: {
    attached() {
      const that = this;
      
      // 监听隐私接口需要用户授权事件
      if (tt.onNeedPrivacyAuthorization) {
        tt.onNeedPrivacyAuthorization((resolve, eventInfo) => {
          console.log('🔐 隐私授权需求触发:', {
            referrer: eventInfo.referrer,
            timestamp: new Date().toISOString()
          });
          
          // 保存resolve回调
          that.resolvePrivacyAuthorization = resolve;
          
          // 显示隐私授权弹窗
          that.setData({
            showPrivacy: true
          });
        });
      }
      
      // 如果开启自动模式，检查隐私设置
      if (this.data.auto) {
        this.checkPrivacySetting();
      }
    }
  },
  
  methods: {
    /**
     * 检查隐私设置
     */
    checkPrivacySetting() {
      if (tt.getPrivacySetting) {
        tt.getPrivacySetting({
          success: (res) => {
            console.log('📋 隐私设置检查结果:', res);
            
            // 如果用户未授权，显示弹窗
            if (res.needAuthorization) {
              this.setData({
                showPrivacy: true
              });
            }
          },
          fail: (err) => {
            console.error('❌ 获取隐私设置失败:', err);
          }
        });
      }
    },
    
    /**
     * 用户同意隐私授权
     */
    handleAgreePrivacyAuthorization() {
      console.log('✅ 用户同意隐私授权');
      
      // 如果有待处理的授权回调，通知平台用户已同意
      if (this.resolvePrivacyAuthorization) {
        this.resolvePrivacyAuthorization({
          buttonId: 'agree-btn',
          event: 'agree'
        });
        this.resolvePrivacyAuthorization = null;
      }
      
      // 隐藏弹窗
      this.setData({
        showPrivacy: false
      });
      
      // 触发同意事件
      this.triggerEvent('agree', {
        timestamp: Date.now()
      });
    },
    
    /**
     * 用户拒绝隐私授权
     */
    handleDisagreePrivacyAuthorization() {
      console.log('❌ 用户拒绝隐私授权');
      
      // 如果有待处理的授权回调，通知平台用户已拒绝
      if (this.resolvePrivacyAuthorization) {
        this.resolvePrivacyAuthorization({
          event: 'disagree'
        });
        this.resolvePrivacyAuthorization = null;
      }
      
      // 隐藏弹窗
      this.setData({
        showPrivacy: false
      });
      
      // 触发拒绝事件
      this.triggerEvent('disagree', {
        timestamp: Date.now()
      });
    },
    
    /**
     * 打开隐私协议
     */
    openPrivacyContract() {
      if (tt.openPrivacyContract) {
        tt.openPrivacyContract({
          success: () => {
            console.log('✅ 打开隐私协议成功');
          },
          fail: (err) => {
            console.error('❌ 打开隐私协议失败:', err);
            // 降级到内置隐私页面
            tt.navigateTo({
              url: '/pages/privacy/privacy'
            });
          }
        });
      } else {
        // API不存在时降级处理
        tt.navigateTo({
          url: '/pages/privacy/privacy'
        });
      }
    },
    
    /**
     * 关闭弹窗（背景点击）
     */
    onMaskTap() {
      // 不允许点击背景关闭，用户必须做出选择
      return;
    }
  }
}); 