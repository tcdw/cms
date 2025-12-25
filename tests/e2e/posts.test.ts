/**
 * 文章管理的 E2E 测试
 * 测试文章的增删改查、权限控制、搜索等功能
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import {
  cleanupDatabase,
  createTestUser,
  setupTestDatabase,
  startTestServer,
  TEST_BASE_URL,
  TestApiClient,
} from "./setup";

describe("Posts E2E Tests", () => {
  let serverProcess: Bun.Process;
  let client: TestApiClient;
  let authToken: string;
  let adminToken: string;
  let regularUser: Awaited<ReturnType<typeof createTestUser>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    await setupTestDatabase();
    serverProcess = await startTestServer();
    client = new TestApiClient(TEST_BASE_URL);

    // 创建测试用户
    regularUser = await createTestUser("editor");
    adminUser = await createTestUser("admin");

    // 登录获取 token
    const loginResponse = await client.post("/api/v1/auth/login", {
      username: regularUser.username,
      password: "testpassword123",
    });
    authToken = loginResponse.data!.token;

    const adminLoginResponse = await client.post("/api/v1/auth/login", {
      username: adminUser.username,
      password: "testpassword123",
    });
    adminToken = adminLoginResponse.data!.token;
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    await cleanupDatabase();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    // 重新创建用户
    regularUser = await createTestUser("editor");
    adminUser = await createTestUser("admin");

    const loginResponse = await client.post("/api/v1/auth/login", {
      username: regularUser.username,
      password: "testpassword123",
    });
    authToken = loginResponse.data!.token;

    const adminLoginResponse = await client.post("/api/v1/auth/login", {
      username: adminUser.username,
      password: "testpassword123",
    });
    adminToken = adminLoginResponse.data!.token;
  });

  describe("POST /api/v1/posts - Create Post", () => {
    test("should successfully create a post with authentication", async () => {
      client.setToken(authToken);

      const response = await client.post("/api/v1/posts", {
        title: "Test Post",
        slug: "test-post",
        content: "This is test content",
        excerpt: "Test excerpt",
        status: "draft",
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe("Post created successfully");
      expect(response.data).toBeDefined();
      expect(response.data?.title).toBe("Test Post");
      expect(response.data?.slug).toBe("test-post");
      expect(response.data?.author.id).toBe(regularUser.id);
    });

    test("should fail to create post without authentication", async () => {
      client.setToken(""); // Clear token to test without authentication
      const response = await client.post("/api/v1/posts", {
        title: "Test Post",
        slug: "test-post",
        content: "Content",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("Access token required");
      expect(response.status).toBe(401);
    });

    test("should fail to create post with duplicate slug", async () => {
      client.setToken(authToken);

      // 创建第一篇文章
      await client.post("/api/v1/posts", {
        title: "First Post",
        slug: "duplicate-slug",
        content: "Content 1",
      });

      // 尝试创建相同 slug 的文章
      const response = await client.post("/api/v1/posts", {
        title: "Second Post",
        slug: "duplicate-slug",
        content: "Content 2",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("already exists");
      expect(response.status).toBe(409);
    });

    test("should fail to create post with invalid slug format", async () => {
      client.setToken(authToken);

      const response = await client.post("/api/v1/posts", {
        title: "Test Post",
        slug: "Invalid Slug With Spaces", // 无效格式
        content: "Content",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("Validation error");
      expect(response.status).toBe(400);
    });

    test("should create post with featured image", async () => {
      client.setToken(authToken);

      const response = await client.post("/api/v1/posts", {
        title: "Post with Image",
        slug: "post-with-image",
        content: "Content",
        featuredImage: "https://example.com/image.jpg",
      });

      expect(response.success).toBe(true);
      expect(response.data?.featuredImage).toBe("https://example.com/image.jpg");
    });
  });

  describe("GET /api/v1/posts - List Posts", () => {
    beforeEach(async () => {
      client.setToken(authToken);

      // 创建多篇文章用于测试
      await client.post("/api/v1/posts", {
        title: "First Post",
        slug: "first-post",
        content: "Content 1",
        status: "published",
      });

      await client.post("/api/v1/posts", {
        title: "Second Post",
        slug: "second-post",
        content: "Content 2",
        status: "draft",
      });

      await client.post("/api/v1/posts", {
        title: "Third Post",
        slug: "third-post",
        content: "Content 3 with keyword",
        status: "published",
      });
    });

    test("should get all posts without authentication", async () => {
      client.setToken(""); // 清除 token

      const response = await client.get("/api/v1/posts");

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.length).toBeGreaterThanOrEqual(3);
      expect(response.pagination).toBeDefined();
    });

    test("should filter posts by status", async () => {
      const response = await client.get("/api/v1/posts?status=published");

      expect(response.success).toBe(true);
      expect(response.data!.every((p: { status: string }) => p.status === "published")).toBe(true);
      expect(response.data!.length).toBe(2);
    });

    test("should search posts by title and content", async () => {
      const response = await client.get("/api/v1/posts?search=keyword");

      expect(response.success).toBe(true);
      expect(response.data!.length).toBe(1);
      expect(response.data![0].title).toBe("Third Post");
    });

    test("should paginate results", async () => {
      const response = await client.get("/api/v1/posts?page=1&limit=2");

      expect(response.success).toBe(true);
      expect(response.data!.length).toBe(2);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.limit).toBe(2);
      expect(response.pagination.total).toBeGreaterThanOrEqual(3);
    });

    test("should sort posts by different fields", async () => {
      const response = await client.get("/api/v1/posts?sortBy=title&sortOrder=asc");

      expect(response.success).toBe(true);
      expect(response.data!.length).toBeGreaterThan(0);
      // 验证按标题升序排列
      const titles = response.data!.map((p: { title: string }) => p.title);
      const sortedTitles = [...titles].sort();
      expect(titles).toEqual(sortedTitles);
    });
  });

  describe("GET /api/v1/posts/:id - Get Single Post", () => {
    let postId: number;

    beforeEach(async () => {
      client.setToken(authToken);
      const createResponse = await client.post("/api/v1/posts", {
        title: "Single Post Test",
        slug: "single-post-test",
        content: "Test content",
      });
      postId = createResponse.data!.id;
    });

    test("should get post by ID", async () => {
      const response = await client.get(`/api/v1/posts/${postId}`);

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(postId);
      expect(response.data?.title).toBe("Single Post Test");
      expect(response.data?.author).toBeDefined();
    });

    test("should return 404 for non-existent post", async () => {
      const response = await client.get("/api/v1/posts/99999");

      expect(response.success).toBe(false);
      expect(response.message).toBe("Post not found");
      expect(response.status).toBe(404);
    });

    test("should include categories in post response", async () => {
      // 首先需要创建分类功能，这里暂时跳过
      // 实际测试中应该创建分类并关联文章
      const response = await client.get(`/api/v1/posts/${postId}`);

      expect(response.success).toBe(true);
      expect(response.data?.categories).toBeDefined();
      expect(Array.isArray(response.data?.categories)).toBe(true);
    });
  });

  describe("PATCH /api/v1/posts/:id - Update Post", () => {
    let postId: number;

    beforeEach(async () => {
      client.setToken(authToken);
      const createResponse = await client.post("/api/v1/posts", {
        title: "Original Title",
        slug: "original-slug",
        content: "Original content",
      });
      postId = createResponse.data!.id;
    });

    test("should update own post", async () => {
      const response = await client.patch(`/api/v1/posts/${postId}`, {
        title: "Updated Title",
        content: "Updated content",
      });

      expect(response.success).toBe(true);
      expect(response.data?.title).toBe("Updated Title");
      expect(response.data?.content).toBe("Updated content");
    });

    test("should fail to update another user's post", async () => {
      // Create post as regular user
      client.setToken(authToken);
      const createResponse = await client.post("/api/v1/posts", {
        title: "User 1 Post",
        slug: "user1-post",
        content: "Content",
      });
      const user1PostId = createResponse.data!.id;

      // Try to update as different user
      const differentUser = await createTestUser("editor");
      const loginResponse = await client.post("/api/v1/auth/login", {
        username: differentUser.username,
        password: "testpassword123",
      });
      client.setToken(loginResponse.data!.token);

      const response = await client.patch(`/api/v1/posts/${user1PostId}`, {
        title: "Hacked Title",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("only edit your own posts");
      expect(response.status).toBe(403);
    });

    test("should allow admin to update any post", async () => {
      // Create post as regular user
      client.setToken(authToken);
      const createResponse = await client.post("/api/v1/posts", {
        title: "Regular User Post",
        slug: "regular-post",
        content: "Content",
      });
      const postId = createResponse.data!.id;

      // Update as admin
      client.setToken(adminToken);
      const response = await client.patch(`/api/v1/posts/${postId}`, {
        title: "Admin Updated Title",
      });

      expect(response.success).toBe(true);
      expect(response.data?.title).toBe("Admin Updated Title");
    });

    test("should fail to update with duplicate slug", async () => {
      // Create second post
      await client.post("/api/v1/posts", {
        title: "Second Post",
        slug: "second-slug",
        content: "Content",
      });

      // Try to update first post with second post's slug
      const response = await client.patch(`/api/v1/posts/${postId}`, {
        slug: "second-slug",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("already exists");
      expect(response.status).toBe(409);
    });

    test("should fail to update with invalid slug", async () => {
      const response = await client.patch(`/api/v1/posts/${postId}`, {
        slug: "Invalid Slug",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("Validation error");
      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/posts/:id - Delete Post", () => {
    test("should delete own post", async () => {
      client.setToken(authToken);
      const createResponse = await client.post("/api/v1/posts", {
        title: "To Delete",
        slug: "to-delete",
        content: "Content",
      });
      const postId = createResponse.data!.id;

      const response = await client.delete(`/api/v1/posts/${postId}`);

      expect(response.success).toBe(true);
      expect(response.message).toBe("Post deleted successfully");

      // Verify it's deleted
      const getResponse = await client.get(`/api/v1/posts/${postId}`);
      expect(getResponse.success).toBe(false);
      expect(getResponse.status).toBe(404);
    });

    test("should fail to delete another user's post", async () => {
      // Create post as regular user
      client.setToken(authToken);
      const createResponse = await client.post("/api/v1/posts", {
        title: "User 1 Post",
        slug: "user1-post",
        content: "Content",
      });
      const postId = createResponse.data!.id;

      // Try to delete as different user
      const differentUser = await createTestUser("editor");
      const loginResponse = await client.post("/api/v1/auth/login", {
        username: differentUser.username,
        password: "testpassword123",
      });
      client.setToken(loginResponse.data!.token);

      const response = await client.delete(`/api/v1/posts/${postId}`);

      expect(response.success).toBe(false);
      expect(response.message).toContain("only delete your own posts");
      expect(response.status).toBe(403);
    });

    test("should allow admin to delete any post", async () => {
      // Create post as regular user
      client.setToken(authToken);
      const createResponse = await client.post("/api/v1/posts", {
        title: "Regular User Post",
        slug: "regular-post",
        content: "Content",
      });
      const postId = createResponse.data!.id;

      // Delete as admin
      client.setToken(adminToken);
      const response = await client.delete(`/api/v1/posts/${postId}`);

      expect(response.success).toBe(true);
      expect(response.message).toBe("Post deleted successfully");
    });

    test("should return 404 for deleting non-existent post", async () => {
      client.setToken(authToken);

      const response = await client.delete("/api/v1/posts/99999");

      expect(response.success).toBe(false);
      expect(response.message).toBe("Post not found");
      expect(response.status).toBe(404);
    });
  });

  describe("Permission Scenarios", () => {
    test("editor can create and manage own posts", async () => {
      client.setToken(authToken);

      // Create
      const createResponse = await client.post("/api/v1/posts", {
        title: "Editor Post",
        slug: "editor-post",
        content: "Content",
      });
      const postId = createResponse.data!.id;

      // Update
      const updateResponse = await client.patch(`/api/v1/posts/${postId}`, {
        title: "Updated Editor Post",
      });
      expect(updateResponse.success).toBe(true);

      // Delete
      const deleteResponse = await client.delete(`/api/v1/posts/${postId}`);
      expect(deleteResponse.success).toBe(true);
    });

    test("admin can manage all posts", async () => {
      // Create post as editor
      client.setToken(authToken);
      const createResponse = await client.post("/api/v1/posts", {
        title: "Editor Post",
        slug: "editor-post-admin-test",
        content: "Content",
      });
      const postId = createResponse.data!.id;

      // Admin updates and deletes
      client.setToken(adminToken);

      const updateResponse = await client.patch(`/api/v1/posts/${postId}`, {
        title: "Admin Updated",
      });
      expect(updateResponse.success).toBe(true);

      const deleteResponse = await client.delete(`/api/v1/posts/${postId}`);
      expect(deleteResponse.success).toBe(true);
    });
  });
});
