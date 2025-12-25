/**
 * 冒烟测试 - 验证测试环境是否正常工作
 * 这是一个快速测试，确保基本设置正确
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, cleanupDatabase, setupTestDatabase, TEST_BASE_URL } from './setup';

describe('Smoke Test - 验证测试环境', () => {
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

  test('✅ 测试环境启动成功', async () => {
    expect(serverProcess).toBeDefined();
    expect(serverProcess.pid).toBeGreaterThan(0);
  });

  test('✅ 测试服务器响应健康检查', async () => {
    const response = await fetch(`${TEST_BASE_URL}/api/v1/health`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('API is healthy');
  });

  test('✅ 数据库连接正常', async () => {
    // 注册一个测试用户来验证数据库连接
    const response = await fetch(`${TEST_BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'smokeuser',
        email: 'smoke@test.com',
        password: 'testpass123',
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('✅ JSON 响应格式正确', async () => {
    const response = await fetch(`${TEST_BASE_URL}/api/v1/health`);
    const data = await response.json();

    // 验证响应结构
    expect(typeof data.success).toBe('boolean');
    expect(typeof data.message).toBe('string');
    expect(data.data).toBeDefined();

    // 验证内容类型
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  test('✅ 测试工具函数正常工作', async () => {
    // 验证测试数据库清理功能
    await cleanupDatabase();
    expect(true).toBe(true); // 如果没有抛出异常，说明清理成功
  });
});