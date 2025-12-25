import type { APIResponse, PaginatedResponse, PostStatus } from "@onechu/schemas";

import { api } from "./client";

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: PostStatus;
  featuredImage: string | null;
  authorId: number;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: number;
    username: string;
    email?: string;
  };
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

export interface PostListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  status: PostStatus;
  featuredImage: string | null;
  author: {
    id: number;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PostsQueryParams {
  page?: number;
  limit?: number;
  status?: PostStatus;
  category?: number;
  author?: number;
  search?: string;
  sortBy?: "created_at" | "updated_at" | "title";
  sortOrder?: "asc" | "desc";
}

export interface CreatePostData {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status?: PostStatus;
  featuredImage?: string;
  categoryIds?: number[];
}

export interface UpdatePostData {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  status?: PostStatus;
  featuredImage?: string;
  categoryIds?: number[];
}

export async function getPosts(params: PostsQueryParams = {}): Promise<PaginatedResponse<PostListItem>> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  return api.get("posts", { searchParams }).json();
}

export async function getPost(id: number): Promise<APIResponse<Post>> {
  return api.get(`posts/${id}`).json();
}

export async function createPost(data: CreatePostData): Promise<APIResponse<Post>> {
  return api.post("posts", { json: data }).json();
}

export async function updatePost(id: number, data: UpdatePostData): Promise<APIResponse<Post>> {
  return api.patch(`posts/${id}`, { json: data }).json();
}

export async function deletePost(id: number): Promise<APIResponse> {
  return api.delete(`posts/${id}`).json();
}
