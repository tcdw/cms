/**
 * E2E 测试环境设置
 * 提供测试数据库、服务器启动和清理工具
 */

import { db } from '../../src/db';
import { users, posts, categories, postCategories } from '../../src/db/schema';
import { hashPassword } from '../../src/utils/auth';
import type { APIResponse } from '../../src/types';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

// 测试环境配置
export const TEST_PORT = 3001;
export const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

// 创建测试数据库连接
export function getTestDb() {
  const client = createClient({
    url: 'file:./test.db',
  });
  return drizzle(client, { schema: require('../../src/db/schema') });
}

// 运行数据库迁移
export async function runMigrations(): Promise<void> {
  try {
    const testDb = getTestDb();
    // 使用 drizzle-kit 执行迁移
    const { execSync } = require('child_process');

    // 确保 migrations 目录存在
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(process.cwd(), 'drizzle');

    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  No migrations directory found, creating tables manually...');
      // 手动创建表（用于测试环境）
      await createTablesManually();
      return;
    }

    console.log('🔄 Running database migrations...');
    // 执行 drizzle-kit migrate
    execSync('bun run db:migrate', {
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
      stdio: 'inherit'
    });
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.warn('⚠️  Migration warning:', error);
    // 如果迁移失败，手动创建表
    await createTablesManually();
  }
}

// 手动创建表（用于测试环境）
async function createTablesManually(): Promise<void> {
  const testDb = getTestDb();

  try {
    // 创建 users 表
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'editor',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // 创建 categories 表
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // 创建 posts 表
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        featured_image TEXT,
        author_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `);

    // 创建 post_categories 表
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS post_categories (
        post_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (post_id, category_id),
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);

    console.log('✅ Tables created manually');
  } catch (error) {
    console.warn('⚠️  Table creation warning:', error);
  }
}

// 启动测试服务器
export async function startTestServer(): Promise<Bun.Process> {
  // 首先确保数据库已迁移
  await runMigrations();

  // 使用 Bun.spawn 启动服务器
  const proc = Bun.spawn({
    cmd: ['bun', 'run', 'index.ts'],
    env: {
      ...process.env,
      PORT: TEST_PORT.toString(),
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 检查服务器是否健康
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(`${TEST_BASE_URL}/api/v1/health`);
      if (response.ok) {
        console.log('✅ Test server started successfully');
        return proc;
      }
    } catch (error) {
      // 服务器还在启动中
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error('Failed to start test server');
}

// 清理测试数据库
export async function cleanupDatabase(): Promise<void> {
  try {
    const testDb = getTestDb();

    // 按依赖关系删除数据
    await testDb.run('DELETE FROM post_categories');
    await testDb.run('DELETE FROM posts');
    await testDb.run('DELETE FROM users');
    await testDb.run('DELETE FROM categories');

    console.log('✅ Test database cleaned');
  } catch (error) {
    console.warn('⚠️  Database cleanup warning:', error);
  }
}

// 初始化测试数据库
export async function setupTestDatabase(): Promise<void> {
  // 先运行迁移
  await runMigrations();
  // 然后清理数据
  await cleanupDatabase();
  console.log('✅ Test database setup complete');
}

// 创建测试用户
export async function createTestUser(role: 'admin' | 'editor' = 'editor') {
  const hashedPassword = await hashPassword('testpassword123');
  const testDb = getTestDb();

  const [user] = await testDb.insert(users).values({
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: hashedPassword,
    role,
  }).returning();

  return user;
}

// API 请求工具
export class TestApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string = TEST_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request<T = any>(
    method: string,
    path: string,
    body?: any
  ): Promise<APIResponse<T> & { status?: number }> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    // 添加 status 属性到响应中
    (data as any).status = response.status;
    return data;
  }

  async get<T = any>(path: string): Promise<APIResponse<T> & { status?: number }> {
    return this.request('GET', path);
  }

  async post<T = any>(path: string, body: any): Promise<APIResponse<T> & { status?: number }> {
    return this.request('POST', path, body);
  }

  async patch<T = any>(path: string, body: any): Promise<APIResponse<T> & { status?: number }> {
    return this.request('PATCH', path, body);
  }

  async delete<T = any>(path: string): Promise<APIResponse<T> & { status?: number }> {
    return this.request('DELETE', path);
  }
}

// 全局测试设置和清理
export async function globalSetup(): Promise<void> {
  console.log('🧪 Setting up E2E test environment...');
  await setupTestDatabase();
}

export async function globalTeardown(): Promise<void> {
  console.log('🧪 Tearing down E2E test environment...');
  await cleanupDatabase();
}