import { NextResponse } from "next/server";

import { signIn } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

const sanitizeReturnTo = (value: FormDataEntryValue | null): string => {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/pulse";
};

const resolveRedirectBase = (request: Request): URL => {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (appBaseUrl) {
    try {
      const parsed = new URL(appBaseUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed;
      }
    } catch {
      // Fall through to request-derived URL below.
    }
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed;
      }
    } catch {
      // Fall through to request URL below.
    }
  }

  const fallback = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? fallback.protocol.replace(":", "");
    return new URL(`${proto}://${host}`);
  }
  return fallback;
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const returnTo = sanitizeReturnTo(formData.get("return_to"));
  const redirectBase = resolveRedirectBase(request);
  const redirectUrl = (path: string) => new URL(path, redirectBase);
  const errorRedirect = () => redirectUrl(`/sign-in?error=1&return_to=${encodeURIComponent(returnTo)}`);

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.redirect(errorRedirect(), { status: 303 });
  }

  const result = await signIn(email, password);
  if (!result) {
    return NextResponse.redirect(errorRedirect(), { status: 303 });
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
    { detail: "Use POST to /api/auth/sign-in with form data." },
    { status: 405 },
  );
}
