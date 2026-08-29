# Style Discovery and Reuse

Use this workflow before creating or visually changing any user-facing web feature. The goal is to extend the product's existing visual language, not invent a new one per screen.

## Discovery Order

1. Find persisted design-system files:
   ```bash
   rg --files design-system -g "MASTER.md" -g "pages/*.md"
   ```
2. If one project directory matches the repository, read its `MASTER.md`.
3. Read the matching page override at `design-system/<project>/pages/<page>.md` when it exists. Page rules override Master only for that page.
4. Inspect `src/app/globals.css`, the root layout/theme provider, shared UI primitives, and the nearest existing route/component with the same job.
5. Reuse existing tokens, typography, spacing, surfaces, component variants, icon family, and interaction patterns before adding anything new.

## No Persisted Master

If no `MASTER.md` exists, treat the repository implementation as the current source of truth. Inspect at least:

- `src/app/globals.css` or equivalent theme file
- shared components under `src/components`, `components`, or `src/ui`
- the nearest existing page/feature
- package/config files that define the UI stack

Do not create a new design system just because a Master file is absent. Establish one only under the persist triggers in `ui-ux-pro-max/SKILL.md` and `design-system/SKILL.md`.

## Search Heuristics for Nearest Feature

When inspecting the repository for the nearest existing feature/component, use these 4 heuristics:

1. **Route / Page Domain:** Look for routes in the same group (e.g., `src/app/(shop)/products`, `src/app/(admin)/...`).
2. **Component Role Patterns:** Search for existing components with the same structural role:
   - Data & Tables: `*Table*`, `*DataTable*`, `*List*` under `src/components/`
   - Inputs & Overlays: `*Filter*`, `*Modal*`, `*Dialog*`, `*Drawer*`, `*Form*`
   - Cards & Grid: `*Card*`, `*Grid*`
3. **Business Keyword Search:** Run `rg "<keyword>" src/components/` to find components solving similar business UX.
4. **Global Baseline Fallback:** If no comparable feature exists, use `src/app/globals.css` and shared primitives under `src/components/ui/` as the baseline.

## Explicit Style Decision

Before coding or in your implementation plan / response, record an explicit, verifiable style decision block:

```markdown
> 🎨 **Style Decision:**
> - **Reused:** [Existing page/component/token establishing the visual baseline]
> - **Extended:** [Existing pattern being adapted and why]
> - **New:** [Any genuinely new token/pattern and why reuse was insufficient — or "None (100% Reused)"]
```

A new page may have a page override, but it must not silently replace Master rules. Avoid one-off page-level colors, fonts, spacing scales, shadows, or interaction conventions.

## Ambiguous Repository State

- If there are multiple Master files, choose the one whose project slug/package name matches the repository; otherwise ask before choosing between them.
- If no close visual precedent exists, use the existing global theme and shared primitives as the baseline, then propose a system-level direction before persisting new tokens.
- If an existing feature intentionally has a different style, treat its local override or component API as the source of truth and do not copy accidental one-off values.
