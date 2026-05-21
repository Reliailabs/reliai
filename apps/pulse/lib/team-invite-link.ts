export function buildTeamInviteSignupHref(email: string): string {
  const normalizedEmail = email.trim();
  const params = new URLSearchParams({
    entry: "team-invite",
    email: normalizedEmail,
  });
  return `/signup?${params.toString()}`;
}

export function buildTeamInviteJoinHref(token: string): string {
  const normalizedToken = token.trim();
  const params = new URLSearchParams({
    token: normalizedToken,
  });
  return `/join?${params.toString()}`;
}
