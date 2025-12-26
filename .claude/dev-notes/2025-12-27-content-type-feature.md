# Feature: Post Content Type (markdown/html)

## Date

2025-12-27

## Overview

Added `contentType` field to posts, allowing content to be stored as either Markdown or HTML. This enables flexibility in content authoring - users can choose their preferred format per post.

## Changes Made

### 1. Database Schema

**File**: `apps/backend/src/db/schema.ts`

```typescript
contentType: text("content_type", { enum: ["markdown", "html"] })
  .notNull()
  .default("markdown"),
```

### 2. Zod Validation Schema

**File**: `packages/schemas/src/index.ts`

```typescript
export const postContentTypeSchema = z.enum(["markdown", "html"]);
export type PostContentType = z.infer<typeof postContentTypeSchema>;

// Added to insertPostSchema
contentType: postContentTypeSchema.default("markdown"),
```

### 3. Backend Controller

**File**: `apps/backend/src/controllers/postController.ts`

- Added `contentType` to insert values in `createPost`
- Added `contentType` to select queries in `createPost`, `getPost`, `updatePost`

### 4. Frontend API Types

**File**: `apps/frontend-admin/src/api/posts.ts`

- Added `contentType: PostContentType` to `Post` interface
- Added `contentType?: PostContentType` to `CreatePostData` and `UpdatePostData`

### 5. Frontend Editor

**File**: `apps/frontend-admin/src/routes/_app.posts.$id.edit.tsx`

- Added Content Type selector in Settings panel
- Conditional rendering based on content type:
  - `markdown`: MilkdownEditor (WYSIWYG Markdown)
  - `html`: Plain Textarea with monospace font

## Database Migration

**File**: `apps/backend/drizzle/0001_tidy_sunset_bain.sql`

```sql
ALTER TABLE `posts` ADD `content_type` text DEFAULT 'markdown' NOT NULL;
```

Existing posts automatically receive `markdown` as default value.

## API Changes

Posts API now includes `contentType` field in responses:

```json
{
  "id": 4,
  "title": "Example Post",
  "contentType": "markdown",
  ...
}
```

## UI Behavior

- New posts default to `markdown`
- Switching to `html` replaces MilkdownEditor with plain Textarea
- Content is preserved when switching types (no automatic conversion)

## Files Modified

- `apps/backend/src/db/schema.ts`
- `apps/backend/src/controllers/postController.ts`
- `apps/backend/drizzle/0001_tidy_sunset_bain.sql` (new)
- `apps/backend/drizzle/meta/_journal.json`
- `apps/backend/drizzle/meta/0001_snapshot.json` (new)
- `packages/schemas/src/index.ts`
- `apps/frontend-admin/src/api/posts.ts`
- `apps/frontend-admin/src/routes/_app.posts.$id.edit.tsx`
