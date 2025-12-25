import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (token) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
});
