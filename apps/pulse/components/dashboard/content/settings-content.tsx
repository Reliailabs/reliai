"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { buildTeamInviteSignupHref } from "@/lib/team-invite-link";
import { User, Bell, Lock, Palette, Users, Zap, ChevronRight, Server, Building2, BarChart3, Boxes, Settings, Trash2, UserPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SettingsInvitationItem, SettingsSurfaceData } from "@/components/dashboard/pulse-types";
import type { TeamMember } from "@/app/api/settings/team/route";

const defaultSettingsSections = [
  {
    id: "appearance",
    label: "Appearance",
    description: "Customize dashboard layout and theme behavior",
    icon: Palette,
    href: "/settings#appearance",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connect incident, alerting, and workflow tools",
    icon: Zap,
    href: "/settings#integrations",
  },
  {
    id: "security",
    label: "Security",
    description: "Control authentication and access settings",
    icon: Lock,
    href: "/settings#security",
  },
  {
    id: "profile",
    label: "Profile",
    description: "Manage your personal information",
    icon: User,
    href: "/settings#profile",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Configure how you receive updates",
    icon: Bell,
    href: "/settings#notifications",
  },
  {
    id: "team",
    label: "Team",
    description: "Manage team members and roles",
    icon: Users,
    href: "/settings#team",
  },
];

const iconById = {
  appearance: Palette,
  integrations: Zap,
  security: Lock,
  profile: User,
  notifications: Bell,
  team: Users,
  project: Building2,
  organization: Building2,
  members: Users,
  alerts: Bell,
  services: Boxes,
  pipeline: Server,
  extensions: Server,
  customers: Users,
  growth: BarChart3,
  expansion: BarChart3,
  platform: Server,
  reliability: Building2,
  intelligence: Building2,
} as const;

const defaultIntegrations = [
  { id: "pagerduty", name: "PagerDuty", connected: true, icon: "PD", statusLabel: "Connected", href: "/settings#alerts" },
  { id: "slack", name: "Slack", connected: true, icon: "S", statusLabel: "Connected", href: "/settings#integrations" },
  { id: "datadog", name: "Datadog", connected: true, icon: "DD", statusLabel: "Connected", href: "/settings#integrations" },
  { id: "github", name: "GitHub", connected: true, icon: "GH", statusLabel: "Connected", href: "/settings#integrations" },
  { id: "jira", name: "Jira", connected: false, icon: "J", statusLabel: "Planned", href: "/settings#integrations" },
];

const statusCopy = {
  mapped: "Mapped",
  partial: "Partial",
  stub: "Planned",
} as const;

export function SettingsContent({ settingsData }: { settingsData?: SettingsSurfaceData }) {
  const searchParams = useSearchParams();
  const projectScope = searchParams.get("project_id") ?? searchParams.get("projectId");
  const onCallHref = projectScope ? `/on-call?project_id=${encodeURIComponent(projectScope)}` : "/on-call";
  const joinReturnTo = projectScope
    ? `/settings?project_id=${encodeURIComponent(projectScope)}#team`
    : "/settings#team";
  const settingsSections = settingsData?.quickItems?.length
    ? settingsData.quickItems
    : defaultSettingsSections.map((section) => ({ ...section, status: "mapped" as const }));
  const integrations = settingsData?.integrations?.length ? settingsData.integrations : defaultIntegrations;
  const [profileState, setProfileState] = useState(settingsData?.profile ?? null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Team state
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("engineer");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<SettingsInvitationItem[]>([]);
  const [pendingInvitationsLoading, setPendingInvitationsLoading] = useState(true);
  const [pendingInvitationsError, setPendingInvitationsError] = useState<string | null>(null);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void fetch("/api/settings/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { profile?: SettingsSurfaceData["profile"] };
      })
      .then((payload) => {
        if (!isMounted || !payload?.profile) return;
        setProfileState(payload.profile);
        setFirstName(payload.profile.firstName);
        setLastName(payload.profile.lastName);
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  const profile = profileState ?? settingsData?.profile ?? {
    initials: "JD",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@company.com",
    role: "SRE Lead",
  };
  const anchorTargets = ["appearance", "integrations", "security", "profile", "notifications", "team"] as const;

  useEffect(() => {
    if (!profile) return;
    setFirstName((prev) => (prev ? prev : profile.firstName));
    setLastName((prev) => (prev ? prev : profile.lastName));
  }, [profile]);

  useEffect(() => {
    setTeamLoading(true);
    void fetch("/api/settings/team", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 403) {
          setTeamError("Team management requires a plan upgrade.");
          return;
        }
        if (!r.ok) return;
        const data = (await r.json()) as { items: TeamMember[] };
        setMembers(data.items ?? []);
      })
        .catch(() => setTeamError("Could not load team members."))
        .finally(() => setTeamLoading(false));
  }, []);

  useEffect(() => {
    let isMounted = true;
    setPendingInvitationsLoading(true);
    void fetch("/api/settings/team/invitations", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 403) {
          setPendingInvitationsError("Pending invitations require a plan upgrade.");
          return null;
        }
        if (!response.ok) return null;
        return (await response.json()) as { items?: SettingsInvitationItem[] };
      })
      .then((payload) => {
        if (!isMounted || !payload) return;
        setPendingInvitations(payload.items ?? []);
      })
      .catch(() => {
        if (isMounted) setPendingInvitationsError("Could not load pending invitations.");
      })
      .finally(() => {
        if (isMounted) setPendingInvitationsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim() || isInviting) return;
    setIsInviting(true);
    setInviteMessage(null);
    try {
      const r = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole }),
      });
      if (r.status === 404) {
        const pendingResponse = await fetch("/api/settings/team/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
        });
        if (pendingResponse.ok) {
          const invitation = (await pendingResponse.json()) as SettingsInvitationItem;
          setPendingInvitations((prev) => [invitation, ...prev.filter((item) => item.id !== invitation.id)]);
          setInviteMessage({
            text: `No Reliai account found for ${invitation.invitedEmail}. Invitation queued and the join link is now available below.`,
            ok: false,
          });
          return;
        }
        if (pendingResponse.status === 409) {
          setInviteMessage({
            text: `An invitation is already pending for ${inviteEmail.trim()}. Continue with /signup.`,
            ok: false,
          });
          return;
        }
        setInviteMessage({ text: "No Reliai account found for that email. They need to sign up first.", ok: false });
        return;
      }
      if (r.status === 403) {
        setInviteMessage({ text: "Adding members requires a plan upgrade.", ok: false });
        return;
      }
      if (!r.ok) {
        setInviteMessage({ text: "Failed to add member. Please try again.", ok: false });
        return;
      }
      const newMember = (await r.json()) as TeamMember;
      setMembers((prev) => [...prev, newMember]);
      setInviteName("");
      setInviteEmail("");
      setInviteMessage({ text: `${newMember.email} added as ${newMember.role}.`, ok: true });
    } catch {
      setInviteMessage({ text: "Failed to add member. Please try again.", ok: false });
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    if (removingId) return;
    setRemovingId(userId);
    try {
      const r = await fetch(`/api/settings/team/${userId}`, { method: "DELETE" });
      if (r.ok || r.status === 204) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (revokingInvitationId) return;
    setRevokingInvitationId(invitationId);
    try {
      const response = await fetch(`/api/settings/team/invitations/${invitationId}`, { method: "DELETE" });
      if (response.ok || response.status === 204) {
        setPendingInvitations((prev) => prev.filter((item) => item.id !== invitationId));
      }
    } finally {
      setRevokingInvitationId(null);
    }
  }

  function formatJoinedAt(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatInviteDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function buildInvitationJoinHref(joinPath: string): string {
    if (!joinPath.startsWith("/")) return joinPath;
    const [path, hash = ""] = joinPath.split("#", 2);
    const params = new URLSearchParams(path.split("?")[1] ?? "");
    params.set("return_to", joinReturnTo);
    const basePath = path.split("?")[0] ?? joinPath;
    const suffix = hash ? `#${hash}` : "";
    return `${basePath}?${params.toString()}${suffix}`;
  }

  const signupInviteHref =
    inviteEmail.trim().length > 0
      ? buildTeamInviteSignupHref(inviteEmail)
      : null;

  async function handleSaveProfile() {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!response.ok) throw new Error("save failed");
      const payload = (await response.json()) as { profile?: SettingsSurfaceData["profile"] };
      if (payload.profile) setProfileState(payload.profile);
      setSaveMessage("Profile saved.");
    } catch {
      setSaveMessage("Unable to save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  const sourceErrorText =
    settingsData && settingsData.sourceErrors.length > 0
      ? `Data source unavailable: ${settingsData.sourceErrors.join(", ")}.`
      : null;

  return (
    <div className="max-w-4xl space-y-6">
      {sourceErrorText ? (
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {sourceErrorText}
        </div>
      ) : null}
      <div className="sr-only" aria-hidden="true">
        {anchorTargets.map((anchorId) => (
          <span key={anchorId} id={anchorId} />
        ))}
      </div>
      {/* Profile Section */}
      <div id="profile" className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Profile Settings</h3>
        
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-chart-1/10 text-chart-1 flex items-center justify-center text-2xl font-semibold">
            {profile.initials}
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email <span className="text-xs text-muted-foreground font-normal">(contact support to change)</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={profile.email}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="role" className="block text-sm font-medium text-foreground mb-2">
                  Role <span className="text-xs text-muted-foreground font-normal">(set by organization)</span>
                </label>
                <input
                  type="text"
                  id="role"
                  value={profile.role}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              {saveMessage ? (
                <p className={cn("text-sm", saveMessage === "Profile saved." ? "text-success" : "text-destructive")}>
                  {saveMessage}
                </p>
              ) : null}
              <Button type="button" onClick={handleSaveProfile} disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Settings */}
      <div id="appearance" className="bg-card rounded-2xl border border-border overflow-hidden">
        <h3 className="font-semibold text-foreground p-6 pb-4">Quick Settings</h3>
        <p className="px-6 pb-4 text-xs text-muted-foreground">
          Some controls remain intentionally stubbed and are marked as Planned or Partial until their owner contracts are implemented.
        </p>
        <div className="divide-y divide-border">
          {settingsSections.map((section) => {
            const Icon = ("icon" in section && section.icon ? section.icon : iconById[section.id as keyof typeof iconById]) ?? Settings;
            const href = "href" in section && section.href ? section.href : "/settings";
            const isPlanned = "status" in section && section.status === "stub";
            return (
              <Link
                key={section.id}
                href={href}
                aria-disabled={isPlanned}
                title={isPlanned ? "Planned setting surface" : undefined}
                className="w-full flex items-center gap-4 p-6 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{section.label}</p>
                    {"status" in section ? (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        section.status === "mapped"
                          ? "bg-success/10 text-success"
                          : section.status === "partial"
                            ? "bg-warning/10 text-warning"
                            : "bg-muted text-muted-foreground"
                      )}>
                        {statusCopy[section.status]}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Team */}
      <div id="team" className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-1">Team Members</h3>
        <p className="text-xs text-muted-foreground mb-6">
          Members can be assigned to incidents. Admins can add and remove members.
        </p>

        {teamError ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {teamError}
          </div>
        ) : null}

        {/* Member list */}
        {teamLoading ? (
          <div className="space-y-2 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-6">No team members yet.</p>
        ) : (
          <div className="mb-6 divide-y divide-border rounded-xl border border-border overflow-hidden">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
                <div className="w-8 h-8 rounded-full bg-chart-1/15 flex items-center justify-center text-xs font-semibold text-chart-1 shrink-0">
                  {member.email.split("@")[0]!.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  <p className="text-xs text-muted-foreground">{formatJoinedAt(member.joinedAt)}</p>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground capitalize shrink-0">
                  {member.role}
                </span>
                <button
                  type="button"
                  onClick={() => void handleRemove(member.userId)}
                  disabled={removingId === member.userId}
                  aria-label={`Remove ${member.email}`}
                  className="ml-1 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending invitations */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-foreground">Pending Invitations</p>
            <p className="text-[11px] text-muted-foreground">Queued invites are visible here until accepted or revoked.</p>
          </div>
          {pendingInvitationsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : pendingInvitationsError ? (
            <p className="text-xs text-destructive">{pendingInvitationsError}</p>
          ) : pendingInvitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="grid grid-cols-[minmax(0,1.6fr)_0.8fr_1fr_0.8fr_0.8fr_auto] gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{invitation.invitedEmail}</p>
                    <Link href={buildInvitationJoinHref(invitation.joinPath)} className="text-xs font-medium text-primary underline underline-offset-2">
                      Open join link
                    </Link>
                    <p className="text-xs text-muted-foreground">Expires {formatInviteDate(invitation.expiresAt)}</p>
                    <p className="text-xs text-muted-foreground">Delivery: manual join link (email delivery deferred).</p>
                  </div>
                  <p className="text-sm capitalize text-muted-foreground">{invitation.role}</p>
                  <p className="truncate text-sm text-muted-foreground">{invitation.invitedByEmail}</p>
                  <p className="text-sm text-muted-foreground">{formatInviteDate(invitation.createdAt)}</p>
                  <p className="text-sm capitalize text-muted-foreground">{invitation.status}</p>
                  <button
                    type="button"
                    onClick={() => void handleRevokeInvitation(invitation.id)}
                    disabled={revokingInvitationId === invitation.id}
                    className="text-xs font-medium text-destructive underline underline-offset-2 disabled:opacity-40"
                  >
                    {revokingInvitationId === invitation.id ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add member form */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-foreground">Add member</p>
          <p className="text-[11px] text-muted-foreground">
            Invitation role is an access role (permissions): <span className="font-medium">admin</span>, <span className="font-medium">engineer</span>, <span className="font-medium">viewer</span>.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Full name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="w-44 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
              className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="admin">Admin</option>
              <option value="engineer">Engineer</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleInvite()}
              disabled={isInviting || !inviteName.trim() || !inviteEmail.trim()}
              className="gap-1.5 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {isInviting ? "Adding…" : "Add"}
            </Button>
          </div>
          {inviteMessage ? (
          <p className={cn("text-xs", inviteMessage.ok ? "text-success" : "text-destructive")}>
            {inviteMessage.text}
          </p>
        ) : null}
        {!inviteMessage?.ok && signupInviteHref ? (
          <Link href={signupInviteHref} className="text-xs font-medium text-primary underline underline-offset-2">
            Send invitation instead
          </Link>
        ) : null}
          <p className="text-[11px] text-muted-foreground">
            If they already have a Reliai account, use Add. If not, use Send invitation instead to queue a pending invitation and open the join link for acceptance.{" "}
            <Link href="/signup" className="underline underline-offset-2">
              Continue with account creation at /signup
            </Link>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Invitation emails are not auto-delivered from Pulse yet. Share the queued join link directly from Pending Invitations.
          </p>
          <p className="text-[11px] text-muted-foreground">
            On-call duty roles are configured separately in <Link href={onCallHref} className="underline underline-offset-2">On-Call</Link>.
          </p>
        </div>
      </div>

      {/* Integrations */}
      <div id="integrations" className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Integrations</h3>
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div
              key={integration.id ?? integration.name}
              className="flex items-center gap-4 p-4 rounded-xl bg-muted/30"
            >
              <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center text-sm font-semibold text-foreground">
                {integration.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{integration.name}</p>
                <p className="text-xs text-muted-foreground">{integration.statusLabel ?? (integration.connected ? "Connected" : "Not connected")}</p>
              </div>
              {integration.href ? (
                <Button
                  asChild
                  variant={integration.connected ? "outline" : "default"}
                  size="sm"
                  className={cn(integration.connected && "bg-transparent")}
                >
                  <Link
                    href={integration.href}
                    aria-disabled={!integration.connected}
                    title={!integration.connected ? "Planned integration wiring" : undefined}
                  >
                    {integration.connected ? "Manage" : "Planned"}
                  </Link>
                </Button>
              ) : (
                <Button
                  variant={integration.connected ? "outline" : "default"}
                  size="sm"
                  className={cn(integration.connected && "bg-transparent")}
                >
                  {integration.connected ? "Connected" : "Planned"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
