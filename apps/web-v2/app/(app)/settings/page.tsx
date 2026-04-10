import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { getOrganization, getOrganizationMembers } from "@/lib/api"
import { requireOperatorSession } from "@/lib/auth"
import { formatRelativeTime } from "@/lib/time"

export default async function SettingsPage() {
  const session = await requireOperatorSession()
  const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id
  const activeMembership =
    session.memberships.find((membership) => membership.organization_id === orgId) ??
    session.memberships[0]

  const [organization, members] = await Promise.all([
    orgId ? getOrganization(orgId).catch(() => null) : Promise.resolve(null),
    orgId
      ? getOrganizationMembers(orgId).catch(() => ({ items: [] }))
      : Promise.resolve({ items: [] }),
  ])
  const now = Date.now()

  return (
    <div className="min-h-full">
      <PageHeader
        title="Settings"
        description="Operator access, organization settings, and API key guidance."
      />

      <div className="p-6 space-y-6">
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="px-4 py-3 border-b border-zinc-800 text-xs font-semibold text-zinc-300">
            Operator
          </div>
          <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-400">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Email</div>
              <div className="text-sm text-zinc-100">{session.operator.email}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Role</div>
              <div className="text-sm text-zinc-100">{activeMembership?.role ?? "—"}</div>
            </div>
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="px-4 py-3 border-b border-zinc-800 text-xs font-semibold text-zinc-300">
            Organization
          </div>
          <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Name</div>
              <div className="text-sm text-zinc-100">{organization?.name ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Plan</div>
              <div className="text-sm text-zinc-100">{organization?.plan ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-600">Org ID</div>
              <div className="text-sm text-zinc-100 font-mono">{organization?.id ?? "—"}</div>
            </div>
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 text-xs font-semibold text-zinc-300">
            Members
          </div>
          <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-600 grid grid-cols-3">
            <span>Email</span>
            <span>Role</span>
            <span>Joined</span>
          </div>
          <div className="divide-y divide-zinc-800/60 text-xs text-zinc-300">
            {members.items.length === 0 && (
              <div className="px-4 py-3 text-zinc-500">No members found.</div>
            )}
            {members.items.map((member) => (
              <div key={member.user_id} className="px-4 py-3 grid grid-cols-3 gap-2">
                <span className="text-zinc-100">{member.email ?? "—"}</span>
                <span className="text-zinc-400">{member.role}</span>
                <span className="text-zinc-500">{formatRelativeTime(member.created_at, now)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="px-4 py-3 border-b border-zinc-800 text-xs font-semibold text-zinc-300">
            API Keys
          </div>
          <div className="px-4 py-4 text-xs text-zinc-400">
            API keys are managed per project. Visit{" "}
            <Link href="/projects" className="text-zinc-100 hover:text-zinc-50 underline">
              Projects
            </Link>{" "}
            and open a project to view or rotate keys.
          </div>
        </section>
      </div>
    </div>
  )
}
