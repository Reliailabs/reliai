import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireOperatorSession } from "@/lib/auth";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  const session = await requireOperatorSession();

  return (
    <AppShell
      operatorEmail={session.operator.email}
      memberships={session.memberships}
      activeOrganizationId={session.active_organization_id}
    >
      {children}
    </AppShell>
  );
}
