# AGENTS.md

> 面向自动化代理（AI/脚本）的仓库协作说明：优先遵循本文件，其次遵循仓库现有代码风格与约定。

## 1. 项目概况（实际情况）

- **项目类型**：轻量级 Headless CMS API
- **运行时**：Bun（入口为 [index.ts](index.ts)）
- **HTTP 服务**：`Bun.serve({ fetch })`
- **路由**：`itty-router`，API Base Path：`/api/v1`（见 [src/routes/index.ts](src/routes/index.ts)）
- **数据库**：SQLite（通过 **LibSQL 客户端** `@libsql/client`），ORM 使用 **Drizzle ORM**（`drizzle-orm/libsql`）
- **认证**：JWT（`jsonwebtoken`）+ 密码哈希（`bcryptjs`）
- **校验**：Zod（`drizzle-zod` 在 schema 层生成 insert/select schema）+ 少量手写校验工具
- **测试**：`bun test`（E2E 测试在 [tests/e2e](tests/e2e)）

> 备注：仓库当前 DB 层采用 `@libsql/client` + `drizzle-orm/libsql`；这与 Bun 的 `bun:sqlite` 不同。除非明确要迁移，否则新增代码应保持与现有 DB 选型一致。

## 2. Bun 优先（强约束）

默认使用 Bun，而不是 Node.js。

- 运行脚本：用 `bun <file>` / `bun run <script>`，不要用 `node` / `ts-node` / `npm run`。
- 安装依赖：用 `bun install`，不要用 `npm/yarn/pnpm`。
- 测试：用 `bun test`，不要引入 `jest`/`vitest`。
- 环境变量：Bun 会自动加载 `.env`，**不要**在代码里引入 `dotenv`。

### 推荐 API（如需新增能力）

- HTTP：继续使用 `Bun.serve()`（不要引入 `express`）。
- 文件：优先 `Bun.file()` / `Bun.write()`，避免 `node:fs` 的 `readFile/writeFile`。
- 进程：优先 `Bun.spawn()`；Shell 执行优先 `Bun.$\`cmd\``（不要引入 `execa`）。
- WebSocket：使用内置 `WebSocket`（不要引入 `ws`）。
- Redis/Postgres：如未来需要，优先 `Bun.redis` / `Bun.sql`（不要引入 `ioredis` / `pg` / `postgres.js`）。

## 3. 目录结构与职责

- [index.ts](index.ts)：服务入口，`Bun.serve()`，将请求交给 `router.fetch(request)`。
- [src/routes/index.ts](src/routes/index.ts)：路由定义（base `/api/v1`），将路由指向 controller。
- [src/controllers](src/controllers)：业务控制器（auth/user/post/category）。
- [src/middleware/auth.ts](src/middleware/auth.ts)：鉴权中间件（`authMiddleware` / `adminMiddleware`）。
- [src/db](src/db)：数据库连接与迁移
  - [src/db/index.ts](src/db/index.ts)：创建 libsql client 并导出 `db`
  - [src/db/schema.ts](src/db/schema.ts)：Drizzle schema + Zod schemas
  - [src/db/migrate.ts](src/db/migrate.ts)：迁移执行入口
- [src/utils](src/utils)：JWT/密码、校验等工具
- [src/types/index.ts](src/types/index.ts)：响应与认证相关类型
- [drizzle](drizzle/)：Drizzle Kit 生成的迁移文件
- [tests/e2e](tests/e2e)：端到端测试（通过启动真实服务并用 `fetch` 调用 API）

## 4. 开发/运行命令（以 package.json 为准）

- 安装：`bun install`
- 开发启动（watch）：`bun run dev`
- 生产启动：`bun run start`

### 数据库（Drizzle + SQLite/LibSQL）

- 生成迁移：`bun run db:generate`
- 运行迁移：`bun run db:migrate`
- Studio：`bun run db:studio`

### 测试

- 全部测试：`bun test`
- E2E：`bun run test:e2e`（或 `bun test tests/e2e`）
- Watch：`bun run test:watch`

测试示例（Bun）：

```ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## 5. API 与响应约定（保持一致）

- 所有 JSON 响应请设置 `Content-Type: application/json`。
- 统一响应形状参考 [src/types/index.ts](src/types/index.ts)：
  - `APIResponse`：`{ success, message, data?, errors? }`
  - 列表分页使用 `PaginatedResponse`
- 路由 404：路由层已有兜底 `router.all('*', ...)`，入口层也有 `response` 为空时的兜底 404；新增路由时不要破坏这一行为。

## 6. 环境变量（约定）

代码中通过 `process.env` 读取（Bun 支持），常用变量：

- `PORT`：服务端口（默认 3000）
- `DATABASE_URL`：libsql URL（默认 `file:./cms.db`）
- `DATABASE_AUTH_TOKEN`：libsql auth token（如果连接远端 libsql）
- `JWT_SECRET`：JWT 密钥（默认值存在，但生产必须配置）
- `JWT_EXPIRES_IN`：JWT 过期时间（默认 `7d`）
- `NODE_ENV`：测试中会设为 `test`

> 注意：不要添加 `dotenv`。如需新增配置，优先走 `.env` + `process.env`。

## 7. 代码改动边界（代理须知）

- 优先做“**小步、可验证**”的改动：先跑相关测试（至少 `bun test` 或对应 e2e 文件）。
- 不要引入与仓库选型冲突的新框架（例如 express/jest/vitest）。
- DB 层保持使用 `drizzle-orm/libsql` + `@libsql/client`，不要混入 `better-sqlite3`。
- 新增 util/中间件/控制器时，保持现有目录分层与导入风格（ESM TypeScript）。

## 8. Bun 文档入口（本地）

更多 Bun API 细节可查：`node_modules/bun-types/docs/**.md`。
