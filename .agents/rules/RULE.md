---
name: omnicart-vip-routing-rules
description: >
  OmniCart Platform — VIP Customer Care & Routing Sub-System: Project structure, Next.js + TypeScript layered architecture, Server Actions, Jotai, React Hook Form, and anti-hallucination RAG engineering rules.
alwaysApply: true
---

# OmniCart — VIP Customer Care & Routing Sub-System Rules

## 1. Project Context & Parent System

**OmniCart (OmniCart Recover)** is an omni-channel e-commerce integration and recovery platform connecting multiple marketplaces (Lazada, Shopee, TikTok Shop, Shopify).

The **VIP Customer Care & Routing Module** is a core intelligent sub-system within OmniCart. It focuses on:
- Identifying high-value / VIP buyers from pseudonymized marketplace order histories.
- Providing evidence-grounded AI Co-Pilot decision support (3-layer memory RAG).
- Routing incoming customer inquiries to specialized agents (Logistics, Refund, Product Info, Escalation).
- Evaluating a three-arm randomized experiment (Human Only, Co-Pilot, Autonomous AI) under marketplace data scarcity.

---

## 2. Canonical Project Directory Structure

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
└── .agents/                          # Universal Workspace Customization Root
    ├── rules/
    │   ├── RULE.md                   # Universal Master Project Rules & Structure
    │   └── ponytail.md               # Pragmatic Senior Dev Guide
    └── skills/                       # Universal Agent Skills (SKILL.md)
        ├── business-logic/SKILL.md   # Domain rules, VIP tiers, 3-layer memory
        ├── convention/SKILL.md       # Next.js, Actions, Services, RHF conventions
        ├── implement-qa/SKILL.md     # QA workflow (QA/QA-<topic>.md)
        └── checklist/SKILL.md        # Pre-commit & grounding verification
```

---

## 3. Approved Technology Stack

- **Framework**: Next.js (App Router) + TypeScript.
- **Mutations**: Server Actions (`'use server'`) in `src/actions/` for standard CRUD, status updates, and human approvals.
- **AI & Integrations**: Dedicated API Routes in `src/app/api/` for RAG generation, streaming LLM tokens, and marketplace webhooks.
- **Business Logic & RAG**: `src/services/` (with `src/services/rag/` sub-module). Pure business logic, 3-layer memory context, Prisma queries.
- **Forms & Validation**: React Hook Form (RHF) + Zod schemas in `src/forms/` (no Formik).
- **Types**: Modular domain types in `src/types/` (`customer.ts`, `order.ts`, `conversation.ts`, `rag.ts`, `index.ts`).
- **Global State**: Jotai atoms in `src/atoms/` for lightweight client UI state (no Redux).
- **Styling**: Tailwind CSS + `cn()` (`clsx` + `tailwind-merge`). No inline styles.
- **Database & ORM**: Prisma ORM + MySQL (`seed/schema.prisma`).
- **Layering**: `Component → Hook → Server Action / API Route → Service → Prisma DB`.

---

## 4. Layering & Architectural Guardrails

```
[ UI / React Components (src/components/) ]
                    ↓
[ Custom Hooks & SWR (src/hooks/) ]   +   [ Jotai Atoms (src/atoms/) ]
                    ↓
[ Server Actions (src/actions/) ]     /   [ Dedicated API Routes (src/app/api/) ]
                    ↓
[ Services & RAG Engine (src/services/, src/services/rag/) ]
                    ↓
[ Prisma Client Singleton (src/lib/prisma.ts) ]
                    ↓
[ MySQL Database ]
```

### Strict Rules:
1. **Server Actions (`src/actions/`)**:
   - Must use `'use server'`.
   - Handle input validation and return `{ success: boolean, data?: any, error?: string }`.
   - **Must NOT** call `prisma.*` directly (except `prisma.$transaction`).
   - Call underlying **Services** for business logic and data persistence.
2. **API Routes (`src/app/api/`)**:
   - Used for streaming AI responses (`/api/rag/generate`), webhooks (`/api/webhooks/lazada`), and external integrations.
3. **Services (`src/services/` & `src/services/rag/`)**:
   - Contain pure business logic, context assembly, and Prisma database access.
   - **Must NOT** call Actions.
4. **Hooks (`src/hooks/`)**:
   - Orchestrate SWR data fetching and local state.
   - **Must NOT** call Prisma or Services directly.

---

## 5. Grounding & Anti-Hallucination Guardrails

1. **Mandatory Fact Verification**: Any customer-specific claim (order status, tracking number, refund eligibility) generated by RAG must be verified against retrieved facts (Layer 1–3 memory).
2. **Privacy**: Do not de-anonymize marketplace buyers or reconstruct masked PII.
3. **When Requirements are Ambiguous**: Do not guess. Use the `implement-qa` skill to create/update `QA/QA-<topic>.md`.

---

## 6. Clean Code & Commenting Standards

1. **Descriptive Block Comments Recommended**: Adding comments above logical code blocks to explain domain purpose, business intent, safety policies, or non-obvious algorithms is strongly encouraged.
2. **Positional / Sequence Numbering Prohibited**: Never prefix comments with step numbers, sequence indices, or positional labels (e.g. `// 1. PII Checks`, `// 2. Policy Checks`, `// Step 1: ...`, `// Section: ...`).
3. **Comment "Why & Purpose", Not "Position" or "Trivial What"**: Focus comments on intent and domain logic rather than code location or restating what the syntax trivially does.


