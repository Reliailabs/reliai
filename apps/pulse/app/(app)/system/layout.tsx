import type { ReactNode } from "react";
import { requireSystemAdminSession } from "@/lib/auth";

export default async function LegacySystemLayout({ children }: { children: ReactNode }) {
  await requireSystemAdminSession("/pulse/system");
  return children;
}
