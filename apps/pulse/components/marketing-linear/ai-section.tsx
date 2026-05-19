import { ChevronRight, Check, Paperclip, Globe, Lightbulb } from "lucide-react"

const agents = [
  { name: "Cursor", isAgent: true, selected: true, icon: "◇" },
  { name: "GitHub Copilot", isAgent: true, selected: false, icon: "◉" },
  { name: "Sentry", isAgent: true, selected: false, icon: "◈" },
  { name: "Leela", isAgent: false, selected: false, icon: "○" },
  { name: "Codex", isAgent: true, selected: false, icon: "◎" },
  { name: "Conor", isAgent: false, selected: false, icon: "○" },
]

export function AISection() {
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
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-zinc-400 text-sm">Core signal</span>
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
            AI Reliability Exposure Index (AREI)
          </h2>

          <p className="text-zinc-400 max-w-md mb-8">
            <span className="text-white font-medium">AREI is a 0–100 reliability exposure score.</span> Higher scores indicate greater production exposure. It is built from traces, incidents, audits, and deployments.
          </p>

          <a
            href="/demo"
            className="px-5 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors text-sm inline-flex items-center gap-2 mb-16"
          >
            Explore reliability evidence
            <ChevronRight className="w-4 h-4" />
          </a>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-16">
            {[
              { label: "Failure risk", dot: "bg-red-500" },
              { label: "Incident risk", dot: "bg-orange-500" },
              { label: "Drift risk", dot: "bg-yellow-500" },
              { label: "Guardrail risk", dot: "bg-blue-500" },
              { label: "Audit readiness gap", dot: "bg-purple-500" },
              { label: "Production criticality", dot: "bg-zinc-400" },
            ].map((factor) => (
              <div
                key={factor.label}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${factor.dot}`} />
                <span className="text-zinc-300 text-sm">{factor.label}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-center mb-24">
            <div
              style={{
                perspective: "900px",
                userSelect: "none",
                WebkitUserSelect: "none",
                width: "100%",
                maxWidth: "720px",
                position: "relative",
              }}
            >
              <div
                style={{
                  transformOrigin: "top",
                  willChange: "transform",
                  transform: "translateY(0%) rotateX(30deg) scale(1.15)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    border: "1px solid rgba(66, 66, 66, 0.5)",
                    background: "linear-gradient(rgba(255, 255, 255, 0.1) 40%, rgba(8, 9, 10, 0.1) 100%)",
                    borderRadius: "8px",
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    boxShadow:
                      "inset 0 1.503px 5.261px rgba(255, 255, 255, 0.04), inset 0 -0.752px 0.752px rgba(255, 255, 255, 0.1)",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                />

                <div
                  style={{
                    background: "linear-gradient(180deg, transparent 0%, #09090B 100%)",
                    height: "80%",
                    position: "absolute",
                    bottom: "-2px",
                    left: "-180px",
                    right: "-180px",
                    pointerEvents: "none",
                    zIndex: 11,
                  }}
                />

                <div className="bg-zinc-800/50 border border-zinc-700 rounded-t-xl px-5 py-4">
                  <span className="text-zinc-500 italic">Assign to...</span>
                </div>

                <div className="bg-zinc-900/80 border border-t-0 border-zinc-700 rounded-b-xl py-1">
                  {agents.map((agent, index) => (
                    <div
                      key={agent.name}
                      style={
                        agent.selected
                          ? {
                              transform: "scale(1.04) rotateX(17deg)",
                              background: "linear-gradient(#343434 0%, #2d2d2d 100%)",
                              borderRadius: "6px",
                              height: "48px",
                              position: "relative",
                              boxShadow:
                                "inset 0 -2.75px 4.75px rgba(255, 255, 255, 0.14), inset 0 -0.752px 0.752px rgba(255, 255, 255, 0.1), 0 54px 73px 3px rgba(0, 0, 0, 0.5)",
                              zIndex: 20,
                              marginLeft: "-12px",
                              marginRight: "-12px",
                            }
                          : {
                              opacity: 1 - index * 0.15,
                              height: "42px",
                            }
                      }
                    >
                      <div
                        className="flex items-center justify-between h-full"
                        style={{ paddingLeft: "24px", paddingRight: "24px", gap: "12px" }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-400 text-lg">{agent.icon}</span>
                          <span className={agent.selected ? "text-white font-medium" : "text-zinc-300"}>
                            {agent.name}
                          </span>
                          {agent.isAgent && (
                            <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">Agent</span>
                          )}
                        </div>
                        {agent.selected && <Check className="w-4 h-4 text-zinc-400" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="border-t border-r border-b border-zinc-800/60 pt-12 pr-12 pb-16">
                <h3 className="text-zinc-200 font-medium text-xl mb-3">Operational reliability guidance</h3>
                <p className="text-zinc-500 text-base mb-8">
                  Prioritize production AI risks with evidence-linked recommendations and clear remediation paths.
                </p>

                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0L9.5 5.5L15 7L9.5 8.5L8 14L6.5 8.5L1 7L6.5 5.5L8 0Z" />
                    </svg>
                    <span className="text-zinc-500 text-sm">
                      Triage <span className="text-zinc-300">Intelligence</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-zinc-600 text-sm w-20">Suggestions</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm"
                        style={{ background: "#7170ff" }}
                      >
                        <span className="w-4 h-4 bg-white/30 rounded-full" />
                        <span className="text-white">nan</span>
                      </span>
                      <span className="flex items-center gap-1.5 bg-zinc-800/30 rounded-md px-2 py-1 text-sm text-zinc-600">
                        <span className="w-3 h-3 border border-zinc-700 rounded" />
                        Mobile App Refactor
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-zinc-700">
                        <span className="w-2 h-2 bg-zinc-600 rounded-full" />
                        Slack
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-zinc-600 text-sm w-20">Similar</span>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-zinc-600 text-sm w-20">Related to</span>
                  </div>

                  <div className="bg-zinc-800/40 rounded-lg p-4 ml-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-5 h-5 bg-zinc-600 rounded-full" />
                      <span className="text-zinc-300 text-sm font-medium">nan</span>
                    </div>

                    <p className="text-zinc-500 text-xs mb-2">Why this owner was suggested</p>
                    <p className="text-zinc-500 text-sm mb-4">
                      This person handled previous findings linked to similar reliability regressions in the checkout
                      assistant flow
                    </p>

                    <p className="text-zinc-500 text-xs mb-2">Alternatives</p>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="flex items-center gap-1.5 bg-zinc-700/50 rounded-md px-2 py-1 text-sm">
                        <span className="w-4 h-4 bg-zinc-500 rounded-full" />
                        <span className="text-zinc-400">yann</span>
                      </span>
                      <span className="flex items-center gap-1.5 bg-zinc-700/50 rounded-md px-2 py-1 text-sm">
                        <span className="w-4 h-4 bg-zinc-500 rounded-full" />
                        <span className="text-zinc-400">erin</span>
                      </span>
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-300 text-sm py-2.5 rounded-md transition-colors">
                      <Check className="w-4 h-4" />
                      Accept suggestion
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-b border-zinc-800/60 pt-12 pl-12 pb-16">
                <h3 className="text-zinc-200 font-medium text-xl mb-3">Pulse integrations</h3>
                <p className="text-zinc-500 text-base mb-8">
                  Connect production reliability signals from your existing tooling and release systems.
                </p>

                <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-5 font-mono text-sm">
                  <p className="text-zinc-700 mb-3">//mcp.sprint.app/sse</p>
                  <div className="space-y-1 mb-6">
                    <p>
                      <span className="text-orange-400/70">"mcpServers"</span>
                      <span className="text-zinc-500">: {"{"}</span>
                    </p>
                    <p className="pl-4">
                      <span className="text-orange-400/70">"sprint"</span>
                      <span className="text-zinc-500">: {"{"}</span>
                    </p>
                    <p className="pl-8">
                      <span className="text-orange-400/70">"command"</span>
                      <span className="text-zinc-500">: </span>
                      <span className="text-green-400/70">"npx"</span>
                    </p>
                  </div>

                  <div className="bg-zinc-800/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-0.5 h-5 bg-zinc-600" />
                      <span className="text-zinc-600">Ask anything</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1.5 border border-zinc-700/60 text-zinc-500 text-sm px-3 py-1.5 rounded-full hover:bg-zinc-700/30 transition-colors">
                        <Paperclip className="w-3.5 h-3.5" />
                        Attach
                      </button>
                      <button className="flex items-center gap-1.5 border border-zinc-700/60 text-zinc-500 text-sm px-3 py-1.5 rounded-full hover:bg-zinc-700/30 transition-colors">
                        <Globe className="w-3.5 h-3.5" />
                        Search
                      </button>
                      <button className="flex items-center gap-1.5 border border-zinc-700/60 text-zinc-500 text-sm px-3 py-1.5 rounded-full hover:bg-zinc-700/30 transition-colors">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Reason
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
