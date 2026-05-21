import Link from "next/link";

import { API_URL } from "@/lib/constants";
import { buildTeamInviteSignupHref } from "@/lib/team-invite-link";

type JoinPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type InvitationDetails = {
  id: string;
  organization_name: string;
  invited_email: string;
  role: string;
  invited_by_email: string;
  status: string;
  join_path: string;
  expires_at: string;
  created_at: string;
};

function sanitizeReturnTo(value?: string): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/settings#team";
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

async function loadInvitation(token: string): Promise<InvitationDetails | null> {
  const response = await fetch(`${API_URL}/api/v1/invitations/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as InvitationDetails;
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = (await searchParams) ?? {};
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const rawReturnTo = Array.isArray(params.return_to) ? params.return_to[0] : params.return_to;
  const returnTo = sanitizeReturnTo(typeof rawReturnTo === "string" ? rawReturnTo : undefined);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const invitation = token ? await loadInvitation(token) : null;
  const signupHref = invitation ? buildTeamInviteSignupHref(invitation.invited_email) : "/signup";

  return (
    <main className="min-h-screen bg-[#09090B] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl shadow-black/20">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Reliai</p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-50">Accept team invitation</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            This invitation links you to the organization and role that were queued in Team settings.
          </p>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error === "expired"
                ? "This invitation has expired."
                : error === "already_accepted"
                  ? "This invitation was already accepted."
                  : error === "not_found"
                    ? "This invitation link was not found."
                  : "Unable to accept this invitation right now."}
            </div>
          ) : null}

          {invitation ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Invitation details</p>
              <div className="mt-4 space-y-2 text-sm text-zinc-300">
                <p>
                  Organization: <span className="text-zinc-100">{invitation.organization_name}</span>
                </p>
                <p>
                  Invited email: <span className="text-zinc-100">{invitation.invited_email}</span>
                </p>
                <p>
                  Role: <span className="text-zinc-100 capitalize">{invitation.role}</span>
                </p>
                <p>
                  Invited by: <span className="text-zinc-100">{invitation.invited_by_email}</span>
                </p>
                <p>
                  Expires: <span className="text-zinc-100">{formatDate(invitation.expires_at)}</span>
                </p>
              </div>
            </div>
          ) : token ? (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              Invitation link not found or no longer valid.
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              No invitation token was provided.
            </div>
          )}

          <form className="mt-6" method="post" action={token ? `/api/invitations/${encodeURIComponent(token)}/accept` : "/api/invitations/accept"}>
            <input type="hidden" name="return_to" value={returnTo} />
            <button
              type="submit"
              disabled={!token || !invitation}
              className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              Create account and join
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-4 text-xs text-zinc-500">
            <Link href={signupHref} className="underline underline-offset-2">
              Back to account setup
            </Link>
            <span>Returns to {returnTo}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
