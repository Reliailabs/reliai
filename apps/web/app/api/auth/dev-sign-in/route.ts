import { NextResponse } from "next/server";

import { signIn } from "@/lib/auth";
import { SESSION_COOKIE_NAME, devAuthEnabled } from "@/lib/constants";

const sanitizeReturnTo = (value: FormDataEntryValue | null): string => {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
};

export async function POST(request: Request) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ detail: "dev auth disabled" }, { status: 403 });
  }

  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const returnTo = sanitizeReturnTo(formData.get("return_to"));

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.redirect(new URL("/sign-in?error=1", request.url));
  }

  const result = await signIn(email, password);
  if (!result) {
    return NextResponse.redirect(new URL("/sign-in?error=1", request.url));
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, result.session_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
