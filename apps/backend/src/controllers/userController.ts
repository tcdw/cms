import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { users } from "../db/schema";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { APIResponse } from "../types";
import { hashPassword, verifyPassword } from "../utils/auth";
import { isZodError } from "../utils/validation";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function changePassword(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Authentication required",
        } satisfies APIResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const [user] = await db.select().from(users).where(eq(users.id, request.user.id)).limit(1);

    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Current password is incorrect",
        } satisfies APIResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, request.user.id));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password changed successfully",
      } satisfies APIResponse),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (isZodError(error)) {
      const zodError = error as z.ZodError;
      const issues = zodError.issues || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function getProfile(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Authentication required",
        } satisfies APIResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, request.user.id))
      .limit(1);

    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "User not found",
        } satisfies APIResponse),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Profile retrieved successfully",
        data: user,
      } satisfies APIResponse),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
        errors: [error instanceof Error ? error.message : String(error)],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
