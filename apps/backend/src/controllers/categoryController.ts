import { asc, desc, eq, like, sql } from "drizzle-orm";
import type { IRequest } from "itty-router";
import { z } from "zod";

import { insertCategorySchema } from "@onechu/schemas";

import { db } from "../db";
import { categories, postCategories, posts } from "../db/schema";
import type { AuthenticatedRequest } from "../middleware/auth";
import { isZodError, validateSlug } from "../utils/validation";
import { createAPIResponse, createPaginatedResponse } from "../utils/wrapper";

const categoryUpdateSchema = insertCategorySchema.partial();

const categoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z.enum(["created_at", "name"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export async function createCategory(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user || request.user.role !== "admin") {
      return createAPIResponse(
        {
          success: false,
          message: "Admin access required",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const data = insertCategorySchema.parse(body);

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

    const [existingCategory] = await db.select().from(categories).where(eq(categories.slug, data.slug)).limit(1);

    if (existingCategory) {
      return createAPIResponse(
        {
          success: false,
          message: "Category slug already exists",
        },
        { status: 409 },
      );
    }

    const [category] = await db
      .insert(categories)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description,
      })
      .returning();

    return createAPIResponse(
      {
        success: true,
        message: "Category created successfully",
        data: category,
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

    console.log(error); // TODO: Integrate with a logging library
    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function getCategories(request: IRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = categoriesQuerySchema.parse({
      page: url.searchParams.get("page") || "1",
      limit: url.searchParams.get("limit") || "10",
      search: url.searchParams.get("search") || undefined,
      sortBy: url.searchParams.get("sortBy") || "name",
      sortOrder: url.searchParams.get("sortOrder") || "asc",
    });

    const offset = (query.page - 1) * query.limit;

    let whereClause;
    if (query.search) {
      whereClause = like(categories.name, `%${query.search}%`);
    }

    const sortColumn = query.sortBy === "created_at" ? categories.createdAt : categories.name;
    const orderBy = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);

    const [categoriesList, totalCount] = await Promise.all([
      db
        .select({
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
      db
        .select({ count: sql<number>`COUNT(DISTINCT ${categories.id})` })
        .from(categories)
        .where(whereClause)
        .then(res => res[0]?.count || 0),
    ]);

    const totalPages = Math.ceil(totalCount / query.limit);

    return createPaginatedResponse({
      success: true,
      data: categoriesList,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: totalCount,
        totalPages,
      },
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

    console.log(error); // TODO: Integrate with a logging library
    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function getCategory(request: IRequest): Promise<Response> {
  try {
    const id = request.params?.id;

    if (!id) {
      return createAPIResponse(
        {
          success: false,
          message: "Category ID is required",
        },
        { status: 400 },
      );
    }

    const [category] = await db
      .select({
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
      return createAPIResponse(
        {
          success: false,
          message: "Category not found",
        },
        { status: 404 },
      );
    }

    return createAPIResponse({
      success: true,
      message: "Category retrieved successfully",
      data: category,
    });
  } catch (error) {
    console.log(error); // TODO: Integrate with a logging library
    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function updateCategory(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user || request.user.role !== "admin") {
      return createAPIResponse(
        {
          success: false,
          message: "Admin access required",
        },
        { status: 403 },
      );
    }

    const id = request.params?.id;
    if (!id) {
      return createAPIResponse(
        {
          success: false,
          message: "Category ID is required",
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const data = categoryUpdateSchema.parse(body);

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

    const existingCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .limit(1);

    if (!existingCategory[0]) {
      return createAPIResponse(
        {
          success: false,
          message: "Category not found",
        },
        { status: 404 },
      );
    }

    if (data.slug && data.slug !== existingCategory[0].slug) {
      const [existingWithSlug] = await db.select().from(categories).where(eq(categories.slug, data.slug)).limit(1);

      if (existingWithSlug) {
        return createAPIResponse(
          {
            success: false,
            message: "Category slug already exists",
          },
          { status: 409 },
        );
      }
    }

    const [updatedCategory] = await db
      .update(categories)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, parseInt(id)))
      .returning();

    return createAPIResponse({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
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

    console.log(error); // TODO: Integrate with a logging library
    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function deleteCategory(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user || request.user.role !== "admin") {
      return createAPIResponse(
        {
          success: false,
          message: "Admin access required",
        },
        { status: 403 },
      );
    }

    const id = request.params?.id;
    if (!id) {
      return createAPIResponse(
        {
          success: false,
          message: "Category ID is required",
        },
        { status: 400 },
      );
    }

    const existingCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parseInt(id)))
      .limit(1);

    if (!existingCategory[0]) {
      return createAPIResponse(
        {
          success: false,
          message: "Category not found",
        },
        { status: 404 },
      );
    }

    const [categoryPosts] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(postCategories)
      .where(eq(postCategories.categoryId, parseInt(id)));

    if (categoryPosts && categoryPosts.count > 0) {
      return createAPIResponse(
        {
          success: false,
          message: "Cannot delete category with associated posts",
        },
        { status: 400 },
      );
    }

    await db.delete(categories).where(eq(categories.id, parseInt(id)));

    return createAPIResponse({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.log(error); // TODO: Integrate with a logging library
    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
