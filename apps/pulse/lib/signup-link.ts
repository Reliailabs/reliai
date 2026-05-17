export function resolveSignupHref(): string {
  const configured = process.env.NEXT_PUBLIC_RELIAI_SIGNUP_URL?.trim();

  if (!configured) {
    return "/sign-in";
  }

  // Disallow same-app local /signup paths to avoid redirect loops.
  if (configured.startsWith("/")) {
    return configured === "/signup" ? "/sign-in" : configured;
  }

  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "/sign-in";
    }
    if (url.pathname !== "/signup") {
      return "/sign-in";
    }
    return configured;
  } catch {
    return "/sign-in";
  }
}
