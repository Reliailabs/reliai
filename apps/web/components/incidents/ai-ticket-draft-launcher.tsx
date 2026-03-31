"use client";

import { useState } from "react";

import type { AiTicketDraftRequest, AiTicketDraftResponse } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { AiTicketDraftModal } from "@/components/incidents/ai-ticket-draft-modal";

interface AiTicketDraftLauncherProps {
  incidentId: string;
  generateDraft: (payload: AiTicketDraftRequest) => Promise<AiTicketDraftResponse>;
}

export function AiTicketDraftLauncher({ incidentId, generateDraft }: AiTicketDraftLauncherProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Draft ticket
      </Button>
      <AiTicketDraftModal
        open={open}
        onClose={() => setOpen(false)}
        incidentId={incidentId}
        generateDraft={generateDraft}
      />
    </>
  );
}
