# Architecture & Rules Adaptation Plan

> **Objective:** Define the streamlined Next.js + TypeScript architecture for the VIP Customer Care & Routing platform, adapting the engineering rules to keep high-value architectural guardrails while stripping enterprise bloat.

---

## 1. Approved Technology Stack & Directory Conventions

| Layer | Technology | Location | Role & Notes |
| :--- | :--- | :--- | :--- |
| **Framework** | **Next.js (App Router) + TS** | `src/app/` | React Server Components & Client Components. |
| **Data Mutations** | **Server Actions (`'use server'`)** | `src/actions/` | Standard CRUD, approvals, status updates, settings. |
| **AI / Integrations** | **API Routes (`app/api/...`)** | `src/app/api/` | Streaming responses, RAG generation, Lazada IM webhooks. |
| **Business Logic & RAG** | **Services & RAG Engine** | `src/services/` (with `src/services/rag/`) | Pure business logic, 3-layer memory context, Prisma queries. |
| **Forms & Validation** | **React Hook Form + Zod** | `src/forms/` | Dedicated Zod schemas and validation types. |
| **Types & Contracts** | **Modular TypeScript Types** | `src/types/` | Domain-separated type definition files. |
| **Global UI State** | **Jotai** | `src/atoms/` | Atomic, lightweight client state (active session, copilot drafts). **No Redux.** |
| **Styling** | **Tailwind CSS + `cn()`** | `src/components/`, `src/app/` | Curated dark mode, responsive 3-column layout. |
| **ORM & Database** | **Prisma ORM + MySQL** | `seed/schema.prisma`, `src/lib/prisma.ts` | 16 tables, dedicated status tracking, 3-layer memory. |
| **Research & Thesis Docs**| **Academic & Feasibility** | `research/`, `ideas/`, `plan/` | Academic benchmarking, datasets, and architecture plans. |

---

## 2. Comprehensive Rule Audit: What to Keep, Ignore, or Modify

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                               RULE AUDIT MATRIX                                   │
├─────────────────────────┬──────────┬──────────────────────────────────────────────┤
│ Rule Category           │ Status   │ Action & Rationale                           │
├─────────────────────────┼──────────┼──────────────────────────────────────────────┤
│ 1. Layered Architecture │ ✅ KEEP  │ Component → Hook → Action/Route → Service →DB│
│ 2. Actions vs Services  │ ✅ KEEP  │ Services do DB/Prisma; Actions orchestrate   │
│ 3. RAG in Services      │ 🌟 REORG │ `rag` is a sub-module inside `src/services/` │
│ 4. Form Schemas Folder  │ 🌟 REORG │ Zod schemas in dedicated `src/forms/` folder │
│ 5. Modular Types Folder │ 🌟 REORG │ Separate files in `src/types/` per domain    │
│ 6. Universal Agent MD   │ 🌟 REORG │ All rules/skills in standard `.md` format    │
│ 7. State Management     │ ✅ KEEP  │ Jotai for UI atoms; No Redux                 │
│ 8. Separate AI Routes   │ 🔄 MODIFY│ Use API Routes for AI/RAG/Webhooks           │
│ 9. TypeScript Standards │ ✅ KEEP  │ `type` over `interface`, `unknown` over `any`│
│ 10. Tailwind + cn()     │ ✅ KEEP  │ No inline styles; use utility classes + cn() │
│ 11. Grounding Guardrails│ 🌟 ADD   │ Fact citation & anti-hallucination checks    │
│ 12. File-based QA       │ ✅ KEEP  │ QA/QA-<topic>.md when specs are ambiguous    │
│ 13. Strapi/Media Sync   │ ❌ IGNORE│ Strip TMS File Service / Strapi morph logic  │
│ 14. Multi-Tenant withOrg│ ❌ IGNORE│ Single-store/seller scope; simplify auth     │
│ 15. Dogmatic Ponytail   │ 🔄 MODIFY│ Keep pragmatic YAGNI, remove anti-patterns   │
└─────────────────────────┴──────────┴──────────────────────────────────────────────┘
```

---

## 3. Strict Layered Data Flow

```
[ UI / React Components (src/components/) ]
                    ↓
[ Custom Hooks & SWR (src/hooks/) ]   +   [ Jotai Atoms (src/atoms/) ]
                    ↓
[ Server Actions (src/actions/) ]     /   [ API Routes (src/app/api/) ]
                    ↓
[ Services & RAG Engine (src/services/, src/services/rag/) ]
                    ↓
[ Prisma Client Singleton (src/lib/prisma.ts) ]
                    ↓
[ MySQL Database ]
```

---

## 4. Complete Project Directory Structure

```
ecommerce_integrate/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # Dedicated API Routes
│   │   │   ├── rag/
│   │   │   │   └── generate/route.ts # AI RAG Generation & Grounding API
│   │   │   └── webhooks/
│   │   │       └── lazada/route.ts   # Lazada IM & Order Webhooks
│   │   ├── layout.tsx                # Root layout (Theme, Fonts, Jotai Provider)
│   │   ├── page.tsx                  # Main 3-Column Co-Pilot Dashboard
│   │   └── globals.css               # Tailwind CSS tokens
│   ├── actions/                      # Server Actions ('use server')
│   │   ├── conversationActions.ts    # Approve, edit, send message, change status
│   │   └── customerActions.ts        # Override tier, update evidence
│   ├── services/                     # Business Logic Layer (Prisma access)
│   │   ├── conversationService.ts    # Conversation & message DB operations
│   │   ├── customerService.ts        # Customer dossier & RFM aggregation
│   │   ├── orderService.ts           # Order & tracking operations
│   │   └── rag/                      # RAG Intelligence Sub-Module
│   │       ├── contextBuilder.ts     # 3-Layer Memory assembly (DB queries)
│   │       ├── policyStore.ts        # E-commerce store policy rules
│   │       ├── promptTemplates.ts    # VIP-aware system prompt builder
│   │       ├── llmService.ts         # OpenAI / Gemini API client
│   │       └── groundingValidator.ts # Fact extraction & verification engine
│   ├── forms/                        # Dedicated Zod Schemas for Forms
│   │   ├── messageForm.ts            # Message input schema & validation
│   │   ├── copilotForm.ts            # Copilot approval / override schema
│   │   └── customerFilterForm.ts     # Inbox search & filter schema
│   ├── types/                        # Modular Type Definitions
│   │   ├── customer.ts               # Customer & VIP tier types
│   │   ├── order.ts                  # Order, item, & status types
│   │   ├── conversation.ts           # Conversation, message, & routing types
│   │   ├── rag.ts                    # 3-layer context, evidence, grounding types
│   │   └── index.ts                  # Barrel export
│   ├── components/                   # React UI Components
│   │   ├── inbox/                    # Column 1: Conversation List & Filter
│   │   │   ├── ConversationInbox.tsx
│   │   │   └── ConversationItem.tsx
│   │   ├── chat/                     # Column 2: Live Message Thread
│   │   │   ├── ChatThread.tsx
│   │   │   └── MessageBubble.tsx
│   │   └── copilot/                  # Column 3: Dossier & AI Response Draft
│   │       ├── CopilotPanel.tsx
│   │       ├── CustomerDossier.tsx
│   │       └── ResponseDraftCard.tsx
│   ├── hooks/                        # SWR & Custom React Hooks
│   │   ├── useConversations.ts       # SWR hook for real-time inbox
│   │   └── useCopilotDraft.ts        # Hook for generating/updating AI draft
│   ├── atoms/                        # Jotai Atoms
│   │   └── conversationAtom.ts       # activeConversationId, filterState, etc.
│   └── lib/                          # Shared Utilities
│       ├── prisma.ts                 # PrismaClient singleton instance
│       └── utils.ts                  # cn() helper (clsx + twMerge)
├── research/                         # Academic Research, Benchmarks, & Notes
│   ├── datasets.md                   # UCI Online Retail II & Instacart documentation
│   └── literature_review.md          # Multi-agent routing & customer care references
├── ideas/                            # Raw Thesis Explorations & Brainstorms
│   └── vip_customer/                 # VIP routing specific explorations
├── plan/                             # Phased Implementation Roadmaps
│   └── vip_customer/                 # VIP Customer Routing detailed plans
├── seed/                             # Database Seeding & Schema
│   ├── schema.prisma                 # MySQL Prisma Schema
│   ├── data_generator.js             # Synthetic data generator
│   └── seed.js                       # Seeder script
├── test/                             # Unit & Integration Tests
└── .agent/                           # Standard Markdown AI Rules & Skills
    ├── rules/
    │   ├── RULE.md                   # Universal Master Project Rules
    │   └── ponytail.md               # Pragmatic Senior Dev Guide
    └── skills/                       # Universal Agent Skills (SKILL.md)
        ├── business-logic/SKILL.md   # Domain rules, VIP tiers, 3-layer memory
        ├── convention/SKILL.md       # Next.js, Actions, Services, RHF conventions
        ├── implement-qa/SKILL.md     # QA workflow (QA/QA-<topic>.md)
        └── checklist/SKILL.md        # Pre-commit & grounding verification
```
