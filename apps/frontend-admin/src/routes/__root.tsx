import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </QueryClientProvider>
  ),
});
