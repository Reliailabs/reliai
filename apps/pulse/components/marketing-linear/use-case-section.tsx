import { ChevronRight } from "lucide-react"

const useCases = [
  {
    title: "AI copilots",
    description:
      "Customer-facing assistants where silent failures erode trust without obvious errors.",
  },
  {
    title: "RAG search systems",
    description:
      "Retrieval pipelines where context drift and hallucinations compound across responses.",
  },
  {
    title: "Agent workflows",
    description:
      "Multi-step automations where broken tool calls and routing regressions stall outcomes silently.",
  },
]

export function UseCaseSection() {
  return (
    <div className="relative z-20 py-40" style={{ backgroundColor: "#09090B" }}>
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "20%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 100%)",
        }}
      />
      <div className="w-full flex justify-center px-6">
        <div className="w-full max-w-5xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-zinc-400 text-sm">Use cases</span>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-white max-w-3xl mb-8"
            style={{
              letterSpacing: "-0.0325em",
              fontVariationSettings: '"opsz" 28',
              fontWeight: 538,
              lineHeight: 1.1,
            }}
          >
            Built for teams operating AI in production
          </h2>

          <p className="text-zinc-400 max-w-lg mb-16">
            Reliai is used for AI copilots, RAG search systems, and agent workflows where
            reliability, incident response, and production risk posture need to be visible in real
            time.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 flex flex-col gap-3"
              >
                <h3 className="text-white font-medium text-lg">{useCase.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
