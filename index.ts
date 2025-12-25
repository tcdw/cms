import router from "./src/routes";
import type { APIResponse } from "./src/types";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

Bun.serve({
  port: PORT,
  idleTimeout: 0,
  async fetch(request) {
    console.log(`Request: ${request.method} ${request.url}`);

    try {
      // 使用 router.fetch 而不是 router.handle
      const response = await router.fetch(request);

      if (!response) {
        console.log(`No response for ${request.url}, returning 404`);
        return new Response(
          JSON.stringify({
            success: false,
            message: "Route not found",
          } satisfies APIResponse),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      console.log(`Response: ${response.status} for ${request.url}`);
      return response;
    } catch (error) {
      console.error("Server error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Internal server error",
          errors: [error instanceof Error ? error.message : String(error)],
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
});

console.log(`Server running on http://localhost:${PORT}`);
