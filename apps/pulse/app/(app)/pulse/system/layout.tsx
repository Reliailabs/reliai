import type { ReactNode } from "react";

import { AppShellFrame } from "@/components/dashboard/app-shell-frame";
import { requireSystemAdminSession } from "@/lib/auth";

export default async function SystemLayout({ children }: { children: ReactNode }) {
  await requireSystemAdminSession("/pulse/system");
  return <AppShellFrame activeSection="services">{children}</AppShellFrame>;
}
