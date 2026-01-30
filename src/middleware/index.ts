import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerInstance } from "../db/supabase.client.ts";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/auth/login",
  "/auth/register",
  "/auth/reset-password",
  "/favicon.png",
  "/robots.txt",
]);

const PUBLIC_API_PREFIXES = ["/api/auth"];
const STATIC_PREFIXES = ["/_astro", "/assets", "/public"];
const PROTECTED_PREFIXES = ["/ai", "/cards", "/study", "/profile"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

export const onRequest = defineMiddleware(async ({ locals, cookies, url, request, redirect }, next) => {
  // Inject per-request Supabase SSR client
  locals.supabase = createSupabaseServerInstance({ cookies, headers: request.headers });

  // Allow public and static paths
  if (isPublicPath(url.pathname)) {
    return next();
  }

  // Check user for protected prefixes
  if (PROTECTED_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    const {
      data: { user },
    } = await locals.supabase.auth.getUser();
    if (!user) {
      const redirectTo = encodeURIComponent(url.pathname + (url.search || ""));
      return redirect(`/auth/login?reason=session_expired&redirectTo=${redirectTo}`);
    }
  }

  return next();
});
