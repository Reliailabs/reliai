import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { OnboardingPreAuthShell } from "@/components/onboarding/onboarding-preauth-shell";
import { getOperatorSession } from "@/lib/auth";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const session = await getOperatorSession();

  if (!session) {
    return <OnboardingPreAuthShell>{children}</OnboardingPreAuthShell>;
  }

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
