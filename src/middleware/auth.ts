import type { IRequest } from 'itty-router';
import type { AuthUser } from '../types';
import { extractTokenFromHeader, verifyToken } from '../utils/auth';

export interface AuthenticatedRequest extends IRequest {
  user?: AuthUser;
}

export async function authMiddleware(request: AuthenticatedRequest): Promise<Response | undefined> {
  const authHeader = request.headers.get('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Access token required',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Invalid or expired token',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  request.user = {
    id: payload.userId,
    username: payload.username,
    email: payload.email,
    role: payload.role,
  };
}

export async function adminMiddleware(request: AuthenticatedRequest): Promise<Response | undefined> {
  if (!request.user) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Authentication required',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (request.user.role !== 'admin') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Admin access required',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}