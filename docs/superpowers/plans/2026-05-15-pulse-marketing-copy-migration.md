# Pulse Marketing — Full Copy Migration & Gap Creation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/pulse` the complete marketing destination by (1) migrating all copy from `apps/web/(marketing)` into existing pulse components, and (2) creating new sections, components, and pages — built entirely in pulse's design language — for content that exists in web but has no pulse equivalent.

**Architecture:** Pulse's design language is the only standard: dark `#09090B` bg, zinc palette, Framer Motion entrance animations, section-label + large-heading + description pattern, zinc-900/800 card grid conventions. New content is authored in pulse's style from scratch using web's copy as the content source — no JSX ported from web.

**Tech Stack:** Next.js 16 / React 19 / Tailwind CSS 4 / Framer Motion 12 / lucide-react — all already installed in `apps/pulse`.

---

## Gap Analysis

### Landing page — existing slots with wrong or thin copy

| Component | Current copy (pulse) | Source copy (web) | Action |
|---|---|---|---|
| Hero description | "…support production reliability decisions." | "…prove reliability in production." | Migrate |
| Hero badge | "Pulse dashboard preview" only | + "AREI · Incidents · Actions" | Migrate |
| Feature cards heading | "Built for AI reliability operators" | "Pulse capabilities in production" | Migrate |
| Feature cards description | generic | "Reliai continuously tracks AI behavior…" | Migrate |
| Card 0 title | "Reliability planning for AI workflows" | "Detect failures early" | Migrate |
| Card 1 title | "Regression monitoring at production scale" | "Investigate incidents" | Migrate |
| Card 2 title | "Evidence-backed reliability decisions" | "Take action" | Migrate |
| AI section label | "AI reliability operations" | "Core signal" | Migrate |
| AI section heading | "AI reliability monitoring and response" | "AI Reliability Exposure Index (AREI)" | Migrate |
| AI section description | generic | AREI 0–100 score explanation | Migrate |
| Product direction bottom-left heading | "Ideate and specify what to build next" | reliability investigation framing | Migrate |
| CTA heading | "Monitor behavior. Resolve risk. Ship with confidence." | "Start with audit or live Pulse preview." | Migrate |

### Landing page — content in web with no pulse slot

| Web content | Action |
|---|---|
| AREI 6-factor breakdown grid | Create new grid in pulse style within ai-section |
| Use case section (AI copilots, RAG, agent workflows) | Create new `UseCaseSection` component in pulse style |
| Feature card descriptions + bullet points | Add description to card data + render in card (pulse style) |
| CTA description paragraph | Add paragraph to existing CTA section |

### Missing pages

| Web page | Pulse equivalent | Action |
|---|---|---|
| `pricing/page.tsx` | None | Create `app/(marketing)/pricing/page.tsx` in pulse style |
| `docs-marketing/page.tsx` | None | Create `app/(marketing)/docs/page.tsx` in pulse style |
| `ai-reliability-audit/page.tsx` | None — **broken link from hero CTA** | Create `app/(marketing)/ai-reliability-audit/page.tsx` in pulse style |

### Navigation

| Element | Web | Pulse (current) | Action |
|---|---|---|---|
| Navbar links | Product, Docs, Demo, Pricing, Audit | Reliability, Audits, Incidents, Guardrails, Docs | Migrate to reflect new pages |

---

## Pulse Design Language Reference

All new content must follow these conventions exactly.

**Section wrapper:**
```tsx
<div className="relative z-20 py-40" style={{ backgroundColor: "#09090B" }}>
  <div className="w-full flex justify-center px-6">
    <div className="w-full max-w-5xl">
```

**Section label:**
```tsx
<motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }} transition={{ duration: 0.6 }}
  className="flex items-center gap-2 mb-6">
  <div className="w-2 h-2 rounded-full bg-blue-500" />
  <span className="text-zinc-400 text-sm">Label text</span>
  <ChevronRight className="w-4 h-4 text-zinc-500" />
</motion.div>
```

**Section heading:**
```tsx
<motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
  className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-white max-w-3xl mb-8"
  style={{ letterSpacing: "-0.0325em", fontVariationSettings: '"opsz" 28', fontWeight: 538, lineHeight: 1.1 }}>
  Heading text
</motion.h2>
```

**Description:**
```tsx
<motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
  className="text-zinc-400 max-w-md mb-16">
  Description.
</motion.p>
```

**Card (3-col grid):**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <motion.div ... className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700
    transition-colors rounded-2xl p-6 flex flex-col gap-3">
```

**Two-column divider:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2">
  <div className="border-t border-r border-b border-zinc-800/60 pt-12 pr-12 pb-16">
  <div className="border-t border-b border-zinc-800/60 pt-12 pl-12 pb-16">
```

**Page shell for new pages:**
```tsx
"use client"
import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { Navbar } from "@/components/marketing-linear/navbar"
import { Footer } from "@/components/marketing-linear/footer"

export default function PageName() {
  return (
    <main style={{ backgroundColor: "#09090B", minHeight: "100vh" }}>
      <Navbar />
      {/* sections */}
      <Footer />
    </main>
  )
}
```

---

## Task 1: Migrate Hero Copy

**File:** `apps/pulse/components/marketing-linear/hero-3d-stage.tsx`

- [ ] **Step 1: Update description (line 74–76)**

  Find:
  ```tsx
              Reliai Pulse monitors AI agents, RAG systems, and model behavior to detect regressions,
              surface incidents, and support production reliability decisions.
  ```
  Replace with:
  ```tsx
              Reliai Pulse monitors AI agents, RAG systems, and model behavior to detect regressions,
              surface incidents, and prove reliability in production.
  ```

- [ ] **Step 2: Add AREI badge (line 101–103)**

  Find:
  ```tsx
            <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
              Pulse dashboard preview
            </span>
  ```
  Replace with:
  ```tsx
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-300">
                Pulse dashboard preview
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-500">
                AREI · Incidents · Actions
              </span>
            </div>
  ```

- [ ] **Step 3: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```
  Expected: exit 0.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/pulse/components/marketing-linear/hero-3d-stage.tsx
  git commit -m "copy(pulse): update hero description and add AREI feature badge"
  ```

---

## Task 2: Migrate Feature Cards Copy + Add Card Descriptions

**File:** `apps/pulse/components/marketing-linear/feature-cards-section.tsx`

**Copy source:** `apps/web/app/(marketing)/page.tsx` — capabilities section

The card data array gains a `description` field. The card JSX renders it in a small text block above the title inside the existing card bottom area. The card shape, aspect ratio, illustrations, and Plus icon are untouched.

- [ ] **Step 1: Replace featureCards data array**

  Find the entire `const featureCards = [` block and replace it:
  ```tsx
  const featureCards = [
    {
      title: "Detect failures early",
      description: "Reliai continuously tracks AI behavior and surfaces reliability regressions before they become customer-visible incidents.",
      illustration: (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
          <svg width="100%" height="100%" viewBox="0 0 791 669" fill="none" xmlns="http://www.w3.org/2000/svg" className="max-w-full max-h-full">
            <path opacity="0.25" d="M377.449 24.2664L22.1248 192.099C9.24419 198.183 1.16249 211.29 1.51081 225.531L10.925 610.428C11.5763 637.054 39.9132 653.778 63.5378 641.48L409.448 461.403C421.355 455.204 428.824 442.895 428.824 429.471V56.8179C428.824 30.407 401.33 12.9865 377.449 24.2664Z" fill="#2C2C2C" fillOpacity="0.8" stroke="#424242" strokeWidth="3" />
            <path opacity="0.25" d="M497.594 24.2664L142.269 192.099C129.389 198.183 121.307 211.29 121.655 225.531L131.07 610.428C131.721 637.054 160.058 653.778 183.682 641.48L529.592 461.403C541.5 455.204 548.969 442.895 548.969 429.471V56.8179C548.969 30.407 521.475 12.9865 497.594 24.2664Z" fill="#2C2C2C" fillOpacity="0.8" stroke="#424242" strokeWidth="3" />
            <path opacity="0.25" d="M617.738 24.2664L262.414 192.099C249.533 198.183 241.451 211.29 241.8 225.531L251.214 610.428C251.865 637.054 280.202 653.778 303.827 641.48L649.737 461.403C661.644 455.204 669.113 442.895 669.113 429.471V56.8179C669.113 30.407 641.619 12.9865 617.738 24.2664Z" fill="#2C2C2C" fillOpacity="0.8" stroke="#424242" strokeWidth="3" />
            <path opacity="0.25" d="M737.883 24.2664L382.558 192.099C369.678 198.183 361.596 211.29 361.944 225.531L371.358 610.428C372.01 637.054 400.347 653.778 423.971 641.48L769.881 461.403C781.789 455.204 789.258 442.895 789.258 429.471V56.8179C789.258 30.407 761.764 12.9865 737.883 24.2664Z" fill="#2C2C2C" fillOpacity="0.8" stroke="#424242" strokeWidth="3" />
          </svg>
        </div>
      ),
    },
    {
      title: "Investigate incidents",
      description: "When reliability degrades, Reliai groups signals into incidents and links each incident to the traces and failure patterns driving it.",
      illustration: (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <img src="/images/speed-lines.png" alt="Speed lines illustration" className="w-full h-full object-cover" style={{ filter: "invert(1)" }} />
        </div>
      ),
    },
    {
      title: "Take action",
      description: "Pulse converts reliability signals into clear next steps, with guardrail posture and certification readiness visible in the same workflow.",
      illustration: (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <img src="/images/precision-workflow.png" alt="Precision workflow illustration" className="w-full h-full object-cover" style={{ filter: "invert(1)" }} />
        </div>
      ),
    },
  ]
  ```

- [ ] **Step 2: Add description render above title in card JSX**

  Find:
  ```tsx
                  <h3 className="text-white font-medium text-lg leading-tight">{card.title}</h3>
  ```
  Replace with:
  ```tsx
                  <div className="flex flex-col gap-2">
                    <p className="text-zinc-500 text-xs leading-relaxed">{card.description}</p>
                    <h3 className="text-white font-medium text-lg leading-tight">{card.title}</h3>
                  </div>
  ```

- [ ] **Step 3: Update section heading**

  Find:
  ```tsx
              Built for AI reliability operators
  ```
  Replace with:
  ```tsx
              Pulse capabilities in production
  ```

- [ ] **Step 4: Update section description**

  Find:
  ```tsx
                Reliai Pulse is designed for teams that need clear reliability signals, incident context,
                and fast operational decisions for production AI.{" "}
  ```
  Replace with:
  ```tsx
                Reliai continuously tracks AI behavior to surface regressions, group incidents, and convert
                reliability signals into clear next steps for production AI teams.{" "}
  ```

- [ ] **Step 5: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add apps/pulse/components/marketing-linear/feature-cards-section.tsx
  git commit -m "copy(pulse): migrate web capability card copy and add descriptions"
  ```

---

## Task 3: Migrate AI Section Copy + Add AREI Breakdown Grid

**File:** `apps/pulse/components/marketing-linear/ai-section.tsx`

**Copy source:** `apps/web/app/(marketing)/page.tsx` — AREI Core Signal section

The label, heading, and description are text-only swaps. The AREI 6-factor grid is new content built in pulse's card style (zinc-900/50 bg, zinc-800 border, rounded-xl, colored dot per factor) — inserted between the CTA button and the existing agent dropdown mockup.

- [ ] **Step 1: Update label**

  Find:
  ```tsx
            <span className="text-zinc-400 text-sm">AI reliability operations</span>
  ```
  Replace with:
  ```tsx
            <span className="text-zinc-400 text-sm">Core signal</span>
  ```

- [ ] **Step 2: Update heading**

  Find:
  ```tsx
            AI reliability monitoring and response
  ```
  Replace with:
  ```tsx
            AI Reliability Exposure Index (AREI)
  ```

- [ ] **Step 3: Update description**

  Find:
  ```tsx
            <span className="text-white font-medium">Reliai Pulse for operators.</span> Detect regressions, investigate incidents, and track reliability risk across production AI workflows.
  ```
  Replace with:
  ```tsx
            <span className="text-white font-medium">AREI is a 0–100 reliability exposure score.</span> Higher scores indicate greater production exposure. It is built from traces, incidents, audits, and deployments.
  ```

- [ ] **Step 4: Insert AREI factor grid before the agent dropdown**

  Find:
  ```tsx
          {/* Agent dropdown mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex justify-center mb-24"
  ```
  Replace with:
  ```tsx
          {/* AREI breakdown grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-16"
          >
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
          </motion.div>

          {/* Agent dropdown mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex justify-center mb-24"
  ```

- [ ] **Step 5: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add apps/pulse/components/marketing-linear/ai-section.tsx
  git commit -m "copy(pulse): migrate AREI copy and add 6-factor breakdown grid"
  ```

---

## Task 4: Create Use Case Section

**Gap:** Web has a dedicated "Built for teams operating AI in production" section with 3 named use cases. Pulse has only a tagline in the logo cloud. A new `UseCaseSection` component is created in pulse's design language and inserted between `<FeatureCardsSection />` and `<AISection />`.

**Files:**
- Create: `apps/pulse/components/marketing-linear/use-case-section.tsx`
- Modify: `apps/pulse/components/marketing-linear/hero-3d-stage.tsx` (import + render)

**Copy source:** `apps/web/app/(marketing)/page.tsx` — use case section

- [ ] **Step 1: Create `use-case-section.tsx`**

  Create `apps/pulse/components/marketing-linear/use-case-section.tsx`:
  ```tsx
  "use client"

  import { motion } from "framer-motion"
  import { ChevronRight } from "lucide-react"

  const useCases = [
    {
      title: "AI copilots",
      description: "Customer-facing assistants where silent failures erode trust without obvious errors.",
    },
    {
      title: "RAG search systems",
      description: "Retrieval pipelines where context drift and hallucinations compound across responses.",
    },
    {
      title: "Agent workflows",
      description: "Multi-step automations where broken tool calls and routing regressions stall outcomes silently.",
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2 mb-6"
            >
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-zinc-400 text-sm">Use cases</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-white max-w-3xl mb-8"
              style={{
                letterSpacing: "-0.0325em",
                fontVariationSettings: '"opsz" 28',
                fontWeight: 538,
                lineHeight: 1.1,
              }}
            >
              Built for teams operating AI in production
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-zinc-400 max-w-lg mb-16"
            >
              Reliai is used for AI copilots, RAG search systems, and agent workflows where reliability,
              incident response, and production risk posture need to be visible in real time.
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {useCases.map((useCase, index) => (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 flex flex-col gap-3"
                >
                  <h3 className="text-white font-medium text-lg">{useCase.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{useCase.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Import and insert in `hero-3d-stage.tsx`**

  Add import alongside existing imports:
  ```tsx
  import { UseCaseSection } from "./use-case-section"
  ```

  Find:
  ```tsx
          <FeatureCardsSection />
          <AISection />
  ```
  Replace with:
  ```tsx
          <FeatureCardsSection />
          <UseCaseSection />
          <AISection />
  ```

- [ ] **Step 3: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add apps/pulse/components/marketing-linear/use-case-section.tsx
  git add apps/pulse/components/marketing-linear/hero-3d-stage.tsx
  git commit -m "feat(pulse): add use case section with web copy in pulse design"
  ```

---

## Task 5: Migrate CTA Section Copy

**File:** `apps/pulse/components/marketing-linear/cta-section.tsx`

- [ ] **Step 1: Replace full file content**

  ```tsx
  export function CTASection() {
    return (
      <section className="py-24 px-6" style={{ backgroundColor: "#09090B" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-lg">
              <h2 className="text-3xl md:text-4xl lg:text-[42px] font-medium text-white tracking-tight mb-4">
                Start with audit or live Pulse preview.
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed">
                Run an AI reliability audit to get certification posture, or review Pulse to see how
                Reliai turns production reliability signals into action.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href="/demo"
                className="px-5 py-2.5 border border-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors text-sm"
              >
                View Pulse dashboard
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
  ```

- [ ] **Step 2: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add apps/pulse/components/marketing-linear/cta-section.tsx
  git commit -m "copy(pulse): replace CTA slogan with audit-preview copy and add description"
  ```

---

## Task 6: Migrate Product Direction Heading

**File:** `apps/pulse/components/marketing-linear/product-direction-section.tsx`

- [ ] **Step 1: Update bottom-left heading**

  Find:
  ```tsx
              Ideate and specify
              <br />
              what to build next
  ```
  Replace with:
  ```tsx
              Investigate and document
              <br />
              reliability issues
  ```

- [ ] **Step 2: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add apps/pulse/components/marketing-linear/product-direction-section.tsx
  git commit -m "copy(pulse): replace off-brand product direction heading"
  ```

---

## Task 7: Migrate Navbar Links

**File:** `apps/pulse/components/marketing-linear/navbar.tsx`

Read the current navbar file first to identify the exact nav links structure, then update to reflect the new pages.

- [ ] **Step 1: Inspect current links**
  ```bash
  grep -n "href\|label\|Reliability\|Audits\|Incidents\|Guardrails\|Docs" \
    /Users/robert/Documents/Reliai/apps/pulse/components/marketing-linear/navbar.tsx
  ```

- [ ] **Step 2: Update nav links to reflect new pages**

  Replace whatever the current nav links array contains with:
  ```tsx
  { label: "Product", href: "/demo" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
  { label: "Audit", href: "/ai-reliability-audit" },
  ```

- [ ] **Step 3: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add apps/pulse/components/marketing-linear/navbar.tsx
  git commit -m "copy(pulse): update navbar links to reflect pricing, docs, audit pages"
  ```

---

## Task 8: Create Pricing Page

**File:** `apps/pulse/app/(marketing)/pricing/page.tsx`
**Copy source:** `apps/web/app/(marketing)/pricing/page.tsx`

**Sections:** Hero → Plans (2×2 tier grid) → Upgrade reasons (3-col) → Operator note (bordered callout) → Trigger guide (5 numbered rows) → Final CTA strip

**Copy:**

Hero:
- Label: "Pricing" · dot: green-500
- H1: "Upgrade when reliability becomes a job, not a side project."
- Description: "Reliai pricing follows how teams actually adopt reliability. Start small, then upgrade the moment the signal needs to stay live."
- CTA secondary: "Start with the demo" → `/demo`
- CTA primary: "Run reliability audit" → `/ai-reliability-audit`

Tiers (2×2 grid, `grid-cols-1 md:grid-cols-2 gap-4`):
```
Evaluate | $0
"Validate Reliai on a single service with a live control panel."
Features: Single project workspace · Trace ingestion + graph view · Incident timeline · Limited daily traces
Unlock: "Unlocks a live demo loop for your first workload."

Team | $49 / seat
"Shared reliability operations for the team shipping AI changes."
Features: Multiple members and projects · Guardrail triggers + retries · Deploy compare and regression views · Alert routing to Slack + email
Unlock: "Unlocks collaboration, shared incidents, and team workflows."

Production | $199 / month
"Operate customer-facing AI systems with audit visibility and SLOs."
Features: Audit log access · Viewer roles + reporting links · Incident severity routing · Higher trace limits · Priority onboarding
Unlock: "Unlocks production governance without slowing releases."

Enterprise | Custom
"Dedicated support, private deployments, and enterprise reliability reviews."
Features: Dedicated reliability partner · Private cloud / on-prem · Custom data retention · Executive reporting
Unlock: "Unlocks enterprise rollout and security review."
```

Upgrade reasons (3-col grid, same style as use-case cards):
- Label: "Upgrade reasons" · dot: orange-500
- H2: "The moment Reliai becomes your control room."
```
"On-call signal that stays sharp."
"Move beyond demo-grade telemetry. Teams upgrade to keep trace volume, guardrails, and regression evidence flowing."

"Shared accountability."
"Incidents are a team sport. Upgrade when multiple engineers need access to the same investigations."

"Operational proof."
"Leaders want to see reliability improvements. Production adds auditability and reportable outcomes."
```

Operator note (bordered box, `bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8`):
- Heading: "Upgrade triggers are lived moments."
- Body: "If you are already discussing incidents or guardrails in Slack, you are past the Evaluate tier. Plan changes should remove friction, not add procurement."
- 3 bullet rows (dot + text):
  - "Team tier removes member limits."
  - "Production tier unlocks audit trails."
  - "Enterprise tier meets compliance and scale."

Trigger guide:
- Label: "Upgrade triggers" · dot: blue-500
- H2: "Upgrade when the signal would otherwise break."
- Description: "These are the moments teams see value in Reliai. Each one maps to an immediate capability upgrade."
- 5 rows (`border-b border-zinc-800 py-6 flex gap-6`):
  1. "When you hit your trace limit" — "You need continuous visibility during a rollout, not throttled snapshots. Upgrade to keep the signal live."
  2. "When your team joins" — "Incidents move faster when engineers share the same timeline, notes, and evidence."
  3. "When something breaks" — "Reliability work needs a record. Audit-ready incident trails are production-grade by default."
  4. "When you need to show results" — "Execs and product leads want proof: regression deltas, resolved incidents, and guardrail impact."
  5. "When reliability matters" — "The platform becomes a control room, not just a dashboard. That is the Production tier."

Final CTA strip (same layout as `CTASection`):
- H2: "Run the demo, then upgrade at the first real incident."
- Description: "Pricing should not slow an incident response. Start free, then move the moment the data matters."
- CTA secondary: "Start with Evaluate" → `/demo`
- CTA primary: "Run reliability audit" → `/ai-reliability-audit`

- [ ] **Step 1: Create the pricing page** with all sections above using pulse design conventions.

- [ ] **Step 2: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 3: Build**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse build
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add "apps/pulse/app/(marketing)/pricing/page.tsx"
  git commit -m "feat(pulse): create pricing page with web copy in pulse design"
  ```

---

## Task 9: Create Docs Marketing Page

**File:** `apps/pulse/app/(marketing)/docs/page.tsx`
**Copy source:** `apps/web/app/(marketing)/docs-marketing/page.tsx`

**Sections:** Hero → How it works (5-step) → System areas (3-col) → AI in Reliai (2-col) → Limits (4-col) → Start here (3-col) → CTA strip

**Copy:**

Hero:
- Label: "Docs" · dot: zinc-400
- H1: "Understand, debug, and operate AI systems in production."
- Description: "Reliai helps teams detect, investigate, and resolve AI system issues using real-time telemetry, deterministic root cause analysis, and AI-assisted workflows. These docs are designed for operators and engineers working with production AI systems."
- Italic note (text-zinc-500 italic): "Reliai never replaces system truth with AI — it helps you understand it faster."
- CTA secondary: "View Demo" → `/demo`
- CTA primary: "Get Started" → `/sign-in`

How it works (numbered vertical steps):
- Label: "How it works" · dot: blue-500
- H2: "How Reliai works"
- Subtitle (text-zinc-500): "Reliai is built around a single operational loop."
```
1. Detect      — "Identify regressions through metrics and trace patterns."
2. Understand  — "Analyze root cause using trace comparison and evidence."
3. Fix         — "Apply changes based on system recommendations and inspection."
4. Prove       — "Verify improvement using resolution impact."
5. Share       — "Export context via ticket drafts and fix summaries."
```
Step design: numbered circle (`w-7 h-7 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 text-xs`) + vertical connector line between steps + title (`text-white font-medium`) + description (`text-zinc-500 text-sm`)

System areas (3-col cards):
- Label: "System areas" · dot: green-500
- H2: "System areas"
```
Instrumentation
"Capture traces across your AI system — requests and responses, retrieval and tool calls, guardrail and policy events."

Operator workflows
"Investigate incidents, compare traces, review root cause analysis, and validate fixes using the command center."

Governance and runtime protection
"Apply guardrail policies, monitor compliance checks, and get mitigation guidance for production paths."
```

AI in Reliai (2-col divider, same border pattern as ai-section bottom columns):
- Label: "AI in Reliai" · dot: blue-500
- H2: "AI in Reliai"
- Subtitle: "Reliai uses AI to assist operators — not replace them."
- Left col heading: "AI is used for"
  - Summarize incidents
  - Explain root cause evidence
  - Draft tickets and summaries
- Right col heading: "AI is NOT used for"
  - Generate traces
  - Determine root cause
  - Trigger actions
  - Modify system data

Limits (4-col grid, `grid-cols-2 md:grid-cols-4`):
- H2: "Limits & partial data"
- Subtitle (text-zinc-500): "Reliai surfaces system limits clearly. You may see:"
```
Sampling active        — "Some traces are not stored."
Rate limited           — "Some data may be delayed or dropped."
Processing delayed     — "Analysis is queued."
Payload truncated      — "Some fields are incomplete."
```
Each card: `bg-zinc-900/50 border border-zinc-800 rounded-xl p-5` with title in `text-zinc-300 font-medium text-sm mb-2` and description in `text-zinc-500 text-xs`

Start here (3-col cards):
- H2: "Start here"
```
Incident workflow    — "Debug issues step by step."
Core concepts        — "Traces, incidents, and evidence."
AI guide             — "How to use AI safely in Reliai."
```

CTA strip:
- H2: "Start understanding your AI system."
- CTA secondary: "View Demo" → `/demo`
- CTA primary: "Get Started" → `/sign-in`

- [ ] **Step 1: Create the docs page** with all sections above using pulse design conventions.

- [ ] **Step 2: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 3: Build**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse build
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add "apps/pulse/app/(marketing)/docs/page.tsx"
  git commit -m "feat(pulse): create docs marketing page with web copy in pulse design"
  ```

---

## Task 10: Create AI Reliability Audit Page

**File:** `apps/pulse/app/(marketing)/ai-reliability-audit/page.tsx`
**Copy source:** `apps/web/app/(marketing)/ai-reliability-audit/page.tsx`

This is the highest-priority gap — pulse's hero primary CTA already links here and it 404s.

**Sections:** Hero (2-col) → Audit stages (5 numbered) → Risk types (2-col grid) → Deliverables (5 rows) → Guarantee → Pricing (2-col) → Final CTA

**Copy:**

Hero (2-col: left=copy, right=engagement snapshot):
- Label: "AI Reliability Audit" · dot: red-500
- H1: "Find and Fix Hidden Failures in Your AI System in 7 Days"
- Description: "We instrument your production LLM workflows, analyze real traces, and identify 3–5 concrete failure modes like hallucinations, regressions, and silent breakdowns. Then we implement guardrails and alerts to reduce the risk of user-facing AI incidents."
- Note (text-zinc-500 text-sm): "For teams already running LLMs in production."
- CTA: "Book a 20-minute call" → `/demo`
- Guarantee badge (`border border-zinc-700 rounded-lg px-4 py-2 text-zinc-400 text-sm`): "If we don't find at least 3 real issues or meaningful risks, you don't pay."
- Right col engagement snapshot (`bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6`):
  - "7 days" (text-white font-medium) — "Instrument, analyze, and harden your system."
  - "3–5 failure modes" — "Documented issues with evidence, impact, and remediation paths."
  - "Guardrails live" — "Validation, retries, and alerts in place before handoff."

Audit stages (numbered vertical, same step design as docs):
- Label: "How it works" · dot: blue-500
- H2: "Identify failures, validate evidence, and harden before production."
- Description: "A five-stage audit workflow built for decision-ready reliability and certification outcomes."
```
1. Scope Analysis        — "We map your AI system, use cases, and highest-risk failure surfaces."
2. Reliability Testing   — "We stress-test prompts, workflows, and outputs for failures in realistic conditions."
3. Findings Validation   — "We verify each issue to remove noise and confirm reproducible risk."
4. Risk Review           — "We assess system-wide reliability patterns and prioritize the highest-impact concerns."
5. Certification Decision— "We issue a clear production readiness outcome with remediation guidance."
```

Risk types (2-col grid, 5 cards — last card full-width):
- Label: "The risk" · dot: orange-500
- H2: "Hidden failures stay invisible until customers feel them."
- Description: "Production LLM systems often fail in ways that never surface as obvious errors. This audit isolates the exact failure surfaces before they become user-facing incidents."
```
Silent failures
"Errors that never throw, but quietly degrade outcomes and customer experience."
Impact: "Erodes trust without triggering obvious alerts."

Hallucinations
"False answers or invented facts that make it into production responses."
Impact: "Creates costly rework and escalations downstream."

Broken automations
"Tool calls fail, retries loop, and workflows stall without clear visibility."
Impact: "Missed SLAs and manual recovery drain engineering time."

Undetected regressions
"Model or prompt changes shift behavior without obvious warnings."
Impact: "Quality drops before anyone can tie it to a change."

Prompt + model drift
"Small changes compound until the system behaves differently than expected."
Impact: "Gradual degradation that chips away at product reliability."
```
Card design: `bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-6` with title `text-white font-medium mb-2`, description `text-zinc-500 text-sm leading-relaxed`, impact line `text-zinc-600 text-xs border-t border-zinc-800 pt-3 mt-3`

Deliverables (5 rows, `border-b border-zinc-800 py-6 flex gap-6`):
- Label: "What you get" · dot: green-500
- H2: "A reliability upgrade, delivered in one week."
- Description: "Every deliverable is concrete, documented, and tied to real traces from your production system."
```
1. "Full trace visibility across critical LLM workflows"
   "No more digging through logs to find a single failure."
2. "3–5 documented failure modes with evidence"
   "Know exactly where your system breaks and why."
3. "Guardrails deployed on critical paths"
   "Reduce repeat incidents without constant monitoring."
4. "Alerts configured for future reliability issues"
   "Catch regressions before customers report them."
5. "Incident replay showing how failure propagates"
   "See the exact path from trace to user impact."
```

Guarantee (bordered callout box, same style as operator note in pricing):
- Label: "Guarantee" · dot: green-500
- H2: "If we do not find meaningful issues, you do not pay."
- Body: "If we do not find at least 3 real issues or meaningful risks, you do not pay."

Pricing (2-col, same grid as tier cards):
- H2: "Typical engagement: $8k–$12k"
- Description: "Fixed-scope audit focused on immediate reliability outcomes, with documented findings, guardrails, and alerts."
- Left card: title "Standard engagement" · price "$8k–$12k" · "Includes full failure analysis, guardrail implementation, and incident replay."
- Right card (highlighted with `border-zinc-600`): title "Design partners" · badge `bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded` "Limited availability" · price "$5k" · "Same audit, same depth. Limited design partner slots available for teams willing to move quickly and provide tight feedback during rollout."

Final CTA strip:
- H2: "Book a 20-minute call to scope the audit."
- Description: "We'll confirm fit, scope the audit, and map the fastest path to a 7-day engagement."
- CTA primary: "Check design partner availability" → `/demo`

- [ ] **Step 1: Create the audit page** with all sections above using pulse design conventions.

- [ ] **Step 2: Lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Step 3: Build**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse build
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add "apps/pulse/app/(marketing)/ai-reliability-audit/page.tsx"
  git commit -m "feat(pulse): create audit page — fixes broken hero CTA link"
  ```

---

## Task 11: Final Verification

- [ ] **Full lint**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse lint
  ```

- [ ] **Full build**
  ```bash
  cd /Users/robert/Documents/Reliai && pnpm --filter pulse build
  ```
  Expected: exit 0.

- [ ] **Dev server spot-check**
  ```bash
  pnpm --filter pulse dev
  ```
  Verify: `/` · `/pricing` · `/docs` · `/ai-reliability-audit` all load, dark zinc styling consistent, navbar links work.

- [ ] **Open PR**
  Use `commit-commands:commit-push-pr` skill.

---

## Task Summary

| # | Type | File | What |
|---|---|---|---|
| 1 | Migrate | `hero-3d-stage.tsx` | Description + AREI badge |
| 2 | Migrate + extend | `feature-cards-section.tsx` | Heading, card titles, add descriptions |
| 3 | Migrate + new content | `ai-section.tsx` | AREI label/heading/description + factor grid |
| 4 | New component | `use-case-section.tsx` + `hero-3d-stage.tsx` | Use case section in pulse style |
| 5 | Migrate | `cta-section.tsx` | Heading + description |
| 6 | Migrate | `product-direction-section.tsx` | Bottom-left heading |
| 7 | Migrate | `navbar.tsx` | Nav links |
| 8 | New page | `pricing/page.tsx` | Full pricing page in pulse style |
| 9 | New page | `docs/page.tsx` | Full docs page in pulse style |
| 10 | New page | `ai-reliability-audit/page.tsx` | Full audit page — fixes broken link |
| 11 | Verify | all | Lint + build + spot-check |
