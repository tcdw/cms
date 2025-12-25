# E2E Testing Guide

这个项目使用 [Bun Test Runner](https://bun.sh/docs/cli/test) 进行端到端 (E2E) 测试。Bun 提供了快速、现代化的测试体验，与 Jest 兼容的 API，以及内置的测试运行器。

## 📁 目录结构

```
tests/
├── e2e/
│   ├── setup.ts          # 测试环境设置和工具函数
│   ├── auth.test.ts      # 认证流程测试
│   ├── posts.test.ts     # 文章管理测试
│   ├── categories.test.ts # 分类管理测试
│   └── utils.test.ts     # 工具和基础功能测试
└── README.md             # 本文件
```

## 🚀 快速开始

### 运行所有 E2E 测试

```bash
# 运行所有 E2E 测试
bun test:e2e

# 或者直接使用 bun test
bun test tests/e2e
```

### 运行特定测试套件

```bash
# 只运行认证测试
bun test:auth

# 只运行文章管理测试
bun test:posts

# 只运行分类管理测试
bun test:categories

# 只运行工具测试
bun test:utils
```

### 开发模式（监听文件变化）

```bash
bun test:watch
```

### 查看覆盖率

```bash
bun test --coverage
```

## 🧪 测试架构

### 环境设置 (`setup.ts`)

测试环境使用以下工具函数：

- **`startTestServer()`**: 启动测试服务器（端口 3001）
- **`cleanupDatabase()`**: 清理测试数据库
- **`setupTestDatabase()`**: 初始化测试环境
- **`createTestUser()`**: 创建测试用户
- **`TestApiClient`**: HTTP 请求客户端

### 测试数据库

- 使用 SQLite 文件数据库 (`file:./test.db`)
- 每个测试前自动清理
- 支持事务隔离（通过手动清理）

### 认证流程

测试会自动处理：

1. 用户注册
2. 用户登录获取 JWT Token
3. Token 设置到请求头
4. 访问受保护的路由

## 📝 测试用例示例

### 基本测试结构

```typescript
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { startTestServer, cleanupDatabase, TestApiClient, TEST_BASE_URL } from "./setup";

describe("Feature Name", () => {
  let serverProcess: Bun.Process;
  let client: TestApiClient;

  beforeAll(async () => {
    await setupTestDatabase();
    serverProcess = await startTestServer();
    client = new TestApiClient(TEST_BASE_URL);
  });

  afterAll(async () => {
    if (serverProcess) serverProcess.kill();
    await cleanupDatabase();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  test("should do something", async () => {
    const response = await client.get("/api/v1/health");
    expect(response.success).toBe(true);
  });
});
```

### 认证测试示例

```typescript
test("should login and access protected route", async () => {
  // 注册
  await client.post("/api/v1/auth/register", {
    username: "testuser",
    email: "test@example.com",
    password: "password123",
  });

  // 登录
  const loginResponse = await client.post("/api/v1/auth/login", {
    username: "testuser",
    password: "password123",
  });

  expect(loginResponse.success).toBe(true);
  expect(loginResponse.data?.token).toBeDefined();

  // 设置 token
  client.setToken(loginResponse.data!.token);

  // 访问受保护路由
  const profileResponse = await client.get("/api/v1/profile");
  expect(profileResponse.success).toBe(true);
});
```

## 🔍 测试覆盖范围

### 认证模块 (`auth.test.ts`)

- ✅ 用户注册（成功/失败）
- ✅ 用户登录（成功/失败）
- ✅ JWT Token 生成和验证
- ✅ 受保护路由访问
- ✅ 密码更改
- ✅ 用户资料获取

### 文章管理 (`posts.test.ts`)

- ✅ 文章创建（带/不带认证）
- ✅ 文章列表（分页、搜索、过滤）
- ✅ 单篇文章获取
- ✅ 文章更新（权限控制）
- ✅ 文章删除（权限控制）
- ✅ 管理员权限验证

### 分类管理 (`categories.test.ts`)

- ✅ 分类创建（仅管理员）
- ✅ 分类列表（公开）
- ✅ 分类更新（仅管理员）
- ✅ 分类删除（仅管理员）
- ✅ 权限验证

### 工具和基础功能 (`utils.test.ts`)

- ✅ 健康检查
- ✅ 404 处理
- ✅ HTTP 方法支持
- ✅ JSON 响应格式
- ✅ 并发请求处理

## 🎯 最佳实践

### 1. 测试隔离

每个测试应该独立运行，不依赖其他测试的状态。使用 `beforeEach` 清理数据库。

### 2. 清理资源

在 `afterAll` 中停止服务器，在 `afterEach` 中清理数据库。

### 3. 使用描述性测试名称

```typescript
// 好的
test('should fail to create post without authentication', async () => { ... });

// 不好的
test('test1', async () => { ... });
```

### 4. 测试边界情况

- 无效输入
- 缺少必填字段
- 权限不足
- 重复数据
- 不存在的资源

### 5. 验证响应格式

```typescript
expect(response.success).toBe(true);
expect(response.message).toBeDefined();
expect(response.data).toBeDefined();
```

## 🔧 CI/CD 集成

GitHub Actions 工作流在以下情况下自动运行测试：

- 推送到 `main` 或 `master` 分支
- 创建 Pull Request

测试环境配置：

- Node.js 环境
- Bun 运行时
- SQLite 数据库
- 自动清理和报告生成

## 📊 性能考虑

Bun 测试运行器的优势：

- ⚡ **快速**: 比 Node.js Jest 快 10-100 倍
- 📦 **零配置**: 内置测试运行器，无需额外依赖
- 🔧 **兼容性**: 与 Jest API 兼容
- 🎯 **TypeScript**: 原生 TypeScript 支持

## 🐛 调试技巧

### 查看详细输出

```bash
bun test --verbose
```

### 运行单个测试文件

```bash
bun test tests/e2e/auth.test.ts
```

### 检查服务器日志

测试服务器的输出会显示在控制台，包括：

- 启动状态
- 请求/响应日志
- 错误信息

### 数据库检查

测试使用 `file:./test.db`，可以使用以下命令检查：

```bash
sqlite3 ./test.db ".tables"
sqlite3 ./test.db "SELECT * FROM users;"
```

## 🚨 常见问题

### 测试服务器启动失败

- 检查端口 3001 是否被占用
- 确保数据库文件可以创建
- 查看控制台错误输出

### 数据库连接错误

- 确认 `DATABASE_URL` 环境变量设置正确
- 检查文件权限

### 测试超时

- 在 `bunfig.toml` 中增加 `timeout` 设置
- 检查服务器启动时间

## 📚 参考资料

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Bun Testing API](https://bun.sh/docs/api/test)
- [Jest 兼容 API](https://bun.sh/docs/api/jest)
- [项目 API 文档](../README.md)
