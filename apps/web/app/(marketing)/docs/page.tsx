import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const sections = [
  {
    title: "Instrumentation",
    body: "SDK tracing for requests, retrieval, tool calls, and guardrail events.",
  },
  {
    title: "Operator workflows",
    body: "Control panel, incidents, trace graphs, deployment gates, and replay surfaces.",
  },
  {
    title: "Governance and runtime protection",
    body: "Guardrail policies, compliance visibility, and mitigation guidance for production paths.",
  },
];

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Docs</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">Technical overview for AI platform engineers.</h1>
        <p className="mt-6 text-base leading-8 text-steel">
          This is a lightweight product docs landing page for the public marketing flow. From here, visitors can move into the demo or into the signed-in product.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Card key={section.title} className="rounded-[28px] border-zinc-300 p-6">
            <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-steel">{section.body}</p>
          </Card>
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        <Button asChild>
          <Link href="/demo">View Demo</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/signup">Get Started</Link>
        </Button>
      </div>
    </main>
  );
}
