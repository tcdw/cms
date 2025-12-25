import type { APIResponse, PaginatedResponse } from "@onechu/schemas";

import { api } from "./client";

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  postCount?: number;
}

export interface CategoriesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "created_at" | "name";
  sortOrder?: "asc" | "desc";
}

export interface CreateCategoryData {
  name: string;
  slug: string;
  description?: string | null;
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
}

export async function getCategories(params: CategoriesQueryParams = {}): Promise<PaginatedResponse<Category>> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  return api.get("categories", { searchParams }).json();
}

export async function getCategory(id: number): Promise<APIResponse<Category>> {
  return api.get(`categories/${id}`).json();
}

export async function createCategory(data: CreateCategoryData): Promise<APIResponse<Category>> {
  return api.post("categories", { json: data }).json();
}

export async function updateCategory(id: number, data: UpdateCategoryData): Promise<APIResponse<Category>> {
  return api.patch(`categories/${id}`, { json: data }).json();
}

export async function deleteCategory(id: number): Promise<APIResponse> {
  return api.delete(`categories/${id}`).json();
}
