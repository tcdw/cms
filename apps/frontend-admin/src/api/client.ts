import ky from "ky";

import { useAuthStore } from "@/stores/authStore";

export const api = ky.create({
  prefixUrl: "/api/v1",
  hooks: {
    beforeRequest: [
      request => {
        const token = useAuthStore.getState().token;
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        // Don't redirect on 401 for auth endpoints (login/register)
        const isAuthEndpoint = request.url.includes("/auth/");
        if (response.status === 401 && !isAuthEndpoint) {
          useAuthStore.getState().logout();
          window.location.href = "/login";
        }
        return response;
      },
    ],
  },
  // Don't throw on non-2xx responses, let the caller handle them
  throwHttpErrors: false,
});
