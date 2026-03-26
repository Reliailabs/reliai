import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell";
import { OnboardingPreAuthShell } from "@/components/onboarding/onboarding-preauth-shell";
import { getOperatorSession, requireOperatorSession } from "@/lib/auth";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const allowPreAuth = Boolean(cookieStore.get("reliai_onboarding_public")?.value);
  const session = allowPreAuth ? await getOperatorSession() : await requireOperatorSession();

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
