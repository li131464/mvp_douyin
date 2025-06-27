App({
  // todo list数组，如果storage没有缓存默认读取这个值
  todos: [
    {
      text: "学习 Javascript",
      completed: true,
    },
    {
      text: "学习 ES2016",
      completed: true,
    },
    {
      text: "学习 抖音小程序",
      completed: false,
    },
  ],

  userInfo: null,

  /**
   * @description: 调用tt.getUserProfile获取用户信息，返回一个Promise对象
   * @return {Promise}
   */
  getUserProfile() {
    return new Promise((resolve, reject) => {
      if (this.userInfo) {
        resolve(this.userInfo);
        return;
      }
      tt.getUserProfile({
        success: (res) => {
          console.log(res);
          this.userInfo = res.userInfo;
          resolve(this.userInfo);
        },
        fail: (err) => {
          reject(err);
        },
      });
    });
  },

  onLaunch() {
    try {
      const storage = tt.getStorageSync("todos");
      if (Array.isArray(storage)) {
        this.todos = storage;
      }
    } catch (err) {
      console.log(err);
    }
  },
})
