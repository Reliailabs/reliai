import { Triangle } from "lucide-react"

export function LogoCloud() {
  return (
    <div className="relative z-20 pb-24 pt-8" style={{ backgroundColor: "#09090B" }}>
      <div className="w-full flex justify-center px-6">
        <div className="w-full max-w-4xl text-center">
          <p className="text-lg text-zinc-300 mb-2">
            Built for teams operating AI in production.
          </p>
          <p className="text-lg text-zinc-500 mb-16">
            AI copilots, RAG systems, and agent workflows.
          </p>

          <div className="relative group cursor-pointer">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-16 gap-y-10 items-center justify-items-center transition-all duration-300 group-hover:blur-[2.5px] group-hover:opacity-50">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="text-white font-semibold text-xl flex items-center gap-2">
                  <Triangle className="w-5 h-5 fill-white" />
                  Vercel
                </div>
              ))}
            </div>

            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <div className="px-5 py-2.5 bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 rounded-full text-sm text-zinc-300 flex items-center gap-2">
                Operating use cases
                <span aria-hidden="true">›</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
