"use client";

import { ShieldAlert, Clock3, FileSearch, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const reviews = [
  {
    id: "RR-118",
    title: "Checkout Assistant Reliability Review",
    status: "needs_remediation",
    riskLevel: "high",
    summary: "Failed eval rate increased after model upgrade; two guardrail violations remain unresolved.",
    decision: "CONDITIONAL",
    reviewedAt: "May 5, 2026",
    blockers: 2,
  },
  {
    id: "RR-117",
    title: "Support Copilot Risk Review",
    status: "approved",
    riskLevel: "moderate",
    summary: "Regression checks are stable; minor retrieval drift is tracked with monitoring recommendations.",
    decision: "PASS",
    reviewedAt: "May 2, 2026",
    blockers: 0,
  },
  {
    id: "RR-116",
    title: "RAG Search Evidence Review",
    status: "needs_remediation",
    riskLevel: "critical",
    summary: "Hallucination exposure remains elevated in long-tail queries across two production workflows.",
    decision: "FAIL",
    reviewedAt: "Apr 28, 2026",
    blockers: 3,
  },
];

const cardShadow =
  "rgba(14, 63, 126, 0.04) 0px 0px 0px 1px, rgba(42, 51, 69, 0.04) 0px 1px 1px -0.5px, rgba(42, 51, 70, 0.04) 0px 3px 3px -1.5px, rgba(42, 51, 70, 0.04) 0px 6px 6px -3px, rgba(14, 63, 126, 0.04) 0px 12px 12px -6px, rgba(14, 63, 126, 0.04) 0px 24px 24px -12px";

export function RiskReviewsContent() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Open Risk Reviews" value="3" helper="Current decision cycle" />
        <SummaryCard label="Blocking Findings" value="5" helper="Across active reviews" />
        <SummaryCard label="Certification At Risk" value="1" helper="Production-linked warning" />
      </div>

      <div className="bg-card rounded-2xl border border-border" style={{ boxShadow: cardShadow }}>
        <div className="p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Risk Reviews</h3>
          <p className="text-sm text-muted-foreground">
            Reliability-facing decisions with evidence, blockers, and remediation posture.
          </p>
        </div>
        <div className="divide-y divide-border">
          {reviews.map((review) => (
            <div key={review.id} className="p-6 hover:bg-muted/20 transition-colors cursor-pointer">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    review.riskLevel === "critical"
                      ? "bg-destructive/10"
                      : review.riskLevel === "high"
                        ? "bg-warning/10"
                        : "bg-muted"
                  )}
                >
                  <ShieldAlert
                    className={cn(
                      "w-5 h-5",
                      review.riskLevel === "critical"
                        ? "text-destructive"
                        : review.riskLevel === "high"
                          ? "text-warning"
                          : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">{review.title}</h4>
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-medium rounded-full",
                        review.status === "approved"
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      )}
                    >
                      {review.status === "approved" ? "approved" : "needs remediation"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{review.summary}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileSearch className="w-3 h-3" />
                      {review.id}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      {review.reviewedAt}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground mb-1">Decision</p>
                  <p className="text-sm font-semibold text-foreground">{review.decision}</p>
                  <p className="text-xs text-muted-foreground mt-2">{review.blockers} blockers</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border" style={{ boxShadow: cardShadow }}>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground mb-1">{value}</p>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

