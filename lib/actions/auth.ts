"use server";

import { AuthError } from "next-auth";
import { signIn, signOut, requireAuth } from "@/lib/auth";
import { loginSchema } from "@/lib/validators/auth";

/**
 * Login is the one Server Action that cannot call requireAuth(): it runs
 * before a session exists.
 */
export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter a valid email address and password." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Invalid email or password." };
      }
      return { error: "Unable to sign in right now. Please try again." };
    }
    // Re-throw NEXT_REDIRECT and anything unexpected.
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await requireAuth();
  await signOut({ redirectTo: "/login" });
}
