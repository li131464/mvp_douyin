# 抖音小程序后端API部署指南

## 🚀 快速部署

### 1. 环境要求
- Node.js >= 16.0.0
- npm >= 7.0.0
- （可选）PM2 用于生产环境部署

### 2. 安装步骤

```bash
# 1. 克隆项目并进入backend目录
cd backend

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp env.example .env
# 编辑 .env 文件，配置必要参数

# 4. 启动服务
npm start
```

### 3. 环境变量配置

创建 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 抖音开放平台配置（必填）
DOUYIN_APP_ID=your_app_id_here
DOUYIN_APP_SECRET=your_app_secret_here
DOUYIN_API_BASE_URL=https://developer.open-douyin.com

# JWT配置
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# 日志配置
LOG_LEVEL=info

# CORS配置（配置您的小程序域名）
ALLOWED_ORIGINS=https://your-miniapp-domain.com

# 安全配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔧 抖音开放平台配置

### 1. 创建小程序应用

1. 访问 [抖音开放平台](https://developer.open-douyin.com/)
2. 登录并创建小程序应用
3. 获取 `AppID` 和 `AppSecret`

### 2. 配置服务器域名

在抖音开放平台的小程序设置中：

```
request合法域名：
- https://your-backend-domain.com

业务域名：
- https://your-backend-domain.com
```

### 3. 申请API权限

需要申请以下权限：
- `user_info`: 用户基本信息
- `video.list`: 视频列表
- `comment.list`: 评论列表  
- `message.list`: 私信列表

## 🌐 生产环境部署

### 使用 PM2 部署

```bash
# 1. 安装PM2
npm install -g pm2

# 2. 创建PM2配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'douyin-backend',
    script: 'app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true
  }]
};
EOF

# 3. 启动服务
pm2 start ecosystem.config.js

# 4. 保存PM2配置
pm2 save
pm2 startup
```

### 使用 Docker 部署

```dockerfile
# Dockerfile
FROM node:16-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]
```

```bash
# 构建镜像
docker build -t douyin-backend .

# 运行容器
docker run -d \
  --name douyin-backend \
  -p 3000:3000 \
  -e DOUYIN_APP_ID=your_app_id \
  -e DOUYIN_APP_SECRET=your_app_secret \
  -e JWT_SECRET=your_jwt_secret \
  douyin-backend
```

### 使用 docker-compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  douyin-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DOUYIN_APP_ID=${DOUYIN_APP_ID}
      - DOUYIN_APP_SECRET=${DOUYIN_APP_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - douyin-backend
    restart: unless-stopped
```

## 🔒 安全配置

### 1. HTTPS 配置

使用 Nginx 反向代理：

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

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
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 2. 防火墙配置

```bash
# Ubuntu/Debian
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable

# CentOS/RHEL
firewall-cmd --permanent --add-port=22/tcp
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload
```

## 📊 监控和日志

### 1. 日志管理

日志文件位置：
- `logs/combined.log` - 所有日志
- `logs/error.log` - 错误日志
- `logs/exceptions.log` - 异常日志

### 2. 健康检查

```bash
# 检查服务状态
curl https://your-domain.com/health

# 预期响应
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### 3. 性能监控

使用 PM2 监控：

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs douyin-backend

# 查看监控面板
pm2 monit
```

## 🔧 故障排除

### 常见问题

1. **服务启动失败**
   ```bash
   # 检查端口占用
   netstat -tulpn | grep :3000
   
   # 检查日志
   pm2 logs douyin-backend
   ```

2. **API调用失败**
   ```bash
   # 检查抖音开放平台配置
   # 验证AppID和AppSecret
   # 确认域名白名单设置
   ```

3. **CORS错误**
   ```bash
   # 检查ALLOWED_ORIGINS环境变量
   # 确认小程序域名配置正确
   ```

### 调试命令

```bash
# 查看环境变量
printenv | grep DOUYIN

# 测试API接口
curl -X POST https://your-domain.com/api/auth/code2session \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code"}'

# 查看进程信息
ps aux | grep node
```

## 📞 技术支持

### 联系方式
- 技术文档：[项目README](./README.md)
- 问题反馈：项目Issues
- 邮箱支持：your-email@domain.com

### 开发者资源
- [抖音开放平台文档](https://developer.open-douyin.com/docs)
- [Node.js官方文档](https://nodejs.org/docs/)
- [Express.js文档](https://expressjs.com/)

---

**注意**: 
1. 生产环境请务必修改所有默认密钥
2. 定期更新依赖包以修复安全漏洞
3. 配置适当的备份策略
4. 监控服务器资源使用情况 