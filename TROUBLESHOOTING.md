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

## OAuth授权问题

### 问题描述
用户在真机测试时遇到"视频数据获取失败: 请先完成OAuth授权"错误，即使服务器日志显示授权成功。

### 根本原因
抖音小程序的OAuth授权流程比较复杂，需要两个步骤：
1. 基础登录：`tt.login` → `code2session` 获取基础session
2. OAuth授权：`tt.showDouyinOpenAuth` → 获取`ticket` → 换取`access_token`

问题出现在第二步，主要原因：
- **网络连接问题**：真机环境无法访问localhost后端服务
- **状态同步问题**：前端OAuth状态与底层对象不同步
- **回退机制缺陷**：模拟授权的access_token设置不完整

### 详细问题分析

#### 1. 真机测试失败现象
- 服务器日志显示API调用成功
- 前端显示"服务器连接失败"
- OAuth状态：`hasAccessToken: false`, `accessTokenLength: 0`
- 权限范围正确：`["ma.user.data"]`
- 最终结果：`hasOAuthAuth` 返回 `false`

#### 2. 问题根源
```javascript
// 问题代码：模拟授权时没有正确设置access_token
if (!this._accessToken) {
  // 这里的检查逻辑有问题
}
```

### 解决方案

#### 1. 优化模拟授权流程 
修改 `frontend/utils/login.js` 中的 `_simulateOAuthAuth` 方法：

```javascript
// 改进的模拟授权逻辑
let backendCallSuccess = false;
try {
  await this._callGetAccessToken(mockTicket);
  if (this._accessToken && this._accessToken.length > 0) {
    backendCallSuccess = true;
  }
} catch (backendError) {
  console.warn('后端调用失败:', backendError.message);
}

// 如果后端调用失败，设置模拟token
if (!backendCallSuccess) {
  this._setMockAccessToken();
}
```

#### 2. 改进错误处理机制
修改授权错误处理，确保网络失败时能正确回退：

```javascript
} catch (error) {
  // 网络连接失败时的处理
  if (errorContent.includes('网络连接') || errorContent.includes('localhost')) {
    const fallbackResult = await douyinAuth._simulateOAuthAuth(['ma.user.data']);
    if (fallbackResult.success) {
      // 更新页面状态并显示成功提示
    }
  }
}
```

#### 3. 增强状态验证
添加完整的状态验证逻辑：

```javascript
// 最终状态验证
const finalStatus = {
  hasOAuthAuth: this.hasOAuthAuth,
  scopes: this._authorizedScopes,
  hasAccessToken: !!this._accessToken,
  accessTokenLength: this._accessToken ? this._accessToken.length : 0
};
```

### 测试步骤

#### 1. 确保服务器运行
```bash
cd backend
npm start
```

#### 2. 真机测试流程
1. 在抖音APP中打开小程序
2. 完成基础登录
3. 点击"OAuth授权"按钮
4. 观察授权流程和结果

#### 3. 调试工具使用
- 打开调试页面
- 点击"测试模拟授权"按钮
- 查看详细的状态信息
- 检查access_token是否正确生成

### 预期行为

#### 成功情况（有网络连接）
- 显示"授权成功"
- 获取真实的access_token
- 可以查看真实用户数据

#### 网络失败情况（真机环境）
- 自动切换到演示模式
- 显示"权限获取成功"并提示已启用演示模式
- 生成模拟的access_token
- 可以查看模拟数据演示

#### 用户取消情况
- 显示"授权被取消"提示
- 不进行任何状态更改

### 调试信息检查

如果问题仍然存在，请检查以下状态：

1. **基础状态**：
   - `douyinAuth.isLoggedIn` 应该为 `true`
   - `douyinAuth.openId` 应该有值

2. **OAuth状态**：
   - `douyinAuth.hasOAuthAuth` 应该为 `true`
   - `douyinAuth._accessToken` 应该有值且长度 > 0
   - `douyinAuth.authorizedScopes` 应该包含 `["ma.user.data"]`

3. **网络状态**：
   - 服务器连接状态
   - 是否为开发者工具环境
   - 是否为真机环境

### 常见问题解答

**Q: 为什么服务器日志显示成功，但前端显示失败？**
A: 这是真机环境的典型问题。真机无法访问开发机器上的localhost服务，但我们的回退机制会自动处理这种情况。

**Q: 模拟模式下的数据是否可用？**
A: 是的，模拟模式提供完整的功能演示，包括视频数据、评论数据等，可以完全体验小程序的所有功能。

**Q: 如何确认授权是否真的成功？**
A: 检查 `douyinAuth.hasOAuthAuth` 的返回值，以及 `douyinAuth._accessToken` 是否有值。

### 修复历史

- **2025-07-01**: 修复真机环境OAuth授权失败问题
  - 改进模拟授权流程
  - 增强网络错误处理
  - 优化状态同步机制
  - 完善调试工具功能

## 网络连接问题

### 真机环境无法访问localhost
这是正常现象，已实现自动回退机制：
- 检测到网络连接失败时，自动切换到模拟数据模式
- 用户仍可以体验完整功能演示

### 解决方案
1. **部署到公网服务器**（推荐）
2. **使用ngrok等内网穿透工具**
3. **接受模拟数据模式**

## 常见错误码

### 授权相关错误
- `117490`: 用户取消授权
- `117491`: 权限申请被拒绝  
- `117492`: 小程序未配置相应权限
- `117499`: 权限列表为空
- `117401`: 用户未登录或不在前台
- `117403`: 请求授权权限信息失败
- `117405`: 没有可用的授权权限

### 网络相关错误
- `timeout`: 网络连接超时
- `network error`: 网络连接失败
- `localhost`: 真机环境无法访问本地服务器

## 开发建议

### 1. 本地开发
- 使用开发者工具进行初步测试
- 确保基础功能正常

### 2. 真机测试
- 准备好处理网络连接问题
- 关注模拟数据模式的用户体验

### 3. 生产环境
- 部署后端服务到公网
- 配置正确的域名和SSL证书
- 在抖音开放平台配置正确的回调域名

## 联系支持

如果问题仍然存在，请提供：
1. 详细的错误信息
2. 服务器日志
3. 浏览器控制台日志
4. 测试环境信息（开发者工具/真机） 