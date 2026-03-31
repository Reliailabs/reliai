"use client";

import { useState } from "react";

import type { AiFixPrSummaryRequest, AiFixPrSummaryResponse } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { AiFixSummaryModal } from "@/components/incidents/ai-fix-summary-modal";

interface AiFixSummaryLauncherProps {
  incidentId: string;
  incidentUpdatedAt: string | null;
  generateSummary: (payload: AiFixPrSummaryRequest) => Promise<AiFixPrSummaryResponse>;
}

export function AiFixSummaryLauncher({
  incidentId,
  incidentUpdatedAt,
  generateSummary,
}: AiFixSummaryLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Draft fix summary
      </Button>
      <AiFixSummaryModal
        open={open}
        onClose={() => setOpen(false)}
        incidentId={incidentId}
        incidentUpdatedAt={incidentUpdatedAt}
        generateSummary={generateSummary}
      />
    </>
  );
}
