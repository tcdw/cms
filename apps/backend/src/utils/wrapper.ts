import type { APIResponse, PaginatedResponse } from "@onechu/schemas";

export function createAPIResponse(response: APIResponse, options: ResponseInit = {}) {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}

export function createPaginatedResponse(response: PaginatedResponse, options: ResponseInit = {}) {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}
