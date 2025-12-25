import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, FolderTree } from "lucide-react";

import { getCategories } from "@/api/categories";
import { getPosts } from "@/api/posts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";

function DashboardPage() {
  const { user } = useAuthStore();

  const { data: postsData } = useQuery({
    queryKey: ["posts", { limit: 1 }],
    queryFn: () => getPosts({ limit: 1 }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories", { limit: 1 }],
    queryFn: () => getCategories({ limit: 1 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.username}! You are logged in as {user?.role}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{postsData?.pagination?.total ?? "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoriesData?.pagination?.total ?? "-"}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});
