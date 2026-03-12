"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Bot, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  {
    title: "Prompt update deployed",
    body: "A new support prompt expanded context and changed response behavior.",
    icon: Sparkles,
  },
  {
    title: "Hallucination spike detected",
    body: "Reliability signals caught an increase in unsupported policy references.",
    icon: Bot,
  },
  {
    title: "Incident opened automatically",
    body: "Reliai grouped the regression, linked traces, and attached the likely change window.",
    icon: BellRing,
  },
  {
    title: "Guardrail recommended",
    body: "Structured output validation was recommended before the issue reached users.",
    icon: ShieldCheck,
  },
];

interface FailureTimelineProps {
  disableAnimation?: boolean;
}

export function FailureTimeline({ disableAnimation = false }: FailureTimelineProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(disableAnimation);

  useEffect(() => {
    if (disableAnimation) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [disableAnimation]);

  return (
    <div ref={ref} className="relative pl-6">
      <div className="absolute left-4 top-4 h-[calc(100%-2rem)] w-px bg-[linear-gradient(180deg,rgba(15,23,42,0.25),rgba(15,23,42,0.06))]" />
      <div className="space-y-6">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className={cn(
                "relative rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-700",
                visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
              )}
              style={{ transitionDelay: `${index * 90}ms` }}
            >
              <div className="absolute -left-6 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white shadow-sm">
                <Icon className="h-4 w-4 text-ink" />
              </div>
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-2 text-sm leading-7 text-steel">{item.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
