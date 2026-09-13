---
name: i18n-check
description: >
  Master internationalization (i18n) verification and development skill for Next.js (next-intl). Enforces zero hardcoded user-facing strings, validates 100% dictionary key parity between vi.json and en.json, prevents language contamination, and verifies Next-Intl conventions across all new and existing features. Load whenever creating or modifying user-facing UI, text, templates, or messages.
---

# Internationalization (i18n) Development & Verification Skill

This skill enforces internationalization discipline for the OmniCart project using `next-intl`. 
**Core Rule:** From now on, whenever creating, refactoring, or reviewing any user-facing feature or UI component, **ALL display text, buttons, placeholders, titles, labels, error messages, and option lists MUST use i18n keys**. Hardcoded strings in TSX/JSX are strictly forbidden.

---

## 1. Golden Rules of i18n in OmniCart

| # | Rule | Detail |
| :- | :--- | :--- |
| **1** | **Zero Hardcoded Strings** | No raw text strings in TSX/JSX (`button`, `span`, `p`, `h1-h6`, `label`, `placeholder`, `aria-label`, `title`). |
| **2** | **100% Key Parity** | Every translation key added to `src/messages/vi.json` **MUST** simultaneously exist at the exact same path in `src/messages/en.json` (and vice-versa). |
| **3** | **Language Purity** | `vi.json` contains only Vietnamese; `en.json` contains only English. Never leave untranslated English text in `vi.json` or Vietnamese in `en.json`. |
| **4** | **Localized Navigation** | Always import `Link`, `useRouter`, `usePathname` from `@/i18n/navigation`. Never import from `next/link` or `next/navigation`. |
| **5** | **No Logic Refactoring** | When localizing an existing component, perform **only surgical text replacements**. Do NOT alter component state, hooks, or event flow. |
| **6** | **Scope Boundary** | Operational merchant screens and shared components (`src/components/`, `src/app/[locale]/`) must be 100% localized. Internal `/dev/**` playground routes are excluded. |

---

## 2. Next-Intl Standard Patterns

### A. Client Components (`'use client'`)
```tsx
'use client';

import { useTranslations } from 'next-intl';

export function OrderActionButton({ orderCode }: { readonly orderCode: string }) {
  const t = useTranslations('orders.table');

  return (
    <button
      type="button"
      aria-label={t('openOrder', { code: orderCode })}
      title={t('quickEdit')}
    >
      {t('edit')}
    </button>
  );
}
```

### B. Accessing Arrays or Lists (`t.raw`)
For select dropdowns, tab options, or calendar day/month arrays:
```tsx
const t = useTranslations('common.dateTimePicker');
const daysOfWeek = t.raw('daysOfWeek') as readonly string[];
const monthNames = t.raw('months') as readonly string[];
```

### C. Server Components & Route Metadata
```tsx
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'orders' });

  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}
```

### D. Parameterized Interpolation (ICU Format)
Never concatenate translated strings with variables. Use ICU tokens `{var}`:
```json
// vi.json
"showingResults": "Hiển thị {from} – {to} trên tổng số {total} đơn hàng"

// en.json
"showingResults": "Showing {from} – {to} of {total} orders"
```
In component:
```tsx
t('showingResults', { from: 1, to: 20, total: 100 });
```

### E. Error Messages & Toasts
Do not write hardcoded toast messages in callbacks or actions:
```tsx
// ❌ INCORRECT:
toast.error('Có lỗi xảy ra khi lưu đơn hàng!');

// ✔ CORRECT:
const t = useTranslations('orders.form');
toast.error(t('saveError'));
```

---

## 3. Dictionary Organization (`src/messages/`)

Both `vi.json` and `en.json` share identical hierarchical namespaces:

```
src/messages/
├── vi.json   (Authoritative Vietnamese translations)
└── en.json   (Authoritative English translations - 100% key parity)
```

### Standard Namespaces
- `common`: Global shared terms (`common.status`, `common.actions`, `common.dateTimePicker`, `common.pagination`, `common.errors`)
- `nav`: Sidebar and top-navigation labels (`nav.orders`, `nav.customers`, `nav.integrations`, `nav.settings`)
- `orders`: Order management, tables, filters, forms, tabs, submodals
- `customers`: Customer dossier, RFM metrics, evidence, filters, tables
- `chat`: Inbox, customer context sidebar, AI copilot responses
- `integrations`: Platform connections, sync batch monitor, diff tables, drawers, Lazada pages
- `settings`: System settings, workspace preferences, channel credentials

---

## 4. Automated Quality Tooling (`check-i18n.js`)

The project includes an automated quality assurance tool inspired by `lingualdev/i18n-check`.

### Running the Check
```bash
# Full verification (parity, language purity, hardcoded text scanner, navigation audit)
yarn i18n:check

# Check only dictionary parity between vi.json and en.json
yarn i18n:check --only parity

# Scan a specific file during development
yarn i18n:check --file src/components/organisms/Order/OrderForm.tsx

# Scan a specific directory
yarn i18n:check --path src/components/organisms/Customer
```

### What `i18n:check` Validates:
1. **Bidirectional Missing Keys**: Checks for any key existing in `vi.json` but missing in `en.json` (or vice-versa).
2. **Type & Structural Integrity**: Flags if a key is a string in one locale but an object/array in another.
3. **ICU Variable Consistency**: Verifies that all `{variable}` tokens match across languages without missing or mistyped arguments.
4. **Language Contamination**: Ensures `en.json` contains no Vietnamese diacritics (aside from whitelisted native endonyms like `"Tiếng Việt"`).
5. **Codebase Hardcode Scanner**: Detects raw Vietnamese characters in UI code outside comments and flags unlocalized UI attributes (`placeholder`, `title`, `aria-label`).
6. **Navigation Import Auditor**: Enforces `Link` from `@/i18n/navigation` instead of `next/link`.

---

## 5. Feature Implementation Workflow

When building or updating a feature:

```
[ Step 1: Inventory UI Strings ]
Identify all labels, placeholders, errors, and button texts needed for the feature.
              ↓
[ Step 2: Update Both Dictionaries ]
Add keys to `src/messages/vi.json` (Vietnamese) and `src/messages/en.json` (English).
              ↓
[ Step 3: Implement UI with useTranslations ]
Use `t('...')` in JSX. Use `@/i18n/navigation` for links.
              ↓
[ Step 4: Run Verification ]
Execute: `yarn i18n:check --file <path-to-modified-file>`
              ↓
[ Step 5: Full Project Audit ]
Execute: `yarn i18n:check` before committing or declaring work complete.
```

---

## 6. Pre-Commit Checklist for i18n

Before declaring any feature complete:
- [ ] Are all visible texts, labels, and placeholders extracted to `useTranslations`?
- [ ] Do all newly introduced keys exist in both `src/messages/vi.json` and `src/messages/en.json`?
- [ ] Does `en.json` contain clean, natural English with zero language contamination?
- [ ] Are all links imported from `@/i18n/navigation` (no `next/link`)?
- [ ] Does `yarn i18n:check` pass with 0 errors?
