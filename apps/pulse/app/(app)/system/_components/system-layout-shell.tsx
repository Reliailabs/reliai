import type { ReactNode } from "react";

import { SystemGroupNav } from "./system-group-nav";
import { SystemPageHeader } from "./system-page-header";

type SystemLayoutShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function SystemLayoutShell({ title, description, children }: SystemLayoutShellProps) {
  return (
    <main className="min-h-screen bg-background px-8 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <SystemPageHeader title={title} description={description} />
        <SystemGroupNav />
        {children}
      </div>
    </main>
  );
}
