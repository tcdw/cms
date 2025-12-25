# Headless CMS API

一个基于 Bun、itty-router 和 SQLite 的轻量级 Headless CMS，使用 Drizzle ORM 和 JWT 认证。

## 技术栈

- **运行时**: Bun
- **路由框架**: itty-router
- **数据库**: SQLite (`bun:sqlite`)
- **ORM**: Drizzle ORM
- **认证**: JWT
- **类型安全**: TypeScript + Zod 验证

## 功能特性

### 用户管理

- 用户注册和登录
- JWT 认证
- 密码修改
- 角色管理（管理员/编辑）

### 内容管理

- 文章增删改查
- 文章状态管理（草稿/已发布）
- 文章分类管理
- 文章搜索和筛选
- 文章作者管理
- 文章特色图片支持

### 分类管理

- 分类增删改查
- 文章关联分类

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 数据库初始化

```bash
# 生成迁移文件
bun run db:generate

# 运行迁移
bun run db:migrate
```

### 3. 启动服务器

```bash
# 开发模式
bun run dev

# 生产模式
bun run start
```

服务器将在 http://localhost:3000 启动

## API 文档

### 1. 健康检查

`GET /api/v1/health`

响应示例：

```json
{
  "success": true,
  "message": "API is healthy",
  "data": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0"
  }
}
```

### 2. 认证相关

#### 注册用户

`POST /api/v1/auth/register`

请求体：

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepassword123",
  "role": "editor" // 可选，默认为 "editor"
}
```

响应示例：

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "editor",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 用户登录

`POST /api/v1/auth/login`

请求体：

```json
{
  "username": "john_doe",
  "password": "securepassword123"
}
```

响应示例：

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "role": "editor",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. 用户管理

#### 获取用户资料

`GET /api/v1/profile`

请求头：

```
Authorization: Bearer <token>
```

响应示例：

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "editor",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 修改密码

`POST /api/v1/profile/change-password`

请求头：

```
Authorization: Bearer <token>
```

请求体：

```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

响应示例：

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### 4. 文章管理

#### 获取文章列表

`GET /api/v1/posts`

查询参数：

- `page` (数字, 默认: 1): 页码
- `limit` (数字, 默认: 10, 最大: 100): 每页条数
- `status` (string, 可选): 筛选状态 (draft/published)
- `category` (数字, 可选): 分类 ID
- `author` (数字, 可选): 作者 ID
- `search` (字符串, 可选): 搜索关键字
- `sortBy` (string, 默认: created_at): 排序字段 (created_at/updated_at/title)
- `sortOrder` (string, 默认: desc): 排序方式 (asc/desc)

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "My First Post",
      "slug": "my-first-post",
      "excerpt": "This is an excerpt...",
      "status": "published",
      "featuredImage": "https://example.com/image.jpg",
      "author": {
        "id": 1,
        "username": "john_doe"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### 获取文章详情

`GET /api/v1/posts/:id`

响应示例：

```json
{
  "success": true,
  "message": "Post retrieved successfully",
  "data": {
    "id": 1,
    "title": "My First Post",
    "slug": "my-first-post",
    "content": "Full content here...",
    "excerpt": "This is an excerpt...",
    "status": "published",
    "featuredImage": "https://example.com/image.jpg",
    "author": {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com"
    },
    "categories": [
      {
        "id": 1,
        "name": "Technology",
        "slug": "technology"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 创建文章

`POST /api/v1/posts`

请求头：

```
Authorization: Bearer <token>
```

请求体：

```json
{
  "title": "My New Post",
  "slug": "my-new-post",
  "content": "This is the post content...",
  "excerpt": "This is a short excerpt...",
  "status": "draft", // draft 或 published
  "featuredImage": "https://example.com/image.jpg", // 可选
  "categoryIds": [1, 2] // 可选
}
```

响应示例：

```json
{
  "success": true,
  "message": "Post created successfully",
  "data": {
    "id": 2,
    "title": "My New Post",
    "slug": "my-new-post",
    "content": "This is the post content...",
    "excerpt": "This is a short excerpt...",
    "status": "draft",
    "featuredImage": "https://example.com/image.jpg",
    "author": {
      "id": 1,
      "username": "john_doe"
    },
    "createdAt": "2024-02-01T00:00:00.000Z",
    "updatedAt": "2024-02-01T00:00:00.000Z"
  }
}
```

#### 更新文章

`PATCH /api/v1/posts/:id`

请求头：

```
Authorization: Bearer <token>
```

请求体（所有字段可选）：

```json
{
  "title": "Updated Post Title",
  "content": "Updated content...",
  "status": "published"
}
```

响应示例：

```json
{
  "success": true,
  "message": "Post updated successfully",
  "data": {
    "id": 2,
    "title": "Updated Post Title",
    "slug": "my-new-post",
    "content": "Updated content...",
    "status": "published"
    // ... 其他字段
  }
}
```

#### 删除文章

`DELETE /api/v1/posts/:id`

请求头：

```
Authorization: Bearer <token>
```

响应示例：

```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

### 5. 分类管理

仅管理员（role = admin）可以创建、更新和删除分类。

#### 获取分类列表

`GET /api/v1/categories`

查询参数：

- `page` (数字, 默认: 1): 页码
- `limit` (数字, 默认: 10, 最大: 100): 每页条数
- `search` (字符串, 可选): 搜索关键字
- `sortBy` (string, 默认: name): 排序字段 (created_at/name)
- `sortOrder` (string, 默认: asc): 排序方式 (asc/desc)

响应示例：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Technology",
      "slug": "technology",
      "description": "Technology related posts",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "postCount": 15
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

#### 获取分类详情

`GET /api/v1/categories/:id`

响应示例：

```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "id": 1,
    "name": "Technology",
    "slug": "technology",
    "description": "Technology related posts",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "postCount": 15
  }
}
```

#### 创建分类

`POST /api/v1/categories`

请求头：

```
Authorization: Bearer <token>
```

请求体：

```json
{
  "name": "Technology",
  "slug": "technology",
  "description": "Technology related posts"
}
```

响应示例：

```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "id": 1,
    "name": "Technology",
    "slug": "technology",
    "description": "Technology related posts",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 更新分类

`PATCH /api/v1/categories/:id`

请求头：

```
Authorization: Bearer <token>
```

请求体（所有字段可选）：

```json
{
  "name": "Updated Category",
  "description": "Updated description"
}
```

响应示例：

```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "id": 1,
    "name": "Updated Category",
    "slug": "technology",
    "description": "Updated description",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 删除分类

`DELETE /api/v1/categories/:id`

请求头：

```
Authorization: Bearer <token>
```

注意：只能删除没有关联文章的分类。

响应示例：

```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

## 错误处理

所有 API 错误都采用统一的响应格式：

```json
{
  "success": false,
  "message": "错误消息",
  "errors": ["详细错误1", "详细错误2"]
}
```

常见 HTTP 状态码：

- `200`: 成功
- `201`: 创建成功
- `400`: 请求参数错误
- `401`: 未认证
- `403`: 权限不足
- `404`: 资源未找到
- `409`: 冲突（如重复用户名）
- `500`: 服务器内部错误

## 环境配置

| 变量名                | 描述              | 默认值          |
| --------------------- | ----------------- | --------------- |
| `PORT`                | 服务器端口        | `3000`          |
| `DATABASE_URL`        | SQLite 数据库路径 | `file:./cms.db` |
| `DATABASE_AUTH_TOKEN` | 数据库认证令牌    | -               |
| `JWT_SECRET`          | JWT 密钥          | -               |
| `JWT_EXPIRES_IN`      | JWT 过期时间      | `7d`            |
| `NODE_ENV`            | 运行环境          | `development`   |

## 开发建议

1. **数据验证**: 所有输入数据都通过 Zod schema 进行验证
2. **类型安全**: 使用 TypeScript 和 Drizzle ORM 确保类型安全
3. **权限控制**: 基于 JWT 和角色（admin/editor）的权限控制
4. **分页**: 列表 API 支持分页查询
5. **搜索过滤**: 支持多种筛选和排序选项

## 许可证

MIT License
