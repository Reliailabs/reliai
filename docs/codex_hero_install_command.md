# Codex Task
## Add Install Command to Marketing Hero

Goal

Increase developer conversion by displaying the Reliai install command directly in the homepage hero.

This pattern is used by many successful developer platforms.

---

# LOCATION

`apps/web/app/(marketing)/page.tsx`

Inside the Hero section under the subheadline.

---

# IMPLEMENTATION

Add a compact install block.

Default command:

`pip install reliai`

Include copy button using existing `CopyButton` component.

Example layout:

Headline
Subheadline

Install command block

CTA buttons
Screenshot

---

# OPTIONAL

Add Python/Node toggle.

Python:
`pip install reliai`

Node:
`npm install reliai`

---

# CONSTRAINTS

Keep the block compact so it fits above the fold.

Reuse existing Tailwind styles.
