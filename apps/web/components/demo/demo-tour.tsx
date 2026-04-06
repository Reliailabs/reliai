"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface DemoTourStep {
  title: string;
  description: string;
  targetId: string;
}

interface DemoTourProps {
  steps: DemoTourStep[];
  currentStep: number;
  onStepChange: (index: number) => void;
  onClose?: () => void;
}

export function DemoTour({ steps, currentStep, onStepChange, onClose }: DemoTourProps) {
  const step = steps[currentStep];
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!step) return;

    const update = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`);
      if (!element) {
        setRect(null);
        return;
      }
      setRect(element.getBoundingClientRect());
    };

    update();
    const element = document.querySelector<HTMLElement>(`[data-tour-id="${step.targetId}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  const highlightStyle = useMemo(() => {
    if (!rect) return null;
    return {
      top: Math.max(rect.top - 12, 12),
      left: Math.max(rect.left - 12, 12),
      width: rect.width + 24,
      height: rect.height + 24,
    };
  }, [rect]);

  if (!step) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-40 bg-[rgba(2,6,23,0.4)]" />
      {highlightStyle ? (
        <div
          className="pointer-events-none fixed z-50 rounded-[28px] border-2 border-sky-400 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.15)] transition-all duration-300"
          style={highlightStyle}
        />
      ) : null}
      <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-demo-overlay bg-demo-overlay-glass p-5 text-textPrimary shadow-[0_24px_64px_rgba(2,6,23,0.45)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">
              Step {currentStep + 1} of {steps.length}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-textPrimary">{step.title}</h3>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-demo-overlay p-2 text-textSecondary transition hover:bg-demo-overlay hover:text-textPrimary"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <p className="mt-4 text-sm leading-7 text-textSecondary">{step.description}</p>
        <div className="mt-5 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onStepChange(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            type="button"
            onClick={() => onStepChange(Math.min(steps.length - 1, currentStep + 1))}
            disabled={currentStep === steps.length - 1}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
