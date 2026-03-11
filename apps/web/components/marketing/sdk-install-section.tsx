"use client";

import { useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const examples = {
  python: {
    label: "Python",
    install: "pip install reliai",
    code: `pip install reliai

import reliai

reliai.init(
    api_key="YOUR_API_KEY"
)

with reliai.span("llm_call"):
    response = client.chat.completions.create(...)`,
  },
  node: {
    label: "Node",
    install: "npm install reliai",
    code: `npm install reliai

import { reliai } from "reliai"

reliai.init({
  apiKey: process.env.RELIAI_API_KEY
})

await reliai.span("llm_call", async () => {
  return openai.chat.completions.create(...)
})`,
  },
} as const;

const badges = [
  "Auto instrumentation",
  "Distributed tracing",
  "Runtime guardrails",
  "Incident detection",
];

export function SdkInstallSection() {
  const [activeTab, setActiveTab] = useState<keyof typeof examples>("python");
  const example = examples[activeTab];

  return (
    <section className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(320px,0.52fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Install Reliai in 60 seconds</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Install Reliai in 60 seconds
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
              Add reliability protection to your AI system with one SDK.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {Object.entries(examples).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as keyof typeof examples)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    activeTab === key
                      ? "border-ink bg-ink text-white"
                      : "border-zinc-300 bg-white text-steel hover:text-ink",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-ink"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        <Card className="mt-8 overflow-hidden rounded-[30px] border-zinc-300">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
              {example.install}
            </div>
            <CopyButton value={example.code} label="Copy Code" />
          </div>
          <pre className="overflow-x-auto bg-zinc-950 px-5 py-5 text-sm leading-7 text-zinc-100">
            <code>{example.code}</code>
          </pre>
        </Card>
      </div>
    </section>
  );
}
