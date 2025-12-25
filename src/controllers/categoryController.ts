import type { IRequest } from 'itty-router';
import { z } from 'zod';
import { db } from '../db';
import { categories, insertCategorySchema, posts, postCategories } from '../db/schema';
import { eq, and, desc, asc, like, sql } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { APIResponse, PaginatedResponse } from '../types';
import { validateSlug } from '../utils/validation';

const categoryUpdateSchema = insertCategorySchema.partial();

const categoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'name']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export async function createCategory(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user || request.user.role !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Admin access required',
        } satisfies APIResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json();
    const data = insertCategorySchema.parse(body);

    if (!validateSlug(data.slug)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid slug format',
          errors: ['Slug must contain only lowercase letters, numbers, and hyphens'],
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const [existingCategory] = await db.select()
      .from(categories)
      .where(eq(categories.slug, data.slug))
      .limit(1);

    if (existingCategory) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Category slug already exists',
        } satisfies APIResponse),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const [category] = await db.insert(categories).values({
      name: data.name,
      slug: data.slug,
      description: data.description,
    }).returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Category created successfully',
        data: category,
      } satisfies APIResponse),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error.constructor.name === 'ZodError' || error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Validation error',
          errors: issues.map((e: any) => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        errors: [error.message],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function getCategories(request: IRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = categoriesQuerySchema.parse({
      page: url.searchParams.get('page') || '1',
      limit: url.searchParams.get('limit') || '10',
      search: url.searchParams.get('search') || undefined,
      sortBy: url.searchParams.get('sortBy') || 'name',
      sortOrder: url.searchParams.get('sortOrder') || 'asc',
    });

    const offset = (query.page - 1) * query.limit;

    let whereClause = undefined;
    if (query.search) {
      whereClause = like(categories.name, `%${query.search}%`);
    }

    const orderBy = query.sortOrder === 'desc'
      ? desc(categories[query.sortBy])
      : asc(categories[query.sortBy]);

    const [categoriesList, totalCount] = await Promise.all([
      db.select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        postCount: sql<number>`COUNT(${posts.id})`,
      })
        .from(categories)
        .where(whereClause)
        .leftJoin(postCategories, eq(categories.id, postCategories.categoryId))
        .leftJoin(posts, eq(postCategories.postId, posts.id))
        .groupBy(categories.id)
        .orderBy(orderBy)
        .limit(query.limit)
        .offset(offset),
      db.select({ count: sql<number>`COUNT(DISTINCT ${categories.id})` })
        .from(categories)
        .where(whereClause)
        .then(res => res[0]?.count || 0),
    ]);

    const totalPages = Math.ceil(totalCount / query.limit);

    return new Response(
      JSON.stringify({
        success: true,
        data: categoriesList,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: totalCount,
          totalPages,
        },
      } satisfies PaginatedResponse),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error.constructor.name === 'ZodError' || error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Validation error',
          errors: issues.map((e: any) => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        errors: [error.message],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function getCategory(request: IRequest): Promise<Response> {
  try {
    const id = request.params?.id;

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Category ID is required',
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const [category] = await db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      postCount: sql<number>`COUNT(${posts.id})`,
    })
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .leftJoin(postCategories, eq(categories.id, postCategories.categoryId))
      .leftJoin(posts, eq(postCategories.postId, posts.id))
      .groupBy(categories.id)
      .limit(1);

    if (!category) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Category not found',
        } satisfies APIResponse),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Category retrieved successfully',
        data: category,
      } satisfies APIResponse),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        errors: [error.message],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function updateCategory(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user || request.user.role !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Admin access required',
        } satisfies APIResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const id = request.params?.id;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Category ID is required',
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json();
    const data = categoryUpdateSchema.parse(body);

    if (data.slug && !validateSlug(data.slug)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid slug format',
          errors: ['Slug must contain only lowercase letters, numbers, and hyphens'],
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const existingCategory = await db.select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .limit(1);

    if (!existingCategory[0]) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Category not found',
        } satisfies APIResponse),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (data.slug && data.slug !== existingCategory[0].slug) {
      const [existingWithSlug] = await db.select()
        .from(categories)
        .where(eq(categories.slug, data.slug))
        .limit(1);

      if (existingWithSlug) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Category slug already exists',
          } satisfies APIResponse),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const [updatedCategory] = await db.update(categories)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, parseInt(id)))
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Category updated successfully',
        data: updatedCategory,
      } satisfies APIResponse),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error.constructor.name === 'ZodError' || error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Validation error',
          errors: issues.map((e: any) => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        errors: [error.message],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function deleteCategory(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user || request.user.role !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Admin access required',
        } satisfies APIResponse),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const id = request.params?.id;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Category ID is required',
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const existingCategory = await db.select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .limit(1);

    if (!existingCategory[0]) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Category not found',
        } satisfies APIResponse),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const [categoryPosts] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(postCategories)
      .where(eq(postCategories.categoryId, parseInt(id)));

    if (categoryPosts.count > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Cannot delete category with associated posts',
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    await db.delete(categories)
      .where(eq(categories.id, parseInt(id)));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Category deleted successfully',
      } satisfies APIResponse),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        errors: [error.message],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}