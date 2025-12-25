import { Router } from "itty-router";

import { login, register } from "../controllers/authController";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategory,
  updateCategory,
} from "../controllers/categoryController";
import { createPost, deletePost, getPost, getPosts, updatePost } from "../controllers/postController";
import { changePassword, getProfile } from "../controllers/userController";
import { adminMiddleware, authMiddleware } from "../middleware/auth";
import type { APIResponse } from "../types";

export const router = Router({ base: "/api/v1" });

router.get("/health", () => {
  return new Response(
    JSON.stringify({
      success: true,
      message: "API is healthy",
      data: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    } satisfies APIResponse),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});

router.post("/auth/register", register);
router.post("/auth/login", login);

router.get("/profile", authMiddleware, getProfile);
router.post("/profile/change-password", authMiddleware, changePassword);

router.get("/posts", getPosts);
router.get("/posts/:id", getPost);
router.post("/posts", authMiddleware, createPost);
router.patch("/posts/:id", authMiddleware, updatePost);
router.delete("/posts/:id", authMiddleware, deletePost);

router.get("/categories", getCategories);
router.get("/categories/:id", getCategory);
router.post("/categories", authMiddleware, adminMiddleware, createCategory);
router.patch("/categories/:id", authMiddleware, adminMiddleware, updateCategory);
router.delete("/categories/:id", authMiddleware, adminMiddleware, deleteCategory);

router.all("*", request => {
  console.log(`404: ${request.method} ${request.url}`);
  return new Response(
    JSON.stringify({
      success: false,
      message: "Route not found",
    } satisfies APIResponse),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
});

export default router;
