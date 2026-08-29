---
name: design-system
description: Focused web design-token architecture and persisted design-system guidance. Use for primitive, semantic, and component tokens, Tailwind token integration, or maintained design-system documentation.
argument-hint: "[component or token]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---
# Design System

Use this skill for durable token and component-language decisions. It is not required for an ordinary feature that can reuse existing styles without creating or changing system-wide tokens.

## Start With Discovery

Before creating or changing system-wide tokens:

1. Follow `.agents/skills/ui-ux-pro-max/rules/style-discovery.md`.
2. Read the resolved `design-system/<project>/MASTER.md` and relevant page override before proposing new tokens.
3. Reuse the current primitive, semantic, and component layers unless the requested change is intentionally system-wide.

Do not persist a design system by default. Persist only when the user explicitly asks to establish/save one, approves a visual direction for reuse, or the task covers two or more pages or a product-wide visual language. State the project name and target path before the first persist. Do not use `--force` without explicit authorization.

## Token Model

```text
Primitive (raw values)
       -> Semantic (purpose aliases)
       -> Component (component-specific)
```

- Keep raw values in primitives.
- Use semantic aliases in pages and features.
- Use component tokens only for component-specific differences that cannot be expressed semantically.
- Document each newly introduced token's purpose and supported theme behavior.

## Focused References

| Need | Read |
|---|---|
| Token layers and naming | `references/token-architecture.md` |
| Primitive values | `references/primitive-tokens.md` |
| Semantic aliases/themes | `references/semantic-tokens.md` |
| Component-level tokens | `references/component-tokens.md` |
| Component state specifications | `references/states-and-variants.md` or `references/component-specs.md` |
| Tailwind integration | `references/tailwind-integration.md` |

## Optional Tools

```bash
node scripts/generate-tokens.cjs --config tokens.json -o tokens.css
node scripts/validate-tokens.cjs --dir src/
```

Use these only when the project actually adopts their input/output structure; do not generate parallel token files beside an established theme.

## Boundary

This skill owns primitive, semantic, and component tokens plus persisted `MASTER.md` and page overrides. UX behavior and accessibility outcomes belong to `.agents/skills/ui-ux-pro-max/rules/web-rules.md`; component implementation belongs to `ui-styling` and `styling`.
