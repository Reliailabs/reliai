import { Navbar } from "@/components/marketing-linear/navbar"
import { Footer } from "@/components/marketing-linear/footer"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  )
}
