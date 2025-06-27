# 抖音小程序后端API服务

这是一个为抖音小程序提供OAuth授权和数据获取功能的Node.js后端服务。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

### 2. 环境配置

复制环境变量模板文件：
```bash
cp env.example .env
```

编辑 `.env` 文件，配置以下参数：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 抖音开放平台配置（必填）
DOUYIN_APP_ID=your_app_id_here
DOUYIN_APP_SECRET=your_app_secret_here
DOUYIN_API_BASE_URL=https://developer.open-douyin.com

# JWT配置
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# 其他配置...
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务启动后，访问 `http://localhost:3000/health` 检查服务状态。

## 📡 API接口

### 认证相关 (`/api/auth`)

#### 1. 小程序登录
```http
POST /api/auth/code2session
Content-Type: application/json

{
  "code": "小程序登录凭证"
}
```

**响应：**
```json
{
  "success": true,
  "openid": "用户openid",
  "unionid": "用户unionid",
  "session_key": "会话密钥"
}
```

#### 2. 获取访问令牌
```http
POST /api/auth/get-access-token
Content-Type: application/json

{
  "ticket": "OAuth授权票据",
  "openId": "用户openid"
}
```

**响应：**
```json
{
  "success": true,
  "access_token": "访问令牌",
  "refresh_token": "刷新令牌",
  "expires_in": 7200,
  "scope": "授权范围"
}
```

#### 3. 刷新访问令牌
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "刷新令牌",
  "openId": "用户openid"
}
```

### 数据获取相关 (`/api/douyin`)

#### 1. 获取用户视频列表
```http
POST /api/douyin/user-videos
Content-Type: application/json

{
  "openId": "用户openid",
  "cursor": 0,
  "count": 20
}
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "item_id": "视频ID",
      "title": "视频标题",
      "cover": "封面URL",
      "statistics": {
        "play_count": 播放数,
        "digg_count": 点赞数,
        "comment_count": 评论数,
        "share_count": 分享数
      },
      "create_time": 创建时间戳,
      "duration": 视频时长,
      "is_top": 是否置顶
    }
  ],
  "cursor": 下一页游标,
  "has_more": 是否有更多数据
}
```

#### 2. 获取用户评论列表
```http
POST /api/douyin/user-comments
Content-Type: application/json

{
  "openId": "用户openid",
  "cursor": 0,
  "count": 20
}
```

#### 3. 获取用户私信列表
```http
POST /api/douyin/user-messages
Content-Type: application/json

{
  "openId": "用户openid",
  "cursor": 0,
  "count": 20
}
```

#### 4. 获取用户基本信息
```http
GET /api/douyin/user-profile/{openId}
```

## 🔧 配置说明

### 抖音开放平台配置

1. 访问 [抖音开放平台](https://developer.open-douyin.com/)
2. 创建小程序应用
3. 获取 `AppID` 和 `AppSecret`
4. 配置服务器域名和回调地址
5. 申请相应的API权限：
   - `user_info`: 用户基本信息
   - `video.list`: 视频列表
   - `comment.list`: 评论列表
   - `message.list`: 私信列表

### 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `NODE_ENV` | 运行环境 | development |
| `DOUYIN_APP_ID` | 抖音应用ID | - |
| `DOUYIN_APP_SECRET` | 抖音应用密钥 | - |
| `JWT_SECRET` | JWT签名密钥 | - |
| `LOG_LEVEL` | 日志级别 | info |
| `ALLOWED_ORIGINS` | 允许的跨域源 | * |

## 🏗️ 项目结构

```
backend/
├── app.js              # 主应用文件
├── package.json        # 项目配置
├── env.example         # 环境变量模板
├── utils/              # 工具类
│   ├── logger.js       # 日志工具
│   ├── cache.js        # 缓存工具
│   └── douyinApi.js    # 抖音API封装
├── middleware/         # 中间件
│   └── errorHandler.js # 错误处理
├── routes/             # 路由
│   ├── auth.js         # 认证路由
│   └── douyin.js       # 抖音数据路由
└── logs/               # 日志文件
```

## 🔒 安全特性

- **CORS保护**: 配置允许的跨域源
- **速率限制**: 防止API滥用
- **错误处理**: 统一的错误响应格式
- **日志记录**: 完整的请求和错误日志
- **令牌管理**: 自动缓存和刷新访问令牌

## 📝 开发说明

### 模拟模式

当未配置抖音开放平台凭证时，服务将自动运行在模拟模式，返回符合API规范的测试数据。

### 日志

- 开发环境：输出到控制台
- 生产环境：写入日志文件
- 日志文件位置：`logs/` 目录

### 缓存

使用内存缓存存储：
- 用户session信息（2小时过期）
- 访问令牌（根据expires_in设置）

## 🚀 部署

### 使用 PM2 部署

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start app.js --name "douyin-backend"

# 查看状态
pm2 status

# 查看日志
pm2 logs douyin-backend
```

### Docker 部署

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔍 故障排除

### 常见问题

1. **服务启动失败**
   - 检查端口是否被占用
   - 验证环境变量配置

2. **API调用失败**
   - 检查抖音开放平台配置
   - 验证网络连接
   - 查看日志文件

3. **令牌过期**
   - 服务会自动处理令牌刷新
   - 检查refresh_token是否有效

### 调试模式

设置环境变量 `LOG_LEVEL=debug` 启用详细日志。

## 📞 技术支持

如有问题，请查看：
1. 项目日志文件
2. 抖音开放平台文档
3. 联系技术支持

---

**注意**: 当前版本使用模拟数据进行开发和测试。要获取真实数据，请完成抖音开放平台的配置和权限申请。 