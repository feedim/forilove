import { headers } from 'next/headers';

/**
 * Get authenticated user ID from request header set by middleware.
 * Eliminates duplicate getUser() calls in server components.
 * Middleware validates the token and sets x-user-id header.
 */
export async function getAuthUserId(): Promise<string | null> {
  const h = await headers();
  return h.get('x-user-id');
}
