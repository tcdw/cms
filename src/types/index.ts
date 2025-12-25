export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: "admin" | "editor";
}

export interface JWTPayload {
  userId: number;
  username: string;
  email: string;
  role: "admin" | "editor";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
