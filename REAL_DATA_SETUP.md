# 抖音小程序真实数据获取设置指南

## 🚨 当前问题及紧急解决方案

### 问题现状
1. ✅ 后端服务正常运行 (`kuzchat.cn:3090`)
2. ✅ 登录成功 (code2session工作正常)  
3. ❌ 真机网络连接失败 ("后端API调用失败")
4. ⚠️ OAuth授权在开发者工具有问题

### 立即解决方案

#### 方案1: 配置抖音开发者后台合法域名 (推荐)
1. 登录 [抖音开放平台](https://developer.open-douyin.com/)
2. 进入小程序管理后台
3. 开发设置 → 服务器域名 → request合法域名
4. 添加: `http://kuzchat.cn:3090` 或 `https://kuzchat.cn:3090`

#### 方案2: 临时使用IP地址
添加合法域名: `http://47.108.240.146:3090`

#### 方案3: 本地测试
```bash
# 确保urlCheck设置为false (已完成)
# 在开发者工具中测试
```

---

本指南将帮助您配置小程序以获取真实的抖音用户数据（视频、评论、私信）。

## 📋 前置要求

1. **抖音开放平台开发者账号**
2. **企业认证** （个人开发者无法申请数据权限）
3. **云服务器**（推荐阿里云、腾讯云、华为云）
4. **域名和SSL证书**

## 🚀 步骤一：申请抖音开放平台权限

### 1.1 注册开发者账号

1. 访问 [抖音开放平台](https://developer.open-douyin.com/)
2. 注册企业开发者账号
3. 完成企业认证

### 1.2 创建小程序应用

1. 创建小程序项目
2. 获取 `AppID` 和 `AppSecret`
3. 配置小程序基本信息

### 1.3 申请数据权限

申请以下API权限：

- `ma.user.data` - 用户主页数据权限
- `video.list` - 视频列表权限
- `comment.list` - 评论列表权限
- `message.list` - 私信列表权限

**重要：** 这些权限需要通过审核，请详细说明使用场景。

## 🌐 步骤二：部署后端服务

### 2.1 准备云服务器

```bash
# 推荐配置
- CPU: 2核心
- 内存: 4GB
- 存储: 40GB SSD
- 操作系统: Ubuntu 20.04 LTS
```

### 2.2 安装运行环境

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
sudo npm install -g pm2

# 安装 Nginx
sudo apt install nginx -y
```

### 2.3 部署后端代码

```bash
# 上传代码到服务器
cd /var/www/
sudo git clone <your-repo-url> douyin-backend
cd douyin-backend/backend

# 安装依赖
sudo npm install --production

# 配置环境变量
sudo cp env.example .env
sudo nano .env
```

### 2.4 配置环境变量

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 抖音开放平台配置（必填）
DOUYIN_APP_ID=你的真实AppID
DOUYIN_APP_SECRET=你的真实AppSecret
DOUYIN_API_BASE_URL=https://developer.open-douyin.com

# JWT配置
JWT_SECRET=你的超级安全密钥
JWT_EXPIRES_IN=7d

# 日志配置
LOG_LEVEL=info

# CORS配置（配置你的域名）
ALLOWED_ORIGINS=https://你的域名.com

# 安全配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### 2.5 启动服务

```bash
# 使用PM2启动
sudo pm2 start app.js --name "douyin-backend"
sudo pm2 startup
sudo pm2 save
```

## 🔒 步骤三：配置HTTPS和域名

### 3.1 申请SSL证书

```bash
# 安装 Certbot
sudo apt install snapd
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot

# 申请免费SSL证书
sudo certbot --nginx -d 你的域名.com
```

### 3.2 配置Nginx

创建 `/etc/nginx/sites-available/douyin-backend`：

```nginx
server {
    listen 80;
    server_name 你的域名.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 你的域名.com;

    ssl_certificate /etc/letsencrypt/live/你的域名.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/你的域名.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
      
        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/douyin-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📱 步骤四：配置小程序

### 4.1 更新API地址

编辑 `frontend/config/api.js`：

```javascript
production: {
  baseUrl: 'https://你的域名.com',  // 替换为真实地址
  timeout: 15000,
  description: '生产服务器'
}
```

### 4.2 配置抖音开放平台域名白名单

在抖音开放平台的小程序设置中添加：

```
request合法域名：
- https://你的域名.com

业务域名：
- https://你的域名.com
```

### 4.3 更新小程序AppID

编辑 `frontend/project.config.json`：

```json
{
  "appid": "你的真实AppID"
}
```

## 🧪 步骤五：测试真实数据

### 5.1 检查服务器状态

```bash
# 检查后端服务
curl https://你的域名.com/health

# 查看日志
sudo pm2 logs douyin-backend
```

### 5.2 测试小程序

1. 在抖音开发者工具中测试（使用测试数据）
2. 发布到体验版，在真机测试（使用真实数据）

### 5.3 验证数据

- 登录成功后应显示真实的用户头像和昵称
- OAuth授权成功后应能获取到真实的视频、评论、私信数据

## 🚨 重要注意事项

1. **权限审核**：抖音数据权限需要审核，可能需要1-2周时间
2. **API限制**：注意API调用频率限制，避免被限流
3. **数据安全**：严格保护用户数据，遵守相关法律法规
4. **隐私协议**：确保小程序隐私协议中声明了数据使用范围

## 🔧 常见问题

### Q: 权限申请被拒怎么办？

A: 详细说明使用场景，提供合规的数据使用方案，联系抖音开放平台客服。

### Q: 真机测试显示网络错误？

A: 检查域名白名单配置，确认SSL证书有效，查看服务器日志。

### Q: 获取不到真实数据？

A: 确认权限已通过审核，检查AppID和AppSecret配置，查看API调用日志。

## 📞 技术支持

如有问题，请查看：

1. 后端日志：`sudo pm2 logs douyin-backend`
2. Nginx日志：`sudo tail -f /var/log/nginx/error.log`
3. 抖音开放平台文档：https://developer.open-douyin.com/docs/

---

完成以上步骤后，您的小程序就能获取到真实的抖音用户数据了！
