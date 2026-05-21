export function buildTeamInviteSignupHref(email: string): string {
  const normalizedEmail = email.trim();
  const params = new URLSearchParams({
    entry: "team-invite",
    email: normalizedEmail,
  });
  return `/signup?${params.toString()}`;
}
