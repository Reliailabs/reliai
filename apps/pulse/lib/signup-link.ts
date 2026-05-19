function appendQueryParams(baseHref: string, query: URLSearchParams): string {
  if (!query || Array.from(query.keys()).length === 0) {
    return baseHref;
  }
  if (baseHref.startsWith("/")) {
    const next = new URLSearchParams(baseHref.includes("?") ? baseHref.split("?")[1] : "");
    for (const [key, value] of query.entries()) {
      if (!next.has(key)) {
        next.append(key, value);
      }
    }
    const qs = next.toString();
    const path = baseHref.split("?")[0];
    return qs ? `${path}?${qs}` : path;
  }
  try {
    const url = new URL(baseHref);
    for (const [key, value] of query.entries()) {
      if (!url.searchParams.has(key)) {
        url.searchParams.append(key, value);
      }
    }
    return url.toString();
  } catch {
    return baseHref;
  }
}

export function resolveSignupHref(query?: URLSearchParams): string {
  const params = query ?? new URLSearchParams();
  const configured = process.env.NEXT_PUBLIC_RELIAI_SIGNUP_URL?.trim();

  if (!configured) {
    return appendQueryParams("/sign-in", params);
  }

  // Disallow same-app local /signup paths to avoid redirect loops.
  if (configured.startsWith("/")) {
    const localTarget = configured === "/signup" ? "/sign-in" : configured;
    return appendQueryParams(localTarget, params);
  }

  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return appendQueryParams("/sign-in", params);
    }
    if (url.pathname !== "/signup") {
      return appendQueryParams("/sign-in", params);
    }
    return appendQueryParams(configured, params);
  } catch {
    return appendQueryParams("/sign-in", params);
  }
}
