import { eq } from "drizzle-orm";
import type { IRequest } from "itty-router";
import { z } from "zod";

import { insertUserSchema } from "@onechu/schemas";

import { db } from "../db";
import { users } from "../db/schema";
import type { JWTPayload } from "../types";
import { generateToken, hashPassword, verifyPassword } from "../utils/auth";
import { isZodError } from "../utils/validation";
import { createAPIResponse } from "../utils/wrapper";

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

      if (!user) {
        throw new Error("Failed to create user");
      }

      const { password: _, ...userWithoutPassword } = user;
      void _; // suppress unused variable warning

      return createAPIResponse(
        {
          success: true,
          message: "User registered successfully",
          data: userWithoutPassword,
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error && error.message?.includes("UNIQUE constraint failed")) {
        return createAPIResponse(
          {
            success: false,
            message: "Username or email already exists",
            errors: [error.message],
          },
          { status: 409 },
        );
      }
      throw error;
    }
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

export async function login(request: IRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (!user || !(await verifyPassword(password, user.password))) {
      return createAPIResponse(
        {
          success: false,
          message: "Invalid username or password",
        },
        { status: 401 },
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

    return createAPIResponse({
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        token,
      },
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
