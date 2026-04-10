import { NextResponse } from "next/server";

import { signIn } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

const sanitizeReturnTo = (value: FormDataEntryValue | null): string => {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const returnTo = sanitizeReturnTo(formData.get("return_to"));

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.redirect(new URL("/sign-in?error=1", request.url), { status: 303 });
  }

  const result = await signIn(email, password);

  if (!result) {
    return NextResponse.redirect(new URL("/sign-in?error=1", request.url), { status: 303 });
  }

  const redirectTo = new URL(returnTo, request.url);
  const response = NextResponse.redirect(redirectTo, { status: 303 });
  const secureCookie = new URL(request.url).protocol === "https:";
  response.cookies.set(SESSION_COOKIE_NAME, result.session_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: secureCookie,
  });

  return response;
}

export function GET() {
  return NextResponse.json(
    { detail: "Use POST to /api/auth/dev-sign-in with form data." },
    { status: 405 }
  );
}
