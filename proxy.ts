import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. The `authorized` callback in
 * the edge-safe auth config redirects unauthenticated users to /login and
 * bounces signed-in users away from /login.
 *
 * Pages and Server Actions still call requireAuth() themselves: the proxy is a
 * routing guard, not the authorization boundary.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
