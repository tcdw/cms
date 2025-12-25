export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateUsername(username: string): boolean {
  return username.length >= 3 && username.length <= 50;
}

export function validatePassword(password: string): boolean {
  return password.length >= 6;
}

export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug);
}

export function sanitizeHtml(html: string): string {
  const scriptRegex = /<script[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  const iframeRegex = /<iframe[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
  return html.replace(scriptRegex, "").replace(iframeRegex, "");
}

/**
 * Check if an error is a ZodError.
 * Uses both instanceof and constructor name check to handle cross-instance issues
 * (e.g., when drizzle-zod creates ZodErrors from a different zod instance).
 */
export function isZodError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  // Check constructor name for cross-instance compatibility
  const constructorName = (error as { constructor?: { name?: string } }).constructor?.name;
  return constructorName === "ZodError";
}
