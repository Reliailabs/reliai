import type { ReactNode } from "react";

import { requireOperatorSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireOperatorSession();
  return <>{children}</>;
}
