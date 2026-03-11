# Codex Task
## Implement Interactive Demo Flow + Marketing Conversion Improvements

Goal

Increase conversion of the Reliai marketing site by implementing the interactive demo pattern used by successful developer infrastructure companies.

Instead of forcing visitors into signup immediately, allow them to explore a guided product tour using real UI surfaces with demo data.

This demo should run entirely on the frontend using mock data.

Do not add backend dependencies.

---

# PART 1 — Fix Homepage CTA Structure

Update marketing homepage:

apps/web/app/(marketing)/page.tsx

Replace existing CTAs with:

Primary CTA:
View Demo

Secondary CTA:
Get Started

Header navigation:

Product
Docs
Demo
Pricing
Sign In
Get Started

CTA behavior:

View Demo → /demo
Get Started → /signup
Sign In → /login

This prevents sending first-time visitors directly to signup.

---

# PART 2 — Create Interactive Demo Route

Create route:

apps/web/app/(marketing)/demo/page.tsx

This route should render a fully functional demo environment using mock data.

The demo should simulate a real Reliai project.

Sections to include:

Control Panel
Incident
Trace Graph
Deployment Safety Gate

Use deterministic demo data.

---

# PART 3 — Demo Data

Create file:

apps/web/lib/demoData.ts

Example:

export const demoProject = {
  name: "AI Support Copilot",
  reliability_score: 92,
  active_incidents: 1,
  deployment_risk: "LOW",
  guardrail_compliance: 98
}

export const demoIncident = {
  title: "Hallucination spike detected",
  impact: "Responses referencing non-existent documentation",
  root_cause: "Prompt update deployed earlier today"
}

export const demoTrace = {
  slowest_span: "retrieval",
  token_heavy_span: "llm_call",
  guardrail_retries: 3
}

Ensure all demo pages load cleanly using this data.

---

# PART 4 — Guided Tour System

Implement lightweight guided tour component.

Create:

apps/web/components/demo/Tour.tsx

Functionality:

Step overlays that highlight UI elements.

Tour steps:

Step 1
Control panel overview

Step 2
Incident detection

Step 3
Trace execution graph

Step 4
Guardrail recommendation

Step 5
Deployment safety gate

Each step should highlight relevant UI section and show explanation text.

---

# PART 5 — Demo Navigation

Top bar:

Reliai Demo

Steps indicator:

1 System Health
2 Incident
3 Trace Graph
4 Mitigation
5 Deployment Safety

Allow users to click steps or advance.

---

# PART 6 — Screenshot Mode

Add screenshotMode flag to demo pages.

When enabled:

- hide navigation
- fixed layout width
- disable animation
- deterministic timestamps

Route:

/marketing/screenshot/control-panel

Used for marketing screenshots.

---

# PART 7 — Demo Entry Animation

When the demo loads:

Fade in the control panel.

Then automatically start the guided tour.

Add subtle UI highlight around key metrics:

Reliability Score
Active Incident
Recommended Guardrail

---

# PART 8 — Conversion Points

Add signup prompts inside the demo.

After step 3 show:

Want to try this on your own system?

Buttons:

Get Started
View Docs

---

# PART 9 — Demo Performance

Ensure demo loads instantly.

Constraints:

No backend calls
No auth
Static demo data
Fast first render

---

# PART 10 — Expected Result

Visitors arriving at:

/

can click:

View Demo

which opens a realistic Reliai environment and guided tour.

This should allow engineers to understand the product in under 2 minutes.

The demo must feel like a real system, not a slideshow.

---

# Constraints

Do not modify backend services.

Do not introduce database models.

Use existing components and mock data.
What This Implementation Will Do

You will now have:

1️⃣ Marketing homepage
/marketing
2️⃣ Interactive demo
/demo
3️⃣ Screenshot routes
/marketing/screenshot/*
4️⃣ Guided product tour

Which explains the product automatically.

Why This Is Powerful

Devtools convert when users can experience the product quickly.

Interactive demos outperform:

videos
static screenshots
docs

Because engineers can touch the UI immediately.

The Conversion Funnel After This

Your funnel becomes:

Homepage
↓
Interactive Demo
↓
Signup
↓
SDK Install

Which is the exact funnel used by successful developer platforms.
