# Master Design System — Mastercard UI for VIP Agent Workspace

## 1. Visual Theme & Atmosphere
Mastercard's design language is an editorial, high-trust, human-centric aesthetic built upon warm cream canvases (`#F3F0EE`), lifted cream surfaces (`#FCFBFA`), crisp white cards (`#FFFFFF`), authoritative Ink Black typography & CTAs (`#141413`), and precise Signal Orange accents (`#CF4500`).

- **Brand Personality**: Editorial Warmth, High Trust, Soft Atmospheric Depth, Precision.
- **Theme Baseline**: Warm Putty Cream Canvas (`#F3F0EE`), never harsh sterile white or stark cold dark.
- **Hero / Accent Color**:
  - **Ink Black (`#141413`)**: Primary CTAs, active badges, bold headlines.
  - **Signal Orange (`#CF4500`) & Light Signal Orange (`#F37338`)**: Active tab cues, status dots, urgent signals.
  - **Link Blue (`#3860BE`)**: Information, links, neutral guidance.
  - **Success Green (`#149e61` & `#026b3f`)**: Grounded validations, successful resolutions.
- **Corner Radius Hierarchy**:
  - Buttons & Badges: Stadium Pill (`rounded-full` / 20px - 9999px).
  - Cards & Small Panels: `16px` (`rounded-2xl`).
  - Large Containers & Modals: `20px` - `24px` (`rounded-3xl`).
- **Shadows**: Atmospheric Cushioning (`rgba(0, 0, 0, 0.04) 0px 4px 24px`).
- **Typography**: `Sofia Sans` (450 weight body copy, 500-600 headings with -1.5% to -2% letter-spacing).

---

## 2. Color Palette & Token Architecture

### Primitive Tokens
| Token | Hex / Value | Description |
| :--- | :--- | :--- |
| `color-canvas-cream` | `#F3F0EE` | Warm putty canvas background |
| `color-lifted-cream` | `#FCFBFA` | Raised surface for panels and sidebars |
| `color-surface-white` | `#FFFFFF` | Card surfaces, buyer chat bubbles, dropdowns |
| `color-ink-black` | `#141413` | High-contrast headline text & primary pill CTAs |
| `color-charcoal` | `#262627` | Secondary text |
| `color-slate-gray` | `#696969` | Muted captions, icons, subtitles |
| `color-dust-taupe` | `#D1CDC7` | Subdued borders & disabled elements |
| `color-border-subtle` | `#E5E0DA` | Crisp 1px container divider |
| `color-signal-orange` | `#CF4500` | Accent cue, alert, urgent tag |
| `color-light-orange` | `#F37338` | Active tab dot, warning highlight |
| `color-link-blue` | `#3860BE` | Info callouts, standard links |
| `color-green-success` | `#149e61` | Success accent |
| `color-green-dark` | `#026b3f` | Success text |

### Semantic Aliases
- `bg-background`: `#F3F0EE` (Canvas body)
- `bg-surface-panel`: `#FCFBFA` (Sidebars & lifted regions)
- `bg-surface-card`: `#FFFFFF` (White cards)
- `border-subtle`: `#E5E0DA`
- `text-primary`: `#141413`
- `text-muted`: `#696969`
- `text-subtle`: `#9497a9`
- `cta-primary`: `#141413` (Ink Black Pill)
- `accent-signal`: `#CF4500`

---

## 3. UI Proportion & Density Rules

1. **Header & Bar Heights**:
   - App Bar: `h-14` (56px), floating pill or soft border.
   - Section Headers: `min-h-14` (56px) with clean compact padding (`px-4`).
2. **Form Controls & Comboboxes**:
   - Filter Comboboxes: Compact height `h-8` (32px), pill shape (`rounded-full`), text `text-xs`, subtle border `#E5E0DA`.
   - Search Inputs: Height `h-9` (36px), `rounded-full`, padding `px-8 py-1.5`.
3. **AI Multi-Draft Co-Pilot Card**:
   - Must remain **Ultra-Compact** inside chat threads.
   - Max height capped, strategy selector as **Horizontal Segmented Pills** (`py-1 px-3`).
   - Grounding Annotation in collapsed single-line summary with expandable details.
4. **Badges**:
   - Pill style (`rounded-full`), `px-2.5 py-0.5`, with leading accent dot (`●`).
