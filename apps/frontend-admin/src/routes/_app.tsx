import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
