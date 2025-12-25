import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { IRequest } from "itty-router";
import { z } from "zod";

import { db } from "../db";
import { categories, insertPostSchema, postCategories, posts, users } from "../db/schema";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { APIResponse, PaginatedResponse } from "../types";
import { validateSlug } from "../utils/validation";

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
      return new Response(
        JSON.stringify({
          success: false,
          message: "Authentication required",
        } satisfies APIResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const body = await request.json();
    const data = insertPostSchema.parse(body);

    if (!validateSlug(data.slug)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid slug format",
          errors: ["Slug must contain only lowercase letters, numbers, and hyphens"],
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const [existingPost] = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);

    if (existingPost) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Post slug already exists",
        } satisfies APIResponse),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const categoryIds = body.categoryIds || [];
    if (categoryIds.length > 0) {
      const validCategories = await db.select().from(categories).where(inArray(categories.id, categoryIds));

      if (validCategories.length !== categoryIds.length) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "One or more categories not found",
          } satisfies APIResponse),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    const [post] = await db
      .insert(posts)
      .values({
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt,
        status: data.status,
        featuredImage: data.featuredImage,
        authorId: request.user.id,
      })
      .returning();

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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Post created successfully",
        data: postWithCategories,
      } satisfies APIResponse),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error instanceof z.ZodError) {
      const issues = error.issues || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
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
      conditions.push(or(like(posts.title, `%${query.search}%`), like(posts.content, `%${query.search}%`)));
    }

    if (conditions.length > 0) {
      whereClause = and(...conditions);
    }

    let categoryFilter;
    if (query.category) {
      const categoryPosts = await db.select().from(postCategories).where(eq(postCategories.categoryId, query.category));

      const postIds = categoryPosts.map(cp => cp.postId);
      if (postIds.length > 0) {
        categoryFilter = posts.id.in(postIds);
      }
    }

    if (categoryFilter) {
      whereClause = whereClause ? and(whereClause, categoryFilter) : categoryFilter;
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

    return new Response(
      JSON.stringify({
        success: true,
        data: postsList,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: totalCount,
          totalPages,
        },
      } satisfies PaginatedResponse),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error instanceof z.ZodError) {
      const issues = error.issues || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function getPost(request: IRequest): Promise<Response> {
  try {
    const id = request.params?.id;

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Post ID is required",
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const [post] = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        content: posts.content,
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
      return new Response(
        JSON.stringify({
          success: false,
          message: "Post not found",
        } satisfies APIResponse),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Post retrieved successfully",
        data: postWithCategories,
      } satisfies APIResponse),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error instanceof z.ZodError) {
      const issues = error.issues || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function updatePost(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Authentication required",
        } satisfies APIResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const id = request.params?.id;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Post ID is required",
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const body = await request.json();
    const data = postUpdateSchema.parse(body);

    if (data.slug && !validateSlug(data.slug)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid slug format",
          errors: ["Slug must contain only lowercase letters, numbers, and hyphens"],
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const existingPost = await db
      .select()
      .from(posts)
      .where(eq(posts.id, parseInt(id)))
      .limit(1);

    if (!existingPost[0]) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Post not found",
        } satisfies APIResponse),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (existingPost[0].authorId !== request.user.id && request.user.role !== "admin") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "You can only edit your own posts",
        } satisfies APIResponse),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (data.slug && data.slug !== existingPost[0].slug) {
      const [existingWithSlug] = await db.select().from(posts).where(eq(posts.slug, data.slug)).limit(1);

      if (existingWithSlug) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Post slug already exists",
          } satisfies APIResponse),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Post updated successfully",
        data: postWithCategories,
      } satisfies APIResponse),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error instanceof z.ZodError) {
      const issues = error.issues || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function deletePost(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Authentication required",
        } satisfies APIResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const id = request.params?.id;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Post ID is required",
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const existingPost = await db
      .select()
      .from(posts)
      .where(eq(posts.id, parseInt(id)))
      .limit(1);

    if (!existingPost[0]) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Post not found",
        } satisfies APIResponse),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (existingPost[0].authorId !== request.user.id && request.user.role !== "admin") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "You can only delete your own posts",
        } satisfies APIResponse),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    await db.delete(postCategories).where(eq(postCategories.postId, parseInt(id)));

    await db.delete(posts).where(eq(posts.id, parseInt(id)));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Post deleted successfully",
      } satisfies APIResponse),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
