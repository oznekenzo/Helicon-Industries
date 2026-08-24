"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AUTH_SESSION_COOKIE,
  createAuthSessionToken,
  getBasicAuthCredentials,
  hasValidCredentials,
} from "@/lib/basic-auth";

export async function signIn(formData: FormData): Promise<never> {
  const expected = getBasicAuthCredentials();

  if (!expected) {
    throw new Error("Basic Auth is not configured.");
  }

  const username = formData.get("username");
  const password = formData.get("password");
  const remember = formData.get("remember") === "on";

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !hasValidCredentials({ username, password }, expected)
  ) {
    redirect("/?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    AUTH_SESSION_COOKIE,
    createAuthSessionToken({ username, password }),
    {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      ...(remember ? { maxAge: 60 * 60 * 24 * 7 } : {}),
    },
  );

  redirect("/dashboard");
}
