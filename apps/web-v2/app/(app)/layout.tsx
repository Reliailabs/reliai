import type { ReactNode } from "react"

import { NavRail } from "@/components/nav-rail"
import { TopRail } from "@/components/top-rail"
import { requireOperatorSession } from "@/lib/auth"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireOperatorSession()

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      <TopRail 
        email={session.operator.email}
        memberships={session.memberships}
        activeOrganizationId={session.active_organization_id}
      />
      <div className="flex flex-1 overflow-hidden">
        <NavRail />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}