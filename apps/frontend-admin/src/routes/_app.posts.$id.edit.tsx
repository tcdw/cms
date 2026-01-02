import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { MilkdownEditor, type MilkdownEditorRef } from "@/components/ui/milkdown-editor";

import { getCategories } from "@/api/categories";
import { createPost, getPost, updatePost, type CreatePostData, type Post, type UpdatePostData } from "@/api/posts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  content: z.string().min(1, "Content is required"),
  contentType: z.enum(["markdown", "html"]),
  excerpt: z.string().optional(),
  status: z.enum(["draft", "published"]),
  featuredImage: z.string().url().optional().or(z.literal("")),
  categoryIds: z.array(z.number()).optional(),
});

type PostForm = z.infer<typeof postSchema>;

interface PostFormProps {
  post?: Post;
  categories: Array<{ id: number; name: string; slug: string }>;
}

function PostForm({ post, categories }: PostFormProps) {
  const isNew = !post;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    defaultValues: isNew
      ? {
          title: "",
          slug: "",
          content: "",
          contentType: "markdown" as const,
          excerpt: "",
          status: "draft",
          featuredImage: "",
          categoryIds: [],
        }
      : {
          title: post.title,
          slug: post.slug,
          content: post.content,
          contentType: post.contentType,
          excerpt: post.excerpt ?? "",
          status: post.status,
          featuredImage: post.featuredImage ?? "",
          categoryIds: post.categories?.map(c => c.id) ?? [],
        },
  });

  const title = watch("title");
  const contentType = watch("contentType");

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
    mutationFn: (data: CreatePostData | UpdatePostData) =>
      isNew ? createPost(data as CreatePostData) : updatePost(post.id, data as UpdatePostData),
    onSuccess: response => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["posts"] });
        if (!isNew) {
          queryClient.invalidateQueries({ queryKey: ["post", String(post.id)] });
        }
        toast.success(isNew ? "Post created successfully" : "Post updated successfully");
        navigate({ to: "/posts" });
      } else {
        toast.error(isNew ? "Failed to create post" : "Failed to update post", {
          description: response.message,
        });
      }
    },
    onError: () => {
      toast.error(isNew ? "Failed to create post" : "Failed to update post");
    },
  });

  const onSubmit = (data: PostForm) => {
    mutation.mutate({
      ...data,
      featuredImage: data.featuredImage || undefined,
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{isNew ? "New Post" : "Edit Post"}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/posts" })}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={mutation.isPending}>
            {mutation.isPending ? (isNew ? "Creating..." : "Saving...") : isNew ? "Create Post" : "Save Changes"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} placeholder="Post title" />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <div className="flex gap-2">
              <Input id="slug" {...register("slug")} placeholder="url-slug" />
              <Button type="button" variant="outline" onClick={generateSlug}>
                Generate
              </Button>
            </div>
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea id="excerpt" {...register("excerpt")} rows={3} placeholder="Brief summary for SEO and previews" />
          </div>

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
            <Label>Content Type</Label>
            <Controller
              name="contentType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
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
        </div>

        <div className="space-y-2">
          <Label>Content</Label>
          {contentType === "markdown" ? (
            <Controller
              name="content"
              control={control}
              render={({ field }) => (
                <MilkdownEditor
                  key={post?.id ?? "new"}
                  ref={editorRef}
                  defaultValue={field.value}
                  onChange={field.onChange}
                  placeholder="开始写作..."
                />
              )}
            />
          ) : (
            <Textarea
              {...register("content")}
              rows={20}
              placeholder="输入 HTML 内容..."
              className="font-mono text-sm resize-y min-h-130"
            />
          )}
          {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
        </div>
      </form>
    </div>
  );
}

function PostPage() {
  const { id } = Route.useParams();
  const isNew = id === "new";

  const { data: postData, isLoading: isLoadingPost } = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(Number(id)),
    enabled: !isNew,
  });

  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories", { limit: 100 }],
    queryFn: () => getCategories({ limit: 100 }),
  });

  if (isLoadingCategories || (!isNew && (isLoadingPost || !postData?.data))) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return <PostForm post={isNew ? undefined : postData?.data} categories={categoriesData?.data ?? []} />;
}

export const Route = createFileRoute("/_app/posts/$id/edit")({
  component: PostPage,
});
