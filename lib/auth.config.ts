import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/** Route prefixes that require a signed-in user. */
export const PROTECTED_PATHS = [
  "/dashboard",
  "/accounts",
  "/journal",
  "/expenses",
  "/jobs",
  "/sites",
  "/customers",
  "/suppliers",
  "/invoices",
  "/bills",
  "/payments",
  "/supplier-payments",
  "/reports",
] as const;

/**
 * Edge-safe NextAuth configuration: no database imports, no providers with
 * Node-only dependencies. Used by `proxy.ts` and extended in `lib/auth.ts`
 * with the Credentials provider.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: {
    strategy: "jwt",
    // One working day; accounting users re-authenticate daily.
    maxAge: 60 * 60 * 8,
  },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = nextUrl;

      if (pathname === "/login") {
        if (isLoggedIn) {
          return NextResponse.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      const isProtected = PROTECTED_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );

      if (isProtected) return isLoggedIn;

      return true;
    },
  },
} satisfies NextAuthConfig;
