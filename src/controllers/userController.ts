import type { IRequest } from 'itty-router';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../utils/auth';
import type { AuthenticatedRequest } from '../middleware/auth';
import type { APIResponse } from '../types';

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
          message: 'Authentication required',
        } satisfies APIResponse),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, request.user.id))
      .limit(1);

    if (!user || !(await verifyPassword(currentPassword, user.password))) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Current password is incorrect',
        } satisfies APIResponse),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const hashedNewPassword = await hashPassword(newPassword);

    await db.update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, request.user.id));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password changed successfully',
      } satisfies APIResponse),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error.constructor.name === 'ZodError' || error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Validation error',
          errors: issues.map((e: any) => e.message || JSON.stringify(e)),
        } satisfies APIResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        errors: [error.message],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function getProfile(request: AuthenticatedRequest): Promise<Response> {
  try {
    if (!request.user) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Authentication required',
        } satisfies APIResponse),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const [user] = await db.select({
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
          message: 'User not found',
        } satisfies APIResponse),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Profile retrieved successfully',
        data: user,
      } satisfies APIResponse),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        errors: [error.message],
      } satisfies APIResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}