import { Router } from 'itty-router';
import type { IRequest } from 'itty-router';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { register, login } from '../controllers/authController';
import { changePassword, getProfile } from '../controllers/userController';
import {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
} from '../controllers/postController';
import {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController';
import type { APIResponse } from '../types';

export const router = Router({ base: '/api/v1' });

router.get('/health', () => {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'API is healthy',
      data: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    } satisfies APIResponse),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

router.post('/auth/register', register);
router.post('/auth/login', login);

router.get('/profile', authMiddleware, getProfile);
router.post('/profile/change-password', authMiddleware, changePassword);

router.get('/posts', getPosts);
router.get('/posts/:id', getPost);
router.post('/posts', authMiddleware, createPost);
router.patch('/posts/:id', authMiddleware, updatePost);
router.delete('/posts/:id', authMiddleware, deletePost);

router.get('/categories', getCategories);
router.get('/categories/:id', getCategory);
router.post('/categories', authMiddleware, adminMiddleware, createCategory);
router.patch('/categories/:id', authMiddleware, adminMiddleware, updateCategory);
router.delete('/categories/:id', authMiddleware, adminMiddleware, deleteCategory);

router.all('*', (request) => {
  console.log(`404: ${request.method} ${request.url}`);
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Route not found',
    } satisfies APIResponse),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

export default router;