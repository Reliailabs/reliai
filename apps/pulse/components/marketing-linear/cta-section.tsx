export function CTASection() {
  return (
    <section className="py-24 px-6" style={{ backgroundColor: "#09090B" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-lg">
            <h2 className="text-3xl md:text-4xl lg:text-[42px] font-medium text-white tracking-tight mb-4">
              Start with an audit or live operational demo.
            </h2>
            <p className="text-zinc-400 text-base leading-relaxed">
              Run an AI reliability audit to get certification posture, or replay a production
              failure to see how Reliai turns reliability evidence into mitigation decisions.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href="/demo"
              className="px-5 py-2.5 border border-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors text-sm"
            >
              Replay a production failure
            </a>
            <a
              href="/ai-reliability-audit"
              className="px-5 py-2.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-100 transition-colors text-sm"
            >
              Run reliability audit
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
