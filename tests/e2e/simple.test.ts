/**
 * 简单的冒烟测试 - 验证基础功能
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, cleanupDatabase, setupTestDatabase, TEST_BASE_URL } from './setup';

describe('Simple Smoke Test', () => {
  let serverProcess: Bun.Process;

  beforeAll(async () => {
    await setupTestDatabase();
    serverProcess = await startTestServer();
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    await cleanupDatabase();
  });

  test('服务器启动并响应健康检查', async () => {
    const response = await fetch(`${TEST_BASE_URL}/api/v1/health`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('API is healthy');
  });

  test('可以注册用户', async () => {
    const response = await fetch(`${TEST_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.username).toBe('testuser');
  });

  test('可以登录并获取 token', async () => {
    // 先注册
    await fetch(`${TEST_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'loginuser',
        email: 'login@example.com',
        password: 'password123',
      }),
    });

    // 登录
    const response = await fetch(`${TEST_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'loginuser',
        password: 'password123',
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.token).toBeDefined();
    expect(typeof data.data.token).toBe('string');
  });

  test('受保护路由需要认证', async () => {
    // 不带 token 访问
    const response = await fetch(`${TEST_BASE_URL}/api/v1/profile`);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toContain('Access token required');
  });

  test('404 路由返回正确格式', async () => {
    const response = await fetch(`${TEST_BASE_URL}/api/v1/nonexistent`);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.message).toBe('Route not found');
  });
});