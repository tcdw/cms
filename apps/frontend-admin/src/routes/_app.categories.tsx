import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  createCategory,
  deleteCategory,
  type CategoriesQueryParams,
  type Category,
  getCategories,
  updateCategory,
} from "@/api/categories";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/authStore";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  description: z.string().optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;

function CategoriesPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: CategoriesQueryParams = {
    page,
    limit: 10,
    search: search || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["categories", params],
    queryFn: () => getCategories(params),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  });

  const name = watch("name");

  const generateSlug = () => {
    if (name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setValue("slug", slug);
    }
  };

  useEffect(() => {
    if (editingCategory) {
      reset({
        name: editingCategory.name,
        slug: editingCategory.slug,
        description: editingCategory.description || "",
      });
    } else {
      reset({ name: "", slug: "", description: "" });
    }
  }, [editingCategory, reset]);

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: response => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        toast({ title: "Category created" });
        setIsCreateOpen(false);
        reset();
      } else {
        toast({ title: "Failed to create category", description: response.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Failed to create category", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CategoryForm }) => updateCategory(id, data),
    onSuccess: response => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        toast({ title: "Category updated" });
        setEditingCategory(null);
      } else {
        toast({ title: "Failed to update category", description: response.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Failed to update category", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: response => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        toast({ title: "Category deleted" });
      } else {
        toast({ title: "Failed to delete category", description: response.message, variant: "destructive" });
      }
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete category", variant: "destructive" });
      setDeleteId(null);
    },
  });

  const onSubmit = (data: CategoryForm) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Categories</h1>
        {isAdmin && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            New Category
          </Button>
        )}
      </div>

      {!isAdmin && <p className="text-muted-foreground">Only administrators can create, edit, or delete categories.</p>}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Posts</TableHead>
              {isAdmin && <TableHead className="w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">
                  No categories found
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map(category => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                  <TableCell className="max-w-xs truncate">{category.description || "-"}</TableCell>
                  <TableCell>{category.postCount ?? 0}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditingCategory(category)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(category.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateOpen || editingCategory !== null}
        onOpenChange={open => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingCategory(null);
            reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the category details below." : "Fill in the details to create a new category."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <div className="flex gap-2">
                <Input id="slug" {...register("slug")} />
                <Button type="button" variant="outline" onClick={generateSlug}>
                  Generate
                </Button>
              </div>
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register("description")} rows={3} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingCategory(null);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingCategory
                  ? updateMutation.isPending
                    ? "Saving..."
                    : "Save"
                  : createMutation.isPending
                    ? "Creating..."
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot be undone. Categories with posts cannot
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const Route = createFileRoute("/_app/categories")({
  component: CategoriesPage,
});
