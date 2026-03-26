import Image from "next/image";

const annotations = [
  { label: "Incident opens", body: "Refusal spike detected automatically" },
  { label: "Root cause", body: "Prompt update linked as primary cause" },
  { label: "Resolution proof", body: "Metric delta after fix applied" },
] as const;

export function HeroAnnotatedVisual() {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] text-steel">
          app.reliai.dev/incidents/command
        </div>
        <div className="aspect-[16/10] overflow-hidden">
          <Image
            src="/screenshots/incident.png"
            alt="Incident command center showing root cause analysis"
            width={3200}
            height={2000}
            className="h-full w-full object-cover object-top"
            priority
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {annotations.map((a) => (
          <div
            key={a.label}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-steel">
              {a.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
