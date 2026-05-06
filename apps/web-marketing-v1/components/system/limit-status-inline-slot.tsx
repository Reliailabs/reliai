"use client";

import type { LimitStatusType } from "@reliai/types";

import { useLimitStatus } from "@/hooks/use-limit-status";
import { LimitStatusInline } from "@/components/system/limit-status-inline";

interface LimitStatusInlineSlotProps {
  projectId?: string | null;
  types: LimitStatusType[];
  feature?: "ai_summary" | "ai_root_cause" | "ai_ticket_draft" | "ai_fix_summary";
}

export function LimitStatusInlineSlot({ projectId, types, feature }: LimitStatusInlineSlotProps) {
  const { limits } = useLimitStatus(projectId ?? undefined);
  const filtered = limits.filter((limit) => {
    if (!types.includes(limit.type)) return false;
    if (feature && limit.scope?.feature !== feature) return false;
    return true;
  });

  return <LimitStatusInline limits={filtered} />;
}
