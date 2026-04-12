"use client";

import type { LimitStatusType } from "@reliai/types";

interface LimitStatusInlineSlotProps {
  projectId?: string | null;
  types: LimitStatusType[];
  feature?: "ai_summary" | "ai_root_cause" | "ai_ticket_draft" | "ai_fix_summary";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function LimitStatusInlineSlot({ projectId, types, feature }: LimitStatusInlineSlotProps) {
  // TODO: implement limit status inline slot
  return null;
}