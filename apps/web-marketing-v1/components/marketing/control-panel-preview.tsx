import Image from "next/image";

const previewScreens = [
  {
    title: "System Status",
    body: "The primary control surface for reliability score, incidents, and operator next steps.",
    src: "/screenshots/control-panel.png",
    alt: "Reliai control panel",
  },
  {
    title: "Incident Command Center",
    body: "Root-cause signals, mitigation guidance, and response context for live incidents.",
    src: "/screenshots/incident.png",
    alt: "Reliai incident command center",
  },
] as const;

export function ControlPanelPreview() {
  return (
    <div className="grid gap-4">
      {previewScreens.map((screen) => (
        <div
          key={screen.title}
          className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm"
        >
          <div className="border-b border-zinc-200 bg-[linear-gradient(180deg,#fbfbfc,#f1f3f6)] px-5 py-4">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">{screen.title}</p>
            <p className="mt-2 text-sm leading-6 text-secondary">{screen.body}</p>
          </div>
          <div className="flex h-[320px] items-center justify-center bg-zinc-50 px-4 py-4">
            <Image
              src={screen.src}
              alt={screen.alt}
              width={3200}
              height={2000}
              className="h-full w-full object-contain object-center"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
