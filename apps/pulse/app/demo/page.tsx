import { Navbar } from "@/components/marketing-linear/navbar"
import { HeroSection } from "@/components/marketing-linear/hero-section"
import { LogoCloud } from "@/components/marketing-linear/logo-cloud"
import { FeatureCardsSection } from "@/components/marketing-linear/feature-cards-section"
import { UseCaseSection } from "@/components/marketing-linear/use-case-section"
import { AISection } from "@/components/marketing-linear/ai-section"
import { ProductDirectionSection } from "@/components/marketing-linear/product-direction-section"
import { WorkflowsSection } from "@/components/marketing-linear/workflows-section"
import { CTASection } from "@/components/marketing-linear/cta-section"
import { Footer } from "@/components/marketing-linear/footer"

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <LogoCloud />
      <FeatureCardsSection />
      <UseCaseSection />
      <AISection />
      <ProductDirectionSection />
      <WorkflowsSection />
      <CTASection />
      <Footer />
    </>
  )
}
