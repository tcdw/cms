# Frontend Admin 管理面板开发笔记

**日期**: 2025-12-26

## 概述

为 Headless CMS 项目创建了完整的管理面板前端，位于 `apps/frontend-admin/`。

## 技术栈

| 类别            | 技术                                       |
| --------------- | ------------------------------------------ |
| 框架            | React 19 + TypeScript                      |
| 构建工具        | Rsbuild                                    |
| 路由            | TanStack Router (文件系统路由)             |
| 状态管理        | TanStack Query (服务端) + Zustand (客户端) |
| UI 组件         | shadcn/ui (Radix UI + Tailwind CSS)        |
| 表单            | react-hook-form + zod                      |
| HTTP 客户端     | ky                                         |
| Markdown 编辑器 | @uiw/react-md-editor                       |

## 实现的功能

### 页面

| 路径              | 功能                         |
| ----------------- | ---------------------------- |
| `/login`          | 用户登录                     |
| `/dashboard`      | 仪表盘（文章/分类统计）      |
| `/posts`          | 文章列表（搜索、筛选、分页） |
| `/posts/new`      | 新建文章（Markdown 编辑器）  |
| `/posts/:id/edit` | 编辑文章                     |
| `/categories`     | 分类管理（仅管理员可增删改） |

### 核心模块

- **API 客户端** (`src/api/`): 封装后端 API 调用
- **认证状态** (`src/stores/authStore.ts`): JWT token 持久化
- **布局组件** (`src/components/layout/`): 侧边栏 + 顶栏布局

## 项目结构

```
apps/frontend-admin/src/
├── api/                    # API 客户端
│   ├── client.ts           # ky 实例
│   ├── auth.ts
│   ├── posts.ts
│   └── categories.ts
├── components/
│   ├── ui/                 # shadcn/ui 组件
│   └── layout/             # 布局组件
├── hooks/                  # use-toast
├── lib/                    # utils
├── routes/                 # TanStack Router 文件路由
│   ├── __root.tsx
│   ├── _auth.tsx           # 未登录布局
│   ├── _auth.login.tsx
│   ├── _app.tsx            # 已登录布局
│   ├── _app.dashboard.tsx
│   ├── _app.posts.tsx      # posts 布局 (Outlet)
│   ├── _app.posts.index.tsx
│   ├── _app.posts.new.tsx
│   ├── _app.posts.$id.edit.tsx
│   └── _app.categories.tsx
└── stores/                 # zustand
```

## 修复的问题

### 1. Posts 子路由不工作

**问题**: 点击 "New Post" 按钮无反应

**原因**: `_app.posts.tsx` 作为父路由没有 `<Outlet />` 渲染子路由

**解决**:

- 将列表页移到 `_app.posts.index.tsx`
- 创建 `_app.posts.tsx` 只包含 `<Outlet />`

### 2. .gitignore 误匹配

**问题**: `_auth.login.tsx` 被 `*.log*` 规则匹配

**解决**: 将 `*.log*` 改为 `*.log`

### 3. 登录失败导致页面刷新

**问题**: 输入错误密码会导致整个页面刷新

**原因**: API 客户端的 401 处理会触发 `window.location.href = "/login"`

**解决**:

- 排除 `/auth/` 端点的 401 重定向
- 添加 `throwHttpErrors: false`

## 后端改动

### 默认管理员账户

修改 `apps/backend/src/db/migrate.ts`，在数据库迁移时自动创建默认管理员：

| 字段   | 值                  |
| ------ | ------------------- |
| 用户名 | `admin`             |
| 密码   | `admin123`          |
| 邮箱   | `admin@example.com` |

## 启动方式

```bash
# 后端 (端口 3000)
cd apps/backend && bun run dev

# 前端 (新终端，默认端口 3001)
cd apps/frontend-admin && bun run dev
```

前端自动将 `/api` 请求代理到 `http://localhost:3000`。
