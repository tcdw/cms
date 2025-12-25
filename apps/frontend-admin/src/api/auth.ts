import type { APIResponse, AuthUser } from "@onechu/schemas";

import { api } from "./client";

interface LoginResponse {
  user: AuthUser;
  token: string;
}

export async function login(username: string, password: string): Promise<APIResponse<LoginResponse>> {
  return api.post("auth/login", { json: { username, password } }).json();
}

export async function getProfile(): Promise<APIResponse<AuthUser>> {
  return api.get("profile").json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<APIResponse> {
  return api.post("profile/change-password", { json: { currentPassword, newPassword } }).json();
}
