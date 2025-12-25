/**
 * 认证流程的 E2E 测试
 * 测试注册、登录、JWT 验证等完整流程
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import {
  startTestServer,
  cleanupDatabase,
  setupTestDatabase,
  TestApiClient,
  TEST_BASE_URL,
  createTestUser,
} from './setup';

describe('Authentication E2E Tests', () => {
  let serverProcess: Bun.Process;
  let client: TestApiClient;

  beforeAll(async () => {
    await setupTestDatabase();
    serverProcess = await startTestServer();
    client = new TestApiClient(TEST_BASE_URL);
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    await cleanupDatabase();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    client.setToken('');
  });

  describe('POST /api/v1/auth/register', () => {
    test('should successfully register a new user', async () => {
      const response = await client.post('/api/v1/auth/register', {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'editor',
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe('User registered successfully');
      expect(response.data).toBeDefined();
      expect(response.data?.username).toBe('newuser');
      expect(response.data?.email).toBe('newuser@example.com');
      expect(response.data?.role).toBe('editor');
      expect(response.data?.password).toBeUndefined(); // 密码不应该返回
    });

    test('should fail to register with duplicate username', async () => {
      // 先创建一个用户
      await client.post('/api/v1/auth/register', {
        username: 'duplicate',
        email: 'user1@example.com',
        password: 'password123',
      });

      // 尝试创建相同用户名的用户
      const response = await client.post('/api/v1/auth/register', {
        username: 'duplicate',
        email: 'user2@example.com',
        password: 'password123',
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain('already exists');
      expect(response.status).toBe(409);
    });

    test('should fail to register with invalid data', async () => {
      const response = await client.post('/api/v1/auth/register', {
        username: '', // 无效：空用户名
        email: 'invalid-email',
        password: '123', // 无效：太短
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Validation error');
      expect(response.status).toBe(400);
      expect(response.errors).toBeDefined();
      expect(response.errors!.length).toBeGreaterThan(0);
    });

    test('should register admin user', async () => {
      const response = await client.post('/api/v1/auth/register', {
        username: 'adminuser',
        email: 'admin@example.com',
        password: 'securepassword',
        role: 'admin',
      });

      expect(response.success).toBe(true);
      expect(response.data?.role).toBe('admin');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    test('should successfully login with correct credentials', async () => {
      // 先注册用户
      await client.post('/api/v1/auth/register', {
        username: 'loginuser',
        email: 'login@example.com',
        password: 'testpassword',
      });

      // 登录
      const response = await client.post('/api/v1/auth/login', {
        username: 'loginuser',
        password: 'testpassword',
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe('Login successful');
      expect(response.data).toBeDefined();
      expect(response.data?.user).toBeDefined();
      expect(response.data?.token).toBeDefined();
      expect(typeof response.data?.token).toBe('string');
      expect(response.data?.token.length).toBeGreaterThan(0);
    });

    test('should fail to login with wrong password', async () => {
      // 先注册用户
      await client.post('/api/v1/auth/register', {
        username: 'wrongpass',
        email: 'wrong@example.com',
        password: 'correctpassword',
      });

      // 使用错误密码登录
      const response = await client.post('/api/v1/auth/login', {
        username: 'wrongpass',
        password: 'wrongpassword',
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Invalid username or password');
      expect(response.status).toBe(401);
    });

    test('should fail to login with non-existent user', async () => {
      const response = await client.post('/api/v1/auth/login', {
        username: 'nonexistent',
        password: 'anypassword',
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Invalid username or password');
      expect(response.status).toBe(401);
    });

    test('should fail to login with invalid data', async () => {
      const response = await client.post('/api/v1/auth/login', {
        username: '',
        password: '',
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe('Validation error');
      expect(response.status).toBe(400);
    });
  });

  describe('Authentication Flow Integration', () => {
    test('should complete registration -> login -> protected route flow', async () => {
      // 1. 注册
      const registerResponse = await client.post('/api/v1/auth/register', {
        username: 'integrationuser',
        email: 'integration@example.com',
        password: 'integrationpass',
      });

      expect(registerResponse.success).toBe(true);

      // 2. 登录获取 token
      const loginResponse = await client.post('/api/v1/auth/login', {
        username: 'integrationuser',
        password: 'integrationpass',
      });

      expect(loginResponse.success).toBe(true);
      expect(loginResponse.data?.token).toBeDefined();

      // 3. 设置 token
      client.setToken(loginResponse.data!.token);

      // 4. 访问受保护的路由
      const profileResponse = await client.get('/api/v1/profile');

      expect(profileResponse.success).toBe(true);
      expect(profileResponse.data).toBeDefined();
      expect(profileResponse.data?.username).toBe('integrationuser');
      expect(profileResponse.data?.email).toBe('integration@example.com');
    });

    test('should fail to access protected route without token', async () => {
      const response = await client.get('/api/v1/profile');

      expect(response.success).toBe(false);
      expect(response.message).toContain('Access token required');
      expect(response.status).toBe(401);
    });

    test('should fail to access protected route with invalid token', async () => {
      client.setToken('invalid.token.here');

      const response = await client.get('/api/v1/profile');

      expect(response.success).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('User Profile Management', () => {
    let authToken: string;
    let testUser: any;

    beforeEach(async () => {
      // 创建测试用户并登录
      testUser = await createTestUser('editor');
      const loginResponse = await client.post('/api/v1/auth/login', {
        username: testUser.username,
        password: 'testpassword123',
      });
      authToken = loginResponse.data!.token;
      client.setToken(authToken);
    });

    test('should get user profile', async () => {
      const response = await client.get('/api/v1/profile');

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(testUser.id);
      expect(response.data?.username).toBe(testUser.username);
      expect(response.data?.email).toBe(testUser.email);
      expect(response.data?.role).toBe(testUser.role);
    });

    test('should change password', async () => {
      const response = await client.post('/api/v1/profile/change-password', {
        currentPassword: 'testpassword123',
        newPassword: 'newpassword456',
      });

      expect(response.success).toBe(true);
      expect(response.message).toContain('Password changed successfully');

      // 验证新密码可以登录
      const loginWithNewPassword = await client.post('/api/v1/auth/login', {
        username: testUser.username,
        password: 'newpassword456',
      });

      expect(loginWithNewPassword.success).toBe(true);
    });

    test('should fail to change password with wrong current password', async () => {
      const response = await client.post('/api/v1/profile/change-password', {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword456',
      });

      expect(response.success).toBe(false);
      expect(response.status).toBe(401);
    });
  });
});