"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { MainContent } from "@/components/dashboard/main-content";
import { RightPanel } from "@/components/dashboard/right-panel";
import type { Section } from "@/components/dashboard/sections";

export default function PulseDashboardPage() {
  const [activeSection, setActiveSection] = useState<Section>("overview");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <MainContent activeSection={activeSection} />
      <RightPanel />
    </div>
  );
}
