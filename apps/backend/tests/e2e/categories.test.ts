/**
 * 分类管理的 E2E 测试
 * 测试分类的增删改查、权限控制（仅管理员可操作）
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

type TestUser = NonNullable<Awaited<ReturnType<typeof createTestUser>>>;

describe("Categories E2E Tests", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>;
  let client: TestApiClient;
  let adminToken: string;
  let editorToken: string;
  let adminUser: TestUser;
  let editorUser: TestUser;

  beforeAll(async () => {
    await setupTestDatabase();
    serverProcess = await startTestServer();
    client = new TestApiClient(TEST_BASE_URL);

    // 创建测试用户
    const admin = await createTestUser("admin");
    const editor = await createTestUser("editor");
    if (!admin || !editor) throw new Error("Failed to create test users");
    adminUser = admin;
    editorUser = editor;

    // 登录获取 token
    const adminLoginResponse = await client.post("/api/v1/auth/login", {
      username: adminUser.username,
      password: "testpassword123",
    });
    adminToken = adminLoginResponse.data!.token;

    const editorLoginResponse = await client.post("/api/v1/auth/login", {
      username: editorUser.username,
      password: "testpassword123",
    });
    editorToken = editorLoginResponse.data!.token;
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
    const admin = await createTestUser("admin");
    const editor = await createTestUser("editor");
    if (!admin || !editor) throw new Error("Failed to create test users");
    adminUser = admin;
    editorUser = editor;

    const adminLoginResponse = await client.post("/api/v1/auth/login", {
      username: adminUser.username,
      password: "testpassword123",
    });
    adminToken = adminLoginResponse.data!.token;

    const editorLoginResponse = await client.post("/api/v1/auth/login", {
      username: editorUser.username,
      password: "testpassword123",
    });
    editorToken = editorLoginResponse.data!.token;
  });

  describe("POST /api/v1/categories - Create Category", () => {
    test("should successfully create category as admin", async () => {
      client.setToken(adminToken);

      const response = await client.post("/api/v1/categories", {
        name: "Technology",
        slug: "technology",
        description: "Technology related posts",
      });

      expect(response.success).toBe(true);
      expect(response.message).toBe("Category created successfully");
      expect(response.data).toBeDefined();
      expect(response.data?.name).toBe("Technology");
      expect(response.data?.slug).toBe("technology");
    });

    test("should fail to create category without authentication", async () => {
      client.setToken("");

      const response = await client.post("/api/v1/categories", {
        name: "Technology",
        slug: "technology",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("Access token required");
      expect(response.status).toBe(401);
    });

    test("should fail to create category as editor (non-admin)", async () => {
      client.setToken(editorToken);

      const response = await client.post("/api/v1/categories", {
        name: "Technology",
        slug: "technology",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("Admin access required");
      expect(response.status).toBe(403);
    });

    test("should fail to create category with duplicate slug", async () => {
      client.setToken(adminToken);

      // Create first category
      await client.post("/api/v1/categories", {
        name: "Technology",
        slug: "duplicate-slug",
      });

      // Try to create with same slug
      const response = await client.post("/api/v1/categories", {
        name: "Different Name",
        slug: "duplicate-slug",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("already exists");
      expect(response.status).toBe(409);
    });

    test("should fail to create category with invalid data", async () => {
      client.setToken(adminToken);

      const response = await client.post("/api/v1/categories", {
        name: "", // Invalid: empty
        slug: "invalid slug with spaces",
      });

      expect(response.success).toBe(false);
      expect(response.message).toBe("Validation error");
      expect(response.status).toBe(400);
    });

    test("should create category with optional description", async () => {
      client.setToken(adminToken);

      const response = await client.post("/api/v1/categories", {
        name: "Science",
        slug: "science",
        description: "Scientific articles and research",
      });

      expect(response.success).toBe(true);
      expect(response.data?.description).toBe("Scientific articles and research");
    });
  });

  describe("GET /api/v1/categories - List Categories", () => {
    beforeEach(async () => {
      client.setToken(adminToken);

      // Create multiple categories
      await client.post("/api/v1/categories", {
        name: "Technology",
        slug: "technology",
      });

      await client.post("/api/v1/categories", {
        name: "Science",
        slug: "science",
      });

      await client.post("/api/v1/categories", {
        name: "Arts",
        slug: "arts",
      });
    });

    test("should get all categories without authentication", async () => {
      client.setToken("");

      const response = await client.get("/api/v1/categories");

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.length).toBeGreaterThanOrEqual(3);
      expect(response.data![0].name).toBeDefined();
      expect(response.data![0].slug).toBeDefined();
    });

    test("should get categories as authenticated user", async () => {
      client.setToken(editorToken);

      const response = await client.get("/api/v1/categories");

      expect(response.success).toBe(true);
      expect(response.data!.length).toBeGreaterThanOrEqual(3);
    });

    test("should get category by ID", async () => {
      // First create a category to get its ID
      const createResponse = await client.post("/api/v1/categories", {
        name: "Test Category",
        slug: "test-category",
      });
      const categoryId = createResponse.data!.id;

      const response = await client.get(`/api/v1/categories/${categoryId}`);

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(categoryId);
      expect(response.data?.name).toBe("Test Category");
    });

    test("should return 404 for non-existent category", async () => {
      const response = await client.get("/api/v1/categories/99999");

      expect(response.success).toBe(false);
      expect(response.message).toBe("Category not found");
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/categories/:id - Update Category", () => {
    let categoryId: number;

    beforeEach(async () => {
      client.setToken(adminToken);
      const createResponse = await client.post("/api/v1/categories", {
        name: "Original Name",
        slug: "original-slug",
        description: "Original description",
      });
      categoryId = createResponse.data!.id;
    });

    test("should update category as admin", async () => {
      const response = await client.patch(`/api/v1/categories/${categoryId}`, {
        name: "Updated Name",
        description: "Updated description",
      });

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe("Updated Name");
      expect(response.data?.description).toBe("Updated description");
    });

    test("should fail to update category as editor", async () => {
      client.setToken(editorToken);

      const response = await client.patch(`/api/v1/categories/${categoryId}`, {
        name: "Hacked Name",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("Admin access required");
      expect(response.status).toBe(403);
    });

    test("should fail to update category without authentication", async () => {
      client.setToken("");

      const response = await client.patch(`/api/v1/categories/${categoryId}`, {
        name: "Hacked Name",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("Access token required");
      expect(response.status).toBe(401);
    });

    test("should fail to update with duplicate slug", async () => {
      // Create another category
      await client.post("/api/v1/categories", {
        name: "Another Category",
        slug: "another-slug",
      });

      // Try to update first category with second's slug
      const response = await client.patch(`/api/v1/categories/${categoryId}`, {
        slug: "another-slug",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("already exists");
      expect(response.status).toBe(409);
    });

    test("should update only name", async () => {
      const response = await client.patch(`/api/v1/categories/${categoryId}`, {
        name: "Only Name Updated",
      });

      expect(response.success).toBe(true);
      expect(response.data?.name).toBe("Only Name Updated");
      expect(response.data?.slug).toBe("original-slug"); // Unchanged
      expect(response.data?.description).toBe("Original description"); // Unchanged
    });

    test("should update only description to null", async () => {
      const response = await client.patch(`/api/v1/categories/${categoryId}`, {
        description: null,
      });

      expect(response.success).toBe(true);
      expect(response.data?.description).toBeNull();
    });
  });

  describe("DELETE /api/v1/categories/:id - Delete Category", () => {
    test("should delete category as admin", async () => {
      client.setToken(adminToken);

      const createResponse = await client.post("/api/v1/categories", {
        name: "To Delete",
        slug: "to-delete",
      });
      const categoryId = createResponse.data!.id;

      const response = await client.delete(`/api/v1/categories/${categoryId}`);

      expect(response.success).toBe(true);
      expect(response.message).toBe("Category deleted successfully");

      // Verify it's deleted
      const getResponse = await client.get(`/api/v1/categories/${categoryId}`);
      expect(getResponse.success).toBe(false);
      expect(getResponse.status).toBe(404);
    });

    test("should fail to delete category as editor", async () => {
      client.setToken(adminToken);
      const createResponse = await client.post("/api/v1/categories", {
        name: "To Delete",
        slug: "to-delete",
      });
      const categoryId = createResponse.data!.id;

      client.setToken(editorToken);
      const response = await client.delete(`/api/v1/categories/${categoryId}`);

      expect(response.success).toBe(false);
      expect(response.message).toContain("Admin access required");
      expect(response.status).toBe(403);
    });

    test("should fail to delete without authentication", async () => {
      client.setToken(adminToken);
      const createResponse = await client.post("/api/v1/categories", {
        name: "To Delete",
        slug: "to-delete",
      });
      const categoryId = createResponse.data!.id;

      client.setToken("");
      const response = await client.delete(`/api/v1/categories/${categoryId}`);

      expect(response.success).toBe(false);
      expect(response.message).toContain("Access token required");
      expect(response.status).toBe(401);
    });

    test("should return 404 for deleting non-existent category", async () => {
      client.setToken(adminToken);

      const response = await client.delete("/api/v1/categories/99999");

      expect(response.success).toBe(false);
      expect(response.message).toBe("Category not found");
      expect(response.status).toBe(404);
    });
  });

  describe("Permission Scenarios", () => {
    test("admin can perform all category operations", async () => {
      client.setToken(adminToken);

      // Create
      const createResponse = await client.post("/api/v1/categories", {
        name: "Admin Category",
        slug: "admin-category",
      });
      const categoryId = createResponse.data!.id;

      // Read
      const getResponse = await client.get(`/api/v1/categories/${categoryId}`);
      expect(getResponse.success).toBe(true);

      // Update
      const updateResponse = await client.patch(`/api/v1/categories/${categoryId}`, {
        name: "Updated Admin Category",
      });
      expect(updateResponse.success).toBe(true);

      // Delete
      const deleteResponse = await client.delete(`/api/v1/categories/${categoryId}`);
      expect(deleteResponse.success).toBe(true);
    });

    test("editor can only read categories", async () => {
      client.setToken(adminToken);

      // Admin creates a category
      const createResponse = await client.post("/api/v1/categories", {
        name: "Test Category",
        slug: "test-category",
      });
      const categoryId = createResponse.data!.id;

      // Editor can read
      client.setToken(editorToken);
      const getResponse = await client.get(`/api/v1/categories/${categoryId}`);
      expect(getResponse.success).toBe(true);

      // Editor cannot create
      const createAttempt = await client.post("/api/v1/categories", {
        name: "Editor Category",
        slug: "editor-category",
      });
      expect(createAttempt.success).toBe(false);
      expect(createAttempt.status).toBe(403);

      // Editor cannot update
      const updateAttempt = await client.patch(`/api/v1/categories/${categoryId}`, {
        name: "Hacked",
      });
      expect(updateAttempt.success).toBe(false);
      expect(updateAttempt.status).toBe(403);

      // Editor cannot delete
      const deleteAttempt = await client.delete(`/api/v1/categories/${categoryId}`);
      expect(deleteAttempt.success).toBe(false);
      expect(deleteAttempt.status).toBe(403);
    });

    test("unauthenticated user can only read categories", async () => {
      client.setToken(adminToken);

      // Admin creates a category
      const createResponse = await client.post("/api/v1/categories", {
        name: "Test Category",
        slug: "test-category",
      });
      const categoryId = createResponse.data!.id;

      // Unauthenticated user can read
      client.setToken("");
      const getResponse = await client.get(`/api/v1/categories/${categoryId}`);
      expect(getResponse.success).toBe(true);

      // Unauthenticated user cannot create
      const createAttempt = await client.post("/api/v1/categories", {
        name: "Guest Category",
        slug: "guest-category",
      });
      expect(createAttempt.success).toBe(false);
      expect(createAttempt.status).toBe(401);

      // Unauthenticated user cannot update
      const updateAttempt = await client.patch(`/api/v1/categories/${categoryId}`, {
        name: "Hacked",
      });
      expect(updateAttempt.success).toBe(false);
      expect(updateAttempt.status).toBe(401);

      // Unauthenticated user cannot delete
      const deleteAttempt = await client.delete(`/api/v1/categories/${categoryId}`);
      expect(deleteAttempt.success).toBe(false);
      expect(deleteAttempt.status).toBe(401);
    });
  });

  describe("Integration with Posts", () => {
    test("categories can be associated with posts", async () => {
      client.setToken(adminToken);

      // Create categories
      const techResponse = await client.post("/api/v1/categories", {
        name: "Technology",
        slug: "technology",
      });
      const sciResponse = await client.post("/api/v1/categories", {
        name: "Science",
        slug: "science",
      });

      // Login as editor to create post
      client.setToken(editorToken);

      const postResponse = await client.post("/api/v1/posts", {
        title: "Tech and Science Post",
        slug: "tech-science-post",
        content: "Post about technology and science",
        categoryIds: [techResponse.data!.id, sciResponse.data!.id],
      });

      expect(postResponse.success).toBe(true);
      expect(postResponse.data?.categories).toBeDefined();
      expect(postResponse.data?.categories.length).toBe(2);
    });
  });
});
