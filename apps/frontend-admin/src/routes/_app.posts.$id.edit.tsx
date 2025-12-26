import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { MilkdownEditor, type MilkdownEditorRef } from "@/components/ui/milkdown-editor";

import { getCategories } from "@/api/categories";
import { getPost, updatePost, type Post, type UpdatePostData } from "@/api/posts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  status: z.enum(["draft", "published"]),
  featuredImage: z.string().url().optional().or(z.literal("")),
  categoryIds: z.array(z.number()).optional(),
});

type PostForm = z.infer<typeof postSchema>;

interface EditPostFormProps {
  post: Post;
  categories: Array<{ id: number; name: string; slug: string }>;
}

function EditPostForm({ post, categories }: EditPostFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const editorRef = useRef<MilkdownEditorRef>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PostForm>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt ?? "",
      status: post.status,
      featuredImage: post.featuredImage ?? "",
      categoryIds: post.categories?.map(c => c.id) ?? [],
    },
  });

  const title = watch("title");

  const generateSlug = () => {
    if (title) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      setValue("slug", slug);
    }
  };

  const mutation = useMutation({
    mutationFn: (data: UpdatePostData) => updatePost(post.id, data),
    onSuccess: response => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        queryClient.invalidateQueries({ queryKey: ["post", String(post.id)] });
        toast({ title: "Post updated successfully" });
        navigate({ to: "/posts" });
      } else {
        toast({ title: "Failed to update post", description: response.message, variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Failed to update post", variant: "destructive" });
    },
  });

  const onSubmit = (data: PostForm) => {
    mutation.mutate({
      ...data,
      featuredImage: data.featuredImage || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Post</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...register("title")} />
                  {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
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
                  <Label>Content</Label>
                  <Controller
                    name="content"
                    control={control}
                    render={({ field }) => (
                      <MilkdownEditor
                        key={post.id}
                        ref={editorRef}
                        defaultValue={field.value}
                        onChange={field.onChange}
                        placeholder="开始写作..."
                      />
                    )}
                  />
                  {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Textarea id="excerpt" {...register("excerpt")} rows={3} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Controller
                    name="categoryIds"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value?.[0]?.toString() || ""}
                        onValueChange={val => field.onChange(val ? [Number(val)] : [])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="featuredImage">Featured Image URL</Label>
                  <Input id="featuredImage" {...register("featuredImage")} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate({ to: "/posts" })}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function EditPostPage() {
  const { id } = Route.useParams();

  const { data: postData, isLoading: isLoadingPost } = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(Number(id)),
  });

  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories", { limit: 100 }],
    queryFn: () => getCategories({ limit: 100 }),
  });

  if (isLoadingPost || isLoadingCategories || !postData?.data) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return <EditPostForm post={postData.data} categories={categoriesData?.data ?? []} />;
}

export const Route = createFileRoute("/_app/posts/$id/edit")({
  component: EditPostPage,
});
