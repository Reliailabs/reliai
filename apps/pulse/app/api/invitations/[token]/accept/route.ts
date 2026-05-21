import { NextResponse } from "next/server";

import { API_URL, SESSION_COOKIE_NAME } from "@/lib/constants";

function sanitizeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/settings#team";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const formData = await request.formData();
  const returnTo = sanitizeReturnTo(formData.get("return_to"));
  const requestOrigin = request.headers.get("origin") ?? new URL(request.url).origin;
  const redirectUrl = (path: string) => new URL(path, requestOrigin);

  try {
    const response = await fetch(`${API_URL}/api/v1/invitations/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (response.status === 404) {
      return NextResponse.redirect(redirectUrl(`/join?token=${encodeURIComponent(token)}&error=not_found`), {
        status: 303,
      });
    }
    if (response.status === 409) {
      return NextResponse.redirect(redirectUrl(`/join?token=${encodeURIComponent(token)}&error=already_accepted`), {
        status: 303,
      });
    }
    if (response.status === 410) {
      return NextResponse.redirect(redirectUrl(`/join?token=${encodeURIComponent(token)}&error=expired`), {
        status: 303,
      });
    }
    if (!response.ok) {
      return NextResponse.redirect(redirectUrl(`/join?token=${encodeURIComponent(token)}&error=unavailable`), {
        status: 303,
      });
    }

    const payload = (await response.json()) as { session_token?: string };
    if (!payload.session_token) {
      return NextResponse.redirect(redirectUrl(`/join?token=${encodeURIComponent(token)}&error=unavailable`), {
        status: 303,
      });
    }

    const redirectResponse = NextResponse.redirect(redirectUrl(returnTo), { status: 303 });
    const secureCookie = new URL(request.url).protocol === "https:";
    redirectResponse.cookies.set(SESSION_COOKIE_NAME, payload.session_token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: secureCookie,
    });
    return redirectResponse;
  } catch {
    return NextResponse.redirect(redirectUrl(`/join?token=${encodeURIComponent(token)}&error=unavailable`), {
      status: 303,
    });
  }
}

export function GET() {
  return NextResponse.json({ detail: "Use POST to accept an invitation." }, { status: 405 });
}
