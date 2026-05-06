"use client";

import { useEffect, useState, type ReactNode } from "react";

export function AppShellTransition({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="app-shell-transition" data-state={ready ? "ready" : "enter"}>
      {children}
    </div>
  );
}
