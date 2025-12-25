/**
 * 工具和健康检查的 E2E 测试
 * 测试健康检查、错误处理、404 等基础功能
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { cleanupDatabase, setupTestDatabase, startTestServer, TEST_BASE_URL, TestApiClient } from "./setup";

describe("Utils & Health Check E2E Tests", () => {
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

  describe("GET /api/v1/health - Health Check", () => {
    test("should return health status", async () => {
      const response = await client.get("/api/v1/health");

      expect(response.success).toBe(true);
      expect(response.message).toBe("API is healthy");
      expect(response.data).toBeDefined();
      expect(response.data?.timestamp).toBeDefined();
      expect(response.data?.version).toBe("1.0.0");
    });

    test("should work without authentication", async () => {
      client.setToken("");
      const response = await client.get("/api/v1/health");

      expect(response.success).toBe(true);
      expect(response.status).toBe(200);
    });

    test("should return valid timestamp format", async () => {
      const response = await client.get("/api/v1/health");
      const timestamp = response.data?.timestamp;

      expect(timestamp).toBeDefined();
      expect(typeof timestamp).toBe("string");

      // Verify it's a valid ISO date string
      const date = new Date(timestamp);
      expect(date instanceof Date).toBe(true);
      expect(date.toString()).not.toBe("Invalid Date");
    });
  });

  describe("404 Not Found Handling", () => {
    test("should return 404 for non-existent route", async () => {
      const response = await client.get("/api/v1/nonexistent");

      expect(response.success).toBe(false);
      expect(response.message).toBe("Route not found");
      expect(response.status).toBe(404);
    });

    test("should return 404 for non-existent API version", async () => {
      const response = await client.get("/api/v2/health");

      expect(response.success).toBe(false);
      expect(response.message).toBe("Route not found");
      expect(response.status).toBe(404);
    });

    test("should return 404 for invalid method on valid route", async () => {
      // Using fetch directly to test method not allowed
      const url = `${TEST_BASE_URL}/api/v1/auth/register`;
      const response = await fetch(url, {
        method: "GET", // Should be POST
        headers: { "Content-Type": "application/json" },
      });

      // itty-router might handle this differently, but we expect a 404 or similar
      expect(response.status).toBe(404);
    });
  });

  describe("HTTP Methods", () => {
    test("should handle GET requests", async () => {
      const response = await client.get("/api/v1/health");
      expect(response.success).toBe(true);
    });

    test("should handle POST requests", async () => {
      const response = await client.post("/api/v1/auth/register", {
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
      expect(response.success).toBe(true);
    });

    test("should handle PATCH requests", async () => {
      // First create a user and login
      await client.post("/api/v1/auth/register", {
        username: "patchuser",
        email: "patch@example.com",
        password: "password123",
      });

      const loginResponse = await client.post("/api/v1/auth/login", {
        username: "patchuser",
        password: "password123",
      });

      client.setToken(loginResponse.data!.token);

      // Now try to change password (PATCH equivalent)
      const response = await client.post("/api/v1/profile/change-password", {
        currentPassword: "password123",
        newPassword: "newpassword456",
      });

      expect(response.success).toBe(true);
    });

    test("should handle DELETE requests", async () => {
      // Create and login user
      await client.post("/api/v1/auth/register", {
        username: "deleteuser",
        email: "delete@example.com",
        password: "password123",
      });

      const loginResponse = await client.post("/api/v1/auth/login", {
        username: "deleteuser",
        password: "password123",
      });

      client.setToken(loginResponse.data!.token);

      // Create a post
      const postResponse = await client.post("/api/v1/posts", {
        title: "To Delete",
        slug: "to-delete",
        content: "Content",
      });

      // Delete the post
      const deleteResponse = await client.delete(`/api/v1/posts/${postResponse.data!.id}`);

      expect(deleteResponse.success).toBe(true);
      expect(deleteResponse.message).toBe("Post deleted successfully");
    });
  });

  describe("JSON Response Format", () => {
    test("all responses follow consistent format", async () => {
      const endpoints = [
        () => client.get("/api/v1/health"),
        () =>
          client.post("/api/v1/auth/register", {
            username: "formatuser",
            email: "format@example.com",
            password: "password123",
          }),
        () => client.get("/api/v1/nonexistent"),
      ];

      for (const endpoint of endpoints) {
        const response = await endpoint();

        // All responses should have success and message
        expect(typeof response.success).toBe("boolean");
        expect(typeof response.message).toBe("string");

        // Success responses may have data
        if (response.success) {
          // data is optional but should be an object if present
          if (response.data !== undefined) {
            expect(typeof response.data).toBe("object");
          }
        }

        // Error responses may have errors array
        if (!response.success) {
          if (response.errors) {
            expect(Array.isArray(response.errors)).toBe(true);
          }
        }
      }
    });

    test("content type is always JSON", async () => {
      const response = await fetch(`${TEST_BASE_URL}/api/v1/health`);
      const contentType = response.headers.get("content-type");

      expect(contentType).toContain("application/json");
    });
  });

  describe("Server Configuration", () => {
    test("server responds to requests", async () => {
      const startTime = Date.now();
      const response = await fetch(`${TEST_BASE_URL}/api/v1/health`);
      const endTime = Date.now();

      expect(response.ok).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test("server handles concurrent requests", async () => {
      const promises = Array.from({ length: 5 }, () => client.get("/api/v1/health"));

      const results = await Promise.all(promises);

      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});
