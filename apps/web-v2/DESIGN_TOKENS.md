# web-v2 Design Tokens

Canonical design system for the web-v2 app, derived from the original April 8 2026 scaffold commit (`7d79f01`).

## Colors

### Dark Theme Base
- Page background: `zinc-950` (set on `<body>`)
- Card surface: `bg-zinc-900`
- Card border: `border-zinc-800`
- Elevated surface: `bg-zinc-950` (stat cards, table headers)
- Hover state: `hover:bg-zinc-800` or `hover:bg-zinc-800/40`

### Text Hierarchy
- Primary text: `text-zinc-100`
- Secondary text: `text-zinc-400`
- Muted text: `text-zinc-500`
- Subtle text: `text-zinc-600`
- Disabled text: `text-zinc-700`

### Severity / Risk Badges
- Critical: `bg-red-500/10 text-red-400 border-red-500/30`
- High: `bg-amber-500/10 text-amber-400 border-amber-500/30`
- Medium: `bg-yellow-500/10 text-yellow-400 border-yellow-500/30`
- Low: `bg-blue-500/10 text-blue-400 border-blue-500/30`
- Resolved / Stable: `bg-emerald-500/10 text-emerald-400 border-emerald-500/30`
- All severity badges use `border` with `/30` opacity

## Typography

### Global Base (in globals.css)
```css
@layer base {
  body { @apply text-sm text-zinc-400; }
  h1 { @apply text-2xl font-semibold text-zinc-100; }
  h2 { @apply text-xl font-semibold text-zinc-100; }
  h3 { @apply text-lg font-medium text-zinc-100; }
}
```

### Font Scale
| Element | Class | Notes |
|---------|-------|-------|
| PageHeader title | `text-[15px]` | List pages |
| SubPageHeader title | `text-2xl` | Detail pages |
| Section heading | `text-lg` | In cards |
| Section label | `text-[11px] uppercase tracking-widest` | Above section headings |
| Stat value | `text-lg` or `text-2xl` | Use `<Stat>` component |
| Body text | `text-sm` | Default |
| Small text | `text-xs` | Captions, metadata |

### Page Titles
- List pages (using `<PageHeader>`): `text-[15px] font-semibold text-zinc-50 tracking-tight`
- Detail/sub-pages (using `<SubPageHeader>`): `text-2xl font-semibold text-zinc-100`

### Section Headings
- Section label: `text-[11px] font-semibold text-zinc-500 uppercase tracking-widest`
- Column header: `text-[10px] font-semibold text-zinc-600 uppercase tracking-wider`

### Stat Values
- Large stats: `text-lg font-semibold text-zinc-100 tabular-nums` (dashboard pattern)
- In SubPageHeader stat cards: `text-2xl font-semibold text-zinc-100`

### Body Text
- Standard: `text-sm text-zinc-400`
- Secondary: `text-sm text-zinc-500`
- Tertiary: `text-xs text-zinc-600`

## Layout

### Page Wrappers
- List pages: `<div className="min-h-full">` wrapping `<PageHeader>` + content
- Detail pages: `<div className="min-h-full p-6 space-y-6">` wrapping `<SubPageHeader>` + content

### Cards
- Use `<Card>` component from `@/components/ui/card` which provides: `border border-zinc-800 bg-zinc-900 text-zinc-100 rounded-lg shadow-sm`
- Manual card pattern: `bg-zinc-900 border border-zinc-800 rounded-lg` (when Card component is impractical)
- Stat card: `rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4`

### Borders & Radius
- All content areas: `rounded-lg`
- Buttons: `rounded-lg` (standard) or `rounded-md` (compact)
- Badges: `rounded` or `rounded-full`
- Never use `rounded-xl`, `rounded-2xl`, `rounded-[22px]`, `rounded-[24px]`, `rounded-[28px]`, `rounded-[30px]`

### Spacing
- Page-level padding: `p-6`
- Section spacing: `space-y-6`
- Card padding: `p-5` or `p-6`
- Stat card padding: `px-5 py-4`

## Components

### Typography Components
- `<Stat variant="lg">` - Dashboard stats (`text-lg font-semibold tabular-nums`)
- `<Stat variant="xl">` - Detail page stats (`text-2xl font-semibold tabular-nums`)
- `<SectionHeading as="h2|h3">` - Section titles (`text-lg font-semibold`)
- `<SectionLabel>` - Section labels (`text-[11px] uppercase tracking-widest`)

### Back Navigation
- Sub-page back links: `inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors`
- Dense view back links (incident command, trace detail): `inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors`

### Empty States
- Centered icon + text: `flex flex-col items-center justify-center py-20 text-center` with `w-10 h-10 rounded-full bg-zinc-800` icon and `text-sm font-medium text-zinc-400` title

### Table Headers
- HTML tables: `bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-500`
- Custom column headers: `text-[10px] font-semibold text-zinc-600 uppercase tracking-wider`

### Tab Bars
- Use `<TabBar>` component from `@/components/ui/tab-bar`
- Active: `text-zinc-100 border-b-2 border-zinc-200`
- Inactive: `text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent`