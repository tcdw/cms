import { createFileRoute, redirect } from "@tanstack/react-router";

import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (token) {
      throw redirect({ to: "/dashboard" });
    } else {
      throw redirect({ to: "/login" });
    }
  },
});
