import type { ReactNode } from "react";

import { requireSystemAdminSession } from "@/lib/auth";

export default async function SystemLayout({ children }: { children: ReactNode }) {
  await requireSystemAdminSession("/system");
  return children;
}
