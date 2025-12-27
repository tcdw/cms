import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { IRequest } from "itty-router";
import { z } from "zod";

import { insertPostSchema } from "@onechu/schemas";

import { db } from "../db";
import { categories, postCategories, posts, users } from "../db";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { PaginatedResponse } from "../types";
import { isZodError, validateSlug } from "../utils/validation";
import { createAPIResponse, createPaginatedResponse } from "../utils/wrapper";

const postUpdateSchema = insertPostSchema.partial();

const postsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["draft", "published"]).optional(),
  category: z.coerce.number().int().positive().optional(),
  author: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["created_at", "updated_at", "title"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export async function createPost(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return createAPIResponse(
        {
          success: false,
          message: "Authentication required",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { categoryIds?: number[] };
    const data = insertPostSchema.parse(body);

    if (!validateSlug(data.slug)) {
      return createAPIResponse(
        {
          success: false,
          message: "Invalid slug format",
          errors: ["Slug must contain only lowercase letters, numbers, and hyphens"],
        },
        { status: 400 },
      );
    }

    const [existingPost] = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);

    if (existingPost) {
      return createAPIResponse(
        {
          success: false,
          message: "Post slug already exists",
        },
        { status: 409 },
      );
    }

    const categoryIds = body.categoryIds || [];
    if (categoryIds.length > 0) {
      const validCategories = await db.select().from(categories).where(inArray(categories.id, categoryIds));

      if (validCategories.length !== categoryIds.length) {
        return createAPIResponse(
          {
            success: false,
            message: "One or more categories not found",
          },
          { status: 404 },
        );
      }
    }

    const [post] = await db
      .insert(posts)
      .values({
        title: data.title,
        slug: data.slug,
        content: data.content,
        contentType: data.contentType,
        excerpt: data.excerpt,
        status: data.status,
        featuredImage: data.featuredImage,
        authorId: request.user.id,
      })
      .returning();

    if (!post) {
      throw new Error("Failed to create post");
    }

    if (categoryIds.length > 0) {
      await db.insert(postCategories).values(
        categoryIds.map((categoryId: number) => ({
          postId: post.id,
          categoryId,
        })),
      );
    }

    const [postWithAuthor] = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
        contentType: posts.contentType,
        excerpt: posts.excerpt,
        status: posts.status,
        featuredImage: posts.featuredImage,
        author: {
          id: users.id,
          username: users.username,
          email: users.email,
        },
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(eq(posts.id, post.id))
      .leftJoin(users, eq(posts.authorId, users.id))
      .limit(1);

    // Get categories for the post
    const postCategoriesList = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      })
      .from(postCategories)
      .where(eq(postCategories.postId, post.id))
      .leftJoin(categories, eq(postCategories.categoryId, categories.id));

    const postWithCategories = {
      ...postWithAuthor,
      categories: postCategoriesList,
    };

    return createAPIResponse(
      {
        success: true,
        message: "Post created successfully",
        data: postWithCategories,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isZodError(error)) {
      const zodError = error as z.ZodError;
      const issues = zodError.issues || [];
      return createAPIResponse(
        {
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        },
        { status: 400 },
      );
    }

    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      },
      { status: 500 },
    );
  }
}

export async function getPosts(request: IRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);
    const query = postsQuerySchema.parse({
      ...params,
      page: params.page ? Number(params.page) : undefined,
      limit: params.limit ? Number(params.limit) : undefined,
      category: params.category ? Number(params.category) : undefined,
      author: params.author ? Number(params.author) : undefined,
    });

    const offset = (query.page - 1) * query.limit;

    let whereClause;
    const conditions = [];

    if (query.status) {
      conditions.push(eq(posts.status, query.status));
    }

    if (query.author) {
      conditions.push(eq(posts.authorId, query.author));
    }

    if (query.search) {
      // 按空格分隔关键词，过滤掉空字符串
      const keywords = query.search.split(/\s+/).filter(k => k.length > 0);
      if (keywords.length > 0) {
        // 每个关键词生成一个条件（匹配 title 或 content），多个关键词用 OR 连接
        const keywordConditions = keywords.map(keyword =>
          or(like(posts.title, `%${keyword}%`), like(posts.content, `%${keyword}%`)),
        );
        conditions.push(or(...keywordConditions));
      }
    }

    if (conditions.length > 0) {
      whereClause = and(...conditions);
    }

    if (query.category) {
      const categoryPosts = await db.select().from(postCategories).where(eq(postCategories.categoryId, query.category));

      const postIds = categoryPosts.map(cp => cp.postId);
      if (postIds.length > 0) {
        const categoryFilter = inArray(posts.id, postIds);
        whereClause = whereClause ? and(whereClause, categoryFilter) : categoryFilter;
      } else {
        // No posts in this category - add impossible condition to return empty result
        const categoryFilter = eq(posts.id, -1);
        whereClause = whereClause ? and(whereClause, categoryFilter) : categoryFilter;
      }
    }

    const orderByCol =
      query.sortBy === "created_at" ? posts.createdAt : query.sortBy === "updated_at" ? posts.updatedAt : posts.title;

    const orderBy = query.sortOrder === "desc" ? desc(orderByCol) : asc(orderByCol);

    const [postsList, totalCount] = await Promise.all([
      db
        .select({
          id: posts.id,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
          status: posts.status,
          featuredImage: posts.featuredImage,
          author: {
            id: users.id,
            username: users.username,
          },
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
        })
        .from(posts)
        .where(whereClause)
        .leftJoin(users, eq(posts.authorId, users.id))
        .orderBy(orderBy)
        .limit(query.limit)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(${posts.id})` })
        .from(posts)
        .where(whereClause)
        .then(res => res[0]?.count || 0),
    ]);

    const totalPages = Math.ceil(totalCount / query.limit);

    return createPaginatedResponse({
      success: true,
      data: postsList,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: totalCount,
        totalPages,
      },
    } satisfies PaginatedResponse);
  } catch (error) {
    if (isZodError(error)) {
      const zodError = error as z.ZodError;
      const issues = zodError.issues || [];
      return createAPIResponse(
        {
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        },
        { status: 400 },
      );
    }

    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      },
      { status: 500 },
    );
  }
}

export async function getPost(request: IRequest): Promise<Response> {
  try {
    const id = request.params?.id;

    if (!id) {
      return createAPIResponse(
        {
          success: false,
          message: "Post ID is required",
        },
        { status: 400 },
      );
    }

    const [post] = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
        contentType: posts.contentType,
        excerpt: posts.excerpt,
        status: posts.status,
        featuredImage: posts.featuredImage,
        author: {
          id: users.id,
          username: users.username,
          email: users.email,
        },
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(eq(posts.id, parseInt(id)))
      .leftJoin(users, eq(posts.authorId, users.id))
      .limit(1);

    if (!post) {
      return createAPIResponse(
        {
          success: false,
          message: "Post not found",
        },
        { status: 404 },
      );
    }

    const postCategoriesList = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      })
      .from(postCategories)
      .where(eq(postCategories.postId, post.id))
      .leftJoin(categories, eq(postCategories.categoryId, categories.id));

    const postWithCategories = {
      ...post,
      categories: postCategoriesList,
    };

    return createAPIResponse({
      success: true,
      message: "Post retrieved successfully",
      data: postWithCategories,
    });
  } catch (error) {
    if (isZodError(error)) {
      const zodError = error as z.ZodError;
      const issues = zodError.issues || [];
      return createAPIResponse(
        {
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        },
        { status: 400 },
      );
    }

    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      },
      { status: 500 },
    );
  }
}

export async function updatePost(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return createAPIResponse(
        {
          success: false,
          message: "Authentication required",
        },
        { status: 401 },
      );
    }

    const id = request.params?.id;
    if (!id) {
      return createAPIResponse(
        {
          success: false,
          message: "Post ID is required",
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { categoryIds?: number[] };
    const data = postUpdateSchema.parse(body);

    if (data.slug && !validateSlug(data.slug)) {
      return createAPIResponse(
        {
          success: false,
          message: "Invalid slug format",
          errors: ["Slug must contain only lowercase letters, numbers, and hyphens"],
        },
        { status: 400 },
      );
    }

    const existingPost = await db
      .select()
      .from(posts)
      .where(eq(posts.id, parseInt(id)))
      .limit(1);

    if (!existingPost[0]) {
      return createAPIResponse(
        {
          success: false,
          message: "Post not found",
        },
        { status: 404 },
      );
    }

    if (existingPost[0].authorId !== request.user.id && request.user.role !== "admin") {
      return createAPIResponse(
        {
          success: false,
          message: "You can only edit your own posts",
        },
        { status: 403 },
      );
    }

    if (data.slug && data.slug !== existingPost[0].slug) {
      const [existingWithSlug] = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);

      if (existingWithSlug) {
        return createAPIResponse(
          {
            success: false,
            message: "Post slug already exists",
          },
          { status: 409 },
        );
      }
    }

    await db
      .update(posts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, parseInt(id)))
      .returning();

    const { categoryIds } = body;
    if (categoryIds) {
      await db.delete(postCategories).where(eq(postCategories.postId, parseInt(id)));

      if (categoryIds.length > 0) {
        await db.insert(postCategories).values(
          categoryIds.map((categoryId: number) => ({
            postId: parseInt(id),
            categoryId,
          })),
        );
      }
    }

    const [postWithAuthor] = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
        contentType: posts.contentType,
        excerpt: posts.excerpt,
        status: posts.status,
        featuredImage: posts.featuredImage,
        author: {
          id: users.id,
          username: users.username,
          email: users.email,
        },
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(eq(posts.id, parseInt(id)))
      .leftJoin(users, eq(posts.authorId, users.id))
      .limit(1);

    // Get categories for the post
    const postCategoriesList = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
      })
      .from(postCategories)
      .where(eq(postCategories.postId, parseInt(id)))
      .leftJoin(categories, eq(postCategories.categoryId, categories.id));

    const postWithCategories = {
      ...postWithAuthor,
      categories: postCategoriesList,
    };

    return createAPIResponse({
      success: true,
      message: "Post updated successfully",
      data: postWithCategories,
    });
  } catch (error) {
    if (isZodError(error)) {
      const zodError = error as z.ZodError;
      const issues = zodError.issues || [];
      return createAPIResponse(
        {
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        },
        { status: 400 },
      );
    }

    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      },
      { status: 500 },
    );
  }
}

export async function deletePost(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return createAPIResponse(
        {
          success: false,
          message: "Authentication required",
        },
        { status: 401 },
      );
    }

    const id = request.params?.id;
    if (!id) {
      return createAPIResponse(
        {
          success: false,
          message: "Post ID is required",
        },
        { status: 400 },
      );
    }

    const existingPost = await db
      .select()
      .from(posts)
      .where(eq(posts.id, parseInt(id)))
      .limit(1);

    if (!existingPost[0]) {
      return createAPIResponse(
        {
          success: false,
          message: "Post not found",
        },
        { status: 404 },
      );
    }

    if (existingPost[0].authorId !== request.user.id && request.user.role !== "admin") {
      return createAPIResponse(
        {
          success: false,
          message: "You can only delete your own posts",
        },
        { status: 403 },
      );
    }

    await db.delete(postCategories).where(eq(postCategories.postId, parseInt(id)));

    await db.delete(posts).where(eq(posts.id, parseInt(id)));

    return createAPIResponse({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      },
      { status: 500 },
    );
  }
}
