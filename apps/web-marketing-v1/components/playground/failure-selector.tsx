"use client";

import type { PlaygroundFailureType } from "@/hooks/use-playground-simulation";
import { cn } from "@/lib/utils";

const options: Array<{ id: PlaygroundFailureType; label: string }> = [
  { id: "hallucination", label: "Hallucination spike" },
  { id: "latency", label: "Latency regression" },
  { id: "model", label: "Model regression" },
  { id: "retrieval", label: "Retrieval failure" },
];

interface FailureSelectorProps {
  selectedFailure: PlaygroundFailureType;
  onSelect: (failure: PlaygroundFailureType) => void;
}

export function FailureSelector({ selectedFailure, onSelect }: FailureSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option.id)}
          className={cn(
            "rounded-[24px] border px-5 py-5 text-left transition",
            selectedFailure === option.id
              ? "border-ink bg-ink text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
              : "border-zinc-300 bg-white text-primary hover:border-zinc-400 hover:bg-zinc-50",
          )}
        >
          <p className="text-xs uppercase tracking-[0.22em] opacity-70">Failure</p>
          <p className="mt-3 text-lg font-semibold">{option.label}</p>
        </button>
      ))}
    </div>
  );
}
