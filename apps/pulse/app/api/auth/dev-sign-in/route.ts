import { NextResponse } from "next/server";

import { signIn } from "@/lib/auth";
import { SESSION_COOKIE_NAME, devAuthEnabled } from "@/lib/constants";

const sanitizeReturnTo = (value: FormDataEntryValue | null): string => {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/pulse";
};

export async function POST(request: Request) {
  if (!devAuthEnabled()) {
    return NextResponse.json({ detail: "dev auth disabled" }, { status: 403 });
  }

  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const returnTo = sanitizeReturnTo(formData.get("return_to"));
  const requestOrigin = request.headers.get("origin") ?? new URL(request.url).origin;
  const redirectUrl = (path: string) => new URL(path, requestOrigin);

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.redirect(redirectUrl("/sign-in?error=1"), { status: 303 });
  }

  const result = await signIn(email, password);
  if (!result) {
    return NextResponse.redirect(redirectUrl("/sign-in?error=1"), { status: 303 });
  }

  const response = NextResponse.redirect(redirectUrl(returnTo), { status: 303 });
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
    { status: 405 },
  );
}
