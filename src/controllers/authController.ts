import { eq } from "drizzle-orm";
import type { IRequest } from "itty-router";
import { z } from "zod";

import { db } from "../db";
import { insertUserSchema, users } from "../db/schema";
import type { APIResponse, JWTPayload } from "../types";
import { generateToken, hashPassword, verifyPassword } from "../utils/auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function register(request: IRequest): Promise<Response> {
  try {
    const body = await request.json();
    const validated = insertUserSchema.parse(body);

    const hashedPassword = await hashPassword(validated.password);

    try {
      const [user] = await db
        .insert(users)
        .values({
          username: validated.username,
          email: validated.email,
          password: hashedPassword,
          role: validated.role || "editor",
        })
        .returning();

      const { password: _, ...userWithoutPassword } = user;
      void _; // suppress unused variable warning

      return new Response(
        JSON.stringify({
          success: true,
          message: "User registered successfully",
          data: userWithoutPassword,
        } satisfies APIResponse),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      if (error instanceof Error && error.message?.includes("UNIQUE constraint failed")) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Username or email already exists",
            errors: [error.message],
          } satisfies APIResponse),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      throw error;
    }
  } catch (error) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error instanceof z.ZodError) {
      const issues = error.issues || [];
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

export async function login(request: IRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user || !(await verifyPassword(password, user.password))) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid username or password",
        } satisfies APIResponse),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const token = generateToken(payload);

    const { password: _pw, ...userWithoutPassword } = user;
    void _pw; // suppress unused variable warning

    return new Response(
      JSON.stringify({
        success: true,
        message: "Login successful",
        data: {
          user: userWithoutPassword,
          token,
        },
      } satisfies APIResponse),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // Check for ZodError by constructor name to handle cross-instance issues
    // drizzle-zod creates ZodErrors with 'issues' property, not 'errors'
    if (error instanceof z.ZodError) {
      const issues = error.issues || [];
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
