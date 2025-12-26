import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "editor"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const postStatusSchema = z.enum(["draft", "published"]);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const postContentTypeSchema = z.enum(["markdown", "html"]);
export type PostContentType = z.infer<typeof postContentTypeSchema>;

export const authUserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const jwtPayloadSchema = z.object({
  userId: z.number().int(),
  username: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
});
export type JWTPayload = z.infer<typeof jwtPayloadSchema>;

export interface APIResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  errors: z.array(z.string()).optional(),
});

export const paginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const createApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  apiResponseSchema.extend({
    data: dataSchema.optional(),
  });

export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.boolean(),
    data: z.array(itemSchema),
    pagination: paginationSchema,
  });

export const insertUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleSchema.default("editor"),
});
export type InsertUserInput = z.infer<typeof insertUserSchema>;

export const selectUserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  email: z.string(),
  password: z.string(),
  role: userRoleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type SelectUser = z.infer<typeof selectUserSchema>;

export const insertCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).nullable().optional(),
});
export type InsertCategoryInput = z.infer<typeof insertCategorySchema>;

export const insertPostSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  contentType: postContentTypeSchema.default("markdown"),
  excerpt: z.string().max(500).optional(),
  status: postStatusSchema.default("draft"),
  featuredImage: z.string().url().optional(),
});
export type InsertPostInput = z.infer<typeof insertPostSchema>;
