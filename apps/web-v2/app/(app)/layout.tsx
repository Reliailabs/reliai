import { TopRail } from "@/components/top-rail"
import { NavRail } from "@/components/nav-rail"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      <TopRail />
      <div className="flex flex-1 overflow-hidden">
        <NavRail />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
