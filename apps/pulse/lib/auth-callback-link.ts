const ALLOWED_CALLBACK_QUERY_PARAMS = new Set([
  "code",
  "state",
  "error",
  "error_description",
  "error_uri",
  "iss",
]);

function appendQueryParams(baseHref: string, query: URLSearchParams): string {
  if (!query || Array.from(query.keys()).length === 0) {
    return baseHref;
  }

  const url = new URL(baseHref);
  for (const [key, value] of query.entries()) {
    if (!ALLOWED_CALLBACK_QUERY_PARAMS.has(key)) {
      continue;
    }
    if (!url.searchParams.has(key)) {
      url.searchParams.append(key, value);
    }
  }
  return url.toString();
}

export function resolveExternalAuthCallbackHref(
  requestUrl: URL,
  query?: URLSearchParams,
): { ok: true; href: string } | { ok: false; reason: "missing" | "invalid" | "loop" } {
  const configured = process.env.NEXT_PUBLIC_RELIAI_AUTH_CALLBACK_URL?.trim();
  if (!configured) {
    return { ok: false, reason: "missing" };
  }

  let target: URL;
  try {
    target = new URL(configured);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ok: false, reason: "invalid" };
  }
  if (target.pathname !== "/auth/callback") {
    return { ok: false, reason: "invalid" };
  }
  if (target.origin === requestUrl.origin) {
    return { ok: false, reason: "loop" };
  }

  const params = query ?? new URLSearchParams();
  return { ok: true, href: appendQueryParams(target.toString(), params) };
}
