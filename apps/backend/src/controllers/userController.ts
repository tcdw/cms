import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { users } from "../db/schema";
import type { AuthenticatedRequest } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../utils/auth";
import { isZodError } from "../utils/validation";
import { createAPIResponse } from "../utils/wrapper";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function changePassword(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return createAPIResponse(
        {
          success: false,
          message: "Authentication required",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const [user] = await db.select().from(users).where(eq(users.id, request.user.id)).limit(1);

    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      return createAPIResponse(
        {
          success: false,
          message: "Current password is incorrect",
        },
        { status: 401 },
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

    return createAPIResponse({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    if (isZodError(error)) {
      const zodError = error as z.ZodError;
      const issues = zodError.issues || [];
      return createAPIResponse(
        {
          success: false,
          message: "Validation error",
          errors: issues.map(e => e.message || JSON.stringify(e)),
        },
        { status: 400 },
      );
    }

    console.log(error); // TODO: Integrate with a logging library
    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function getProfile(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return createAPIResponse(
        {
          success: false,
          message: "Authentication required",
        },
        { status: 401 },
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
      return createAPIResponse(
        {
          success: false,
          message: "User not found",
        },
        { status: 404 },
      );
    }

    return createAPIResponse({
      success: true,
      message: "Profile retrieved successfully",
      data: user,
    });
  } catch (error) {
    console.log(error); // TODO: Integrate with a logging library
    return createAPIResponse(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
