# 故障排查指南

## 🐛 OAuth授权相关问题

### 问题1: `showDouyinOpenAuth:fail params.scopeList[1] should be string, but got 0`

**问题描述**: 
在开发者工具中进行OAuth授权时出现此错误，提示权限列表中的参数类型不正确。

**原因分析**:
抖音小程序API要求`scopeList`参数中的所有元素都必须是字符串类型，但代码中添加了数字`0`。

**解决方案**:
✅ **已修复**: 将权限列表中的数字`0`改为字符串`"0"`

```javascript
// 修复前（错误）
finalScopes.push(0);

// 修复后（正确）
finalScopes.push("0");
```

**验证修复**:
1. 查看前端控制台日志，确认权限列表类型检查输出
2. 确认OAuth授权流程能够正常完成

### 问题2: API调用没有详细的调试信息

**问题描述**:
在真机测试或开发调试时，缺少详细的API调用信息，难以排查问题。

**解决方案**:
1. **配置环境变量**:
   ```env
   LOG_LEVEL=debug
   DEBUG_API_CALLS=true
   DEBUG_AUTH_FLOW=true
   ```

2. **后端日志会输出**:
   - API请求参数详情
   - 响应数据分析
   - Mock数据生成过程
   - 错误详细信息

3. **前端控制台会显示**:
   - 权限列表类型检查
   - 环境检测详情
   - OAuth授权流程步骤

## 🔍 调试技巧

### 1. 检查环境类型

前端会自动检测当前运行环境，并在控制台输出详细信息：

```javascript
// 查看环境检测结果
console.log('当前环境判断为真机环境，系统信息:', {
  platform: systemInfo.platform,
  brand: systemInfo.brand,
  model: systemInfo.model,
  version: systemInfo.version,
  system: systemInfo.system
});
```

### 2. 查看后端日志

开发环境下，后端会输出详细的调试日志：

```bash
# 实时查看日志
tail -f backend/logs/combined.log

# 查看错误日志
tail -f backend/logs/error.log
```

### 3. 验证API调用

后端会记录每个API调用的详细信息：

```json
{
  "level": "debug",
  "message": "Code2session request details:",
  "code": "user_login_code",
  "hasCode": true,
  "codeLength": 64,
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2025-01-01 12:00:00"
}
```

## 🚀 优化建议

### 1. 开发环境配置

```env
# backend/.env
NODE_ENV=development
PORT=3090
LOG_LEVEL=debug
DEBUG_API_CALLS=true
DEBUG_AUTH_FLOW=true
```

### 2. 真机测试配置

确保后端服务可以从外网访问，小程序配置正确的服务器域名。

### 3. 错误监控

建议在生产环境中：
- 使用`LOG_LEVEL=warn`或`LOG_LEVEL=error`
- 配置错误监控服务
- 定期检查日志文件

## 📋 常见问题

### Q: 为什么开发者工具需要添加"0"这个特殊scope？

A: 这是抖音开发者工具的特殊要求，真机环境不需要此参数。代码会自动检测环境并做相应处理。

### Q: 如何确认当前使用的是mock数据还是真实API？

A: 查看后端日志，会明确显示：
- `Using mock code2session` - 使用mock数据
- `Real Douyin API call successful` - 使用真实API

### Q: OAuth授权失败后会怎么处理？

A: 系统会自动回退到模拟授权模式，确保开发和测试流程不被中断。

## 🔗 相关文档

- [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) - 部署和配置指南
- [backend/README.md](backend/README.md) - 后端API文档
- [REAL_DATA_SETUP.md](REAL_DATA_SETUP.md) - 真实数据配置指南 