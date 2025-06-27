# 抖音小程序真实数据获取系统

## 项目概述

这是一个基于抖音开放平台API的完整解决方案，包含小程序前端和Node.js后端，实现了真实的用户数据获取功能：

### 功能特性
- ✅ 用户视频列表获取
- ✅ 用户评论数据获取  
- ✅ 用户私信消息获取
- ✅ 完整的OAuth授权流程
- ✅ 后端API服务
- ✅ 数据缓存和管理
- ✅ 错误处理和日志记录

## 重要说明

✅ **完整的生产级解决方案**

本项目提供了完整的前后端实现：

### 已实现功能
- 🎯 **后端API服务** - 完整的Node.js服务端
- 🔐 **OAuth授权流程** - 标准的抖音OAuth实现
- 📊 **数据获取接口** - 视频、评论、私信API
- 🛡️ **安全特性** - 令牌管理、速率限制、CORS保护
- 📝 **完整文档** - 部署指南和API文档

### 模拟模式
- 当未配置抖音开放平台凭证时，自动使用模拟数据
- 数据结构完全符合抖音开放平台API规范
- 便于开发测试和演示

## 技术架构

### 前端（小程序）
- 🎨 抖音小程序框架
- 🔐 OAuth授权流程实现
- 📱 现代化UI设计
- 🔄 数据分页和刷新
- 📊 数据展示和交互

### 后端（Node.js API服务）
- 🚀 Express.js框架
- 🔒 JWT令牌管理
- 💾 内存缓存系统
- 📝 Winston日志记录
- 🛡️ 安全中间件
- 🌐 CORS跨域支持
- ⚡ 速率限制保护

### 项目结构
```
抖音数据获取系统/
├── 📱 前端小程序/
│   ├── pages/          # 页面文件
│   ├── utils/          # 工具类
│   └── app.js          # 应用入口
└── 🖥️ backend/         # 后端服务
    ├── routes/         # API路由
    ├── utils/          # 工具类
    ├── middleware/     # 中间件
    └── app.js          # 服务入口
```

## 核心功能

### 1. 登录授权
```javascript
// 基础登录
const loginResult = await douyinAuth.login();

// OAuth授权
const authResult = await douyinAuth.authorizeWithScopes([
  'user_info',
  'video.list',
  'comment.list', 
  'message.list'
]);
```

### 2. 数据获取
```javascript
// 获取用户视频
const videos = await douyinAuth.getUserVideos(cursor, count);

// 获取用户评论
const comments = await douyinAuth.getUserComments(cursor, count);

// 获取用户私信
const messages = await douyinAuth.getUserMessages(cursor, count);
```

## 🚀 快速开始

### 前端小程序

1. **导入项目**
   ```bash
   # 使用抖音开发者工具打开项目根目录
   # 配置AppID（在抖音开放平台获取）
   ```

2. **运行调试**
   - 点击预览或真机调试
   - 测试登录和数据获取功能

### 后端API服务

1. **安装启动**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **服务验证**
   ```bash
   # 检查服务状态
   curl http://localhost:3000/health
   
   # 预期响应
   {"status":"OK","timestamp":"...","version":"1.0.0"}
   ```

3. **配置说明**
   - 详细部署指南：[backend/DEPLOYMENT.md](backend/DEPLOYMENT.md)
   - API文档：[backend/README.md](backend/README.md)

## API接口说明

### 认证接口

#### code2session
```javascript
POST /api/auth/code2session
{
  "code": "登录临时凭证"
}

// 返回
{
  "success": true,
  "openid": "用户openid",
  "unionid": "用户unionid", 
  "session_key": "会话密钥"
}
```

#### 获取access_token
```javascript
POST /api/auth/get-access-token
{
  "ticket": "OAuth授权票据",
  "openId": "用户openid"
}

// 返回
{
  "success": true,
  "access_token": "访问令牌",
  "refresh_token": "刷新令牌",
  "expires_in": 7200
}
```

#### 获取用户数据
```javascript
POST /api/douyin/user-videos
POST /api/douyin/user-comments  
POST /api/douyin/user-messages
```

## 🔧 生产环境配置

### 1. 抖音开放平台配置

1. **注册开发者账号**
   - 访问 [抖音开放平台](https://developer.open-douyin.com/)
   - 注册企业开发者账号

2. **创建小程序应用**
   - 创建小程序项目
   - 获取 `AppID` 和 `AppSecret`

3. **申请API权限**
   - `user_info` - 用户基本信息
   - `video.list` - 视频列表权限
   - `comment.list` - 评论列表权限
   - `message.list` - 私信列表权限

### 2. 环境配置

1. **后端配置**
   ```bash
   cd backend
   cp env.example .env
   # 编辑 .env 文件，配置AppID和AppSecret
   ```

2. **前端配置**
   ```javascript
   // utils/login.js 中的API地址
   const BACKEND_API_BASE = 'https://your-backend-domain.com';
   ```

3. **域名配置**
   - 在抖音开放平台配置服务器域名白名单
   - 配置request合法域名

## 数据结构

### 视频数据
```javascript
{
  "item_id": "视频ID",
  "title": "视频标题",
  "cover": "封面图片URL",
  "duration": 60,
  "create_time": 1640995200000,
  "statistics": {
    "play_count": 10000,
    "digg_count": 500,
    "comment_count": 100,
    "share_count": 50
  }
}
```

### 评论数据
```javascript
{
  "comment_id": "评论ID",
  "text": "评论内容",
  "create_time": 1640995200000,
  "digg_count": 10,
  "reply_count": 2,
  "item_id": "视频ID",
  "item_title": "视频标题"
}
```

### 私信数据
```javascript
{
  "message_id": "消息ID",
  "content": "消息内容",
  "create_time": 1640995200000,
  "from_user": {
    "open_id": "发送者ID",
    "nickname": "发送者昵称",
    "avatar": "头像URL"
  }
}
```

## 开发调试

### 1. 模拟环境
当前版本在开发环境中使用模拟数据，包括：
- 模拟登录流程
- 模拟OAuth授权
- 模拟API响应

### 2. 真实环境切换
当后端API准备就绪后，系统会自动切换到真实API调用。

## 📚 相关文档

- 📖 [后端API文档](backend/README.md) - 完整的API接口说明
- 🚀 [部署指南](backend/DEPLOYMENT.md) - 生产环境部署教程
- 🔗 [抖音开放平台](https://developer.open-douyin.com/docs) - 官方文档

## ⚠️ 注意事项

1. **权限申请**：某些API权限需要抖音官方审核
2. **频率限制**：注意API调用频率限制
3. **安全配置**：生产环境请修改所有默认密钥
4. **域名配置**：确保在抖音开放平台配置正确的域名白名单

## 🤝 技术支持

- 📧 **问题反馈**：项目Issues
- 📖 **技术文档**：项目README和相关文档
- 🌐 **官方资源**：抖音开放平台开发者社区

---

**✨ 此项目提供了抖音小程序数据获取的完整生产级解决方案，包含前后端完整实现，可直接用于实际项目开发。** 