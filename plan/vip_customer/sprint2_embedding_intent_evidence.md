# Sprint 2A — Embedding-Based Intent Classification & Evidence Retrieval

> **Thuộc về:** [rag_pipeline_optimization.md](./rag_pipeline_optimization.md) — Optimization #3 (Intent-Driven Tiered Prompting)
>
> **Điều kiện tiên quyết:** Sprint 1 phải hoàn thành trước
> - [x] `#1` Client Timeout + Giảm Retry
> - [x] `#2` Sắp xếp lại Provider
> - [x] `#4` Prompt Deduplication
>
> **Tác động:** Giảm 1–3s/request (TTFT + decoding) + xử lý bài toán Intent Shift
>
> **Bối cảnh quyết định:** Intent detection bằng embedding được chọn thay vì gọi thêm 1 lần LLM vì:
> - 0 latency overhead (rule) hoặc ~80ms (embedding) vs 300ms–1.5s (LLM classifier)
> - Chi phí gần 0 ($0.000004/request embedding vs $0.02–0.05/request LLM)
> - Tham khảo gợi ý từ [perplexity_suggestion.md](./perplexity_suggestion.md) mục "Intent-based filtering before retrieval"

---

## Phạm vi Phase này

### ✅ TRONG phạm vi (làm ngay)

| # | Thay đổi | Mục đích |
|:--|:---------|:---------|
| 1 | Schema migration: thêm vector columns | Lưu trữ centroid & evidence embeddings |
| 2 | `embeddingClient.ts` | Wrapper gọi OpenAI embedding API + cosine similarity |
| 3 | `intentClassifier.ts` | Rule-based + embedding fallback detect intent per-turn |
| 4 | Seed scripts | Tính centroid vectors cho 8 intents + backfill evidence vectors |
| 5 | Sửa `customerService.ts` | Top-K evidence retrieval thay vì load all |
| 6 | Sửa `contextBuilder.ts` | Tích hợp classifier + relevant evidence vào pipeline |

### ❌ NGOÀI phạm vi (phases sau)

| Tính năng | Thuộc Sprint | Lý do hoãn |
|:----------|:-------------|:-----------|
| Tiered Prompt Templates (Simple/Standard/Complex) | Sprint 2B | Cần intent classifier hoạt động ổn trước |
| Structured Output / JSON Schema (#5) | Sprint 2B | Không phụ thuộc, có thể làm song song |
| Semantic Response Caching | Sprint 4 | Cần Redis, phức tạp cao |
| Topic Drift Detection (đo `cosine_sim` giữa 2 window tin nhắn) | Sprint 3+ | Cần data production để tune threshold |

---

## Quyết định thiết kế đã xác nhận

- **Q1 — Update DB khi intent shift?** → **Không.** Chỉ override in-memory cho lần generate đó. Không ghi ngược vào `conversation.intentId` để tránh corrupt dữ liệu seed/audit.
- **Q2 — Số intent hiện tại?** → **8 intents** trong `intent_catalog`: `delivery_status`, `refund_request`, `product_info`, `complaint`, `voucher`, `cancellation`, `order_modification`, `general`.

---

## Lựa chọn Embedding Provider

### Khuyến nghị: OpenAI `text-embedding-3-small`

| Tiêu chí | Giá trị |
|:---------|:--------|
| **Model** | `text-embedding-3-small` |
| **Dimensions** | 1536 |
| **Latency** | ~80ms |
| **Price** | $0.020 / 1M tokens |
| **Chi phí/request thực tế** | ~$0.000004 (200 tokens) |
| **Tiếng Việt** | ✅ Hỗ trợ tốt |

**Lý do chọn OpenAI thay vì Gemini:**
1. Đã có `OPENAI_API_KEY` trong [`llmUtils.ts`](../../src/utils/rag/llmUtils.ts) L17
2. Đã có `openai` npm package → zero new dependencies
3. Embedding API call ổn định hơn (không qua proxy OpenCode)

---

## Kiến trúc tổng quan

```
generateGroundedResponse(conversationId)
    │
    ├── buildFullContext()
    │     │
    │     ├── buildTurnContext()
    │     │     └── [AS-IS] Load conversation + messages + linkedOrder từ DB
    │     │
    │     ├── [MỚI] classifyTurnIntent(recentMessages, currentIntentId)
    │     │     ├── Step 1: Rule-based match (regex tiếng Việt) → ~0ms
    │     │     ├── Step 2: Embed last 3 buyer msgs → cosine_sim vs centroids → ~80ms
    │     │     └── Step 3: Fallback → giữ intent cũ từ DB
    │     │     └── Override turn.detectedIntent in-memory nếu intent đổi
    │     │
    │     ├── buildCustomerDossier()
    │     │     └── [AS-IS] Load customer profile + history
    │     │
    │     └── [ĐÃ SỬA] buildEvidenceContext(customerId, queryText)
    │           └── getRelevantEvidences() → embed(queryText), cosine_sim vs factVectors
    │           └── Trả top-5 thay vì all → giảm ~750 tokens
    │
    ├── buildSystemPrompt(context, strategies)
    │     └── [AS-IS] Nhưng nhận intent đúng hơn → nạp đúng policies
    │
    └── generateResponse() → LLM call
```

---

## Proposed Changes

### 1. Database Migration

#### [MODIFY] [`schema.prisma`](../../src/model/schema.prisma)

Thêm vector columns vào 2 tables:

**`IntentCatalog`** — lưu centroid embedding:

```diff
 model IntentCatalog {
   id          Int      @id @default(autoincrement())
   code        String   @unique
   name        String
   description String?  @db.Text
+
+  // Pre-computed centroid embedding vector (JSON array of floats)
+  centroidVector    Json?     @db.LongText  // float[1536] — text-embedding-3-small
+  centroidUpdatedAt DateTime?               // khi nào vector được tính lại
+  sampleCount       Int       @default(0)   // số lượng mẫu dùng để tính centroid
+
   isActive    Boolean  @default(true)
   createdAt   DateTime @default(now())
   updatedAt   DateTime @default(now()) @updatedAt
```

**`CustomerEvidence`** — lưu embedding của từng fact:

```diff
 model CustomerEvidence {
   id           Int      @id @default(autoincrement())
   customerId   Int
   customer     Customer @relation(fields: [customerId], references: [id])
   fact         String   @db.Text
   evidence     String   @db.Text
   confidence   Float
   lastObserved DateTime
+
+  // Pre-computed embedding vector of fact text
+  factVector   Json?    @db.LongText  // float[1536]
+
   isActive     Boolean  @default(true)
```

> **Tại sao MySQL `Json` thay vì pgvector?** Hệ thống dùng MySQL (schema.prisma L17). Số lượng intent (8) và evidence/customer (~20–50) đủ nhỏ để cosine similarity tính trong Node.js application layer mà không cần DB-level vector search.

---

### 2. New Files

#### [NEW] `src/lib/embeddingClient.ts`

Wrapper singleton cho OpenAI embedding API + utility functions.

**Chức năng:**
- `embedText(text)` → gọi OpenAI `text-embedding-3-small`, trả về `number[1536]`
- In-memory LRU cache (500 entries, TTL 5 phút) tránh gọi lại API cho text đã embed
- `cosineSimilarity(a, b)` → tính cosine sim giữa 2 vectors
- `findBestMatch(queryVector, candidates, threshold)` → tìm candidate gần nhất

**Dependencies:** Chỉ dùng `openai` package đã có sẵn.

---

#### [NEW] `src/services/rag/intentClassifier.ts`

Core logic phân loại intent per-turn.

**Strategy 3 tầng:**

| Tầng | Method | Latency | Khi nào dùng |
|:-----|:-------|:--------|:-------------|
| 1 | **Rule-based** (regex tiếng Việt) | ~0ms | ~70% cases — từ khóa rõ ràng |
| 2 | **Embedding cosine sim** vs centroids | ~80ms | ~20% cases — câu phức tạp/paraphrase |
| 3 | **Fallback** | 0ms | ~10% cases — giữ nguyên intent cũ từ DB |

**Intent rules (8 intents):**

| Intent Code | Ví dụ từ khóa tiếng Việt | Priority |
|:------------|:-------------------------|:---------|
| `complaint` | tức, bực, khiếu nại, lừa đảo | 10 (cao nhất) |
| `refund_request` | hoàn tiền, refund, trả hàng | 9 |
| `cancellation` | hủy đơn, cancel, không mua nữa | 9 |
| `delivery_status` | giao hàng, shipper, tracking | 7 |
| `product_info` | còn hàng, size, màu gì, giá bao nhiêu | 6 |
| `voucher` | mã giảm, coupon, khuyến mãi | 5 |
| `order_modification` | đổi địa chỉ, sửa đơn, đổi size | 5 |
| `general` | cảm ơn, xin chào (fallback) | 1 |

**Exports:** `classifyTurnIntent(recentMessages, currentIntentId) → IntentClassification | null`

**Caching:** Intent centroids được cache in-memory 30 phút, tránh query DB mỗi request.

---

#### [NEW] `src/scripts/seedIntentCentroids.ts`

Script chạy 1 lần (hoặc định kỳ) để tính centroid vector cho 8 intents.

**Cách hoạt động:**
1. Mỗi intent có 5–10 câu mẫu tiếng Việt thực tế (hardcoded trong script)
2. Embed tất cả mẫu qua OpenAI → thu được `N` vectors per intent
3. Tính centroid = mean(vectors) → 1 vector đại diện per intent
4. Upsert vào `IntentCatalog.centroidVector`

**Chạy bằng:** `npx tsx src/scripts/seedIntentCentroids.ts`

**Ước tính:** 8 intents × ~8 samples × ~50 tokens = ~3,200 tokens ≈ **$0.00006** (gần free).

---

#### [NEW] `src/scripts/seedEvidenceVectors.ts`

Script backfill embedding cho tất cả `CustomerEvidence.fact` chưa có vector.

**Cách hoạt động:**
1. Query tất cả records có `factVector IS NULL`
2. Embed từng `fact` text qua OpenAI
3. Update `factVector` vào DB
4. Chạy theo batch (50/lượt) để tránh rate limit

**Chạy bằng:** `npx tsx src/scripts/seedEvidenceVectors.ts`

---

### 3. Modified Files

#### [MODIFY] `src/services/customerService.ts`

**Thêm hàm:** `getRelevantEvidences(customerId, queryText, topK, minConfidence)`

**Logic:**
1. Load tất cả evidence của customer (bao gồm `factVector`)
2. Embed `queryText` (tin nhắn gần nhất của buyer)
3. Tính cosine similarity giữa query vector và mỗi `factVector`
4. Sort theo similarity, trả top-K (mặc định 5)
5. Fallback: nếu chưa có vector nào → trả theo `lastObserved` DESC (behavior cũ)

**Hàm cũ `getCustomerEvidences()` giữ nguyên** — không break code nào đang dùng nó.

---

#### [MODIFY] `src/services/rag/contextBuilder.ts`

**Thay đổi trong `buildFullContext()`:**

1. **Sau khi** `buildTurnContext()` trả về `turn`:
   - Lấy tin nhắn cuối của buyer → `queryText`
   - Gọi `classifyTurnIntent(turn.recentMessages, conversation.intentId)`
   - Nếu intent mới khác intent cũ **và** confidence ≥ 0.75 → override `turn.detectedIntent` in-memory
   - Log: `[IntentClassifier] Intent shifted: delivery_status → product_info (method: rule, score: 0.950)`

2. **`buildEvidenceContext()`** nhận thêm param `queryText`:
   - Gọi `getRelevantEvidences(customerId, queryText, 5)` thay vì `getCustomerEvidences(customerId)`

**Không thay đổi:** `buildCustomerDossier()`, `buildTurnContext()` nội bộ, API response shape.

---

## Verification Plan

### Step 1: Migration

```bash
npx prisma migrate dev --name add_embedding_vectors
```

Kiểm tra SQL:
```sql
DESCRIBE intent_catalog;
-- Expected: centroidVector LONGTEXT, centroidUpdatedAt DATETIME, sampleCount INT

DESCRIBE customer_evidence;
-- Expected: factVector LONGTEXT
```

### Step 2: Seed Centroids

```bash
npx tsx src/scripts/seedIntentCentroids.ts
```

```sql
SELECT code, sampleCount, centroidUpdatedAt,
       JSON_LENGTH(centroidVector) AS dims
FROM intent_catalog WHERE centroidVector IS NOT NULL;
-- Expected: 8 rows, dims = 1536
```

### Step 3: Seed Evidence Vectors

```bash
npx tsx src/scripts/seedEvidenceVectors.ts
```

```sql
SELECT COUNT(*) AS total,
       SUM(factVector IS NOT NULL) AS embedded
FROM customer_evidence WHERE isActive = 1;
-- Expected: total = embedded
```

### Step 4: Unit Test — Intent Classification

```
Input:  conversation.intentId = delivery_status
        lastBuyerMessage = "Shop có bán tai nghe Sony WH-1000XM5 không?"

Expected: classifyTurnIntent() → { intentCode: 'product_info', method: 'rule', confidence: 0.95 }
Expected log: "[IntentClassifier] Intent shifted: delivery_status → product_info"
```

### Step 5: Integration Test — Full Pipeline

```
Gọi POST /api/rag/generate với conversationId có intent cũ = delivery_status
nhưng tin nhắn cuối = "Giá tai nghe này bao nhiêu?"

Verify:
1. Log có dòng Intent shifted
2. Policies nạp vào prompt là product-related (không phải delivery policies)
3. Response vẫn trả về MultiDraftResponse format đúng
4. Evidence facts trong prompt chỉ có 5 (không phải all)
```

---

## Effort ước tính

| Task | Effort | Phụ thuộc |
|:-----|:-------|:----------|
| Schema migration | 30 phút | — |
| `embeddingClient.ts` | 30 phút | `OPENAI_API_KEY` |
| `intentClassifier.ts` | 1 giờ | embeddingClient |
| `seedIntentCentroids.ts` | 45 phút | embeddingClient |
| `seedEvidenceVectors.ts` | 30 phút | embeddingClient |
| Sửa `customerService.ts` | 20 phút | embeddingClient |
| Sửa `contextBuilder.ts` | 45 phút | intentClassifier + customerService |
| Test & tune threshold | 1 giờ | Tất cả |
| **Tổng Sprint 2A** | **~5 giờ** | |

---

## Tuning Notes (post-deploy)

| Parameter | Giá trị ban đầu | Cách tune |
|:----------|:----------------|:----------|
| `EMBEDDING_CONFIDENCE_THRESHOLD` | 0.72 | Monitor log, đếm false positive/negative. Tăng nếu quá nhiều FP, giảm nếu bỏ sót shift thực. |
| `MIN_MESSAGES_FOR_EMBEDDING` | 1 | Có thể tăng lên 2 nếu single-message context quá ngắn gây noise. |
| Rule priority ordering | complaint(10) > refund(9) > ... | Điều chỉnh nếu rule match sai khi câu chứa nhiều keyword cùng lúc. |
| Evidence `topK` | 5 | Tăng lên 7–8 nếu LLM thiếu context, giảm xuống 3 nếu prompt vẫn quá dài. |
| Centroid cache TTL | 30 phút | Giảm xuống 5 phút nếu thêm/sửa intent samples thường xuyên. |

---

## Mối liên hệ với các Sprint khác

```
Sprint 1 (đã xong / ưu tiên làm trước)
├── #1  Client Timeout + Giảm Retry         ← phải xong trước Sprint 2
├── #2  Sắp xếp lại Provider                ← phải xong trước Sprint 2
└── #4  Prompt Deduplication                 ← phải xong trước Sprint 2

Sprint 2A (kế hoạch này)
├── Intent Classification (embedding)        ← tài liệu này
└── Evidence Retrieval (embedding)           ← tài liệu này

Sprint 2B (sau Sprint 2A)
├── Tiered Prompt Templates                  ← dùng intent từ 2A để chọn template
│     Simple:   product_info, general → ~600 tokens
│     Standard: delivery, voucher → ~1,500 tokens
│     Complex:  complaint, refund → ~3,200 tokens
└── #5  Structured Output / JSON Schema      ← có thể làm song song với 2A

Sprint 3+
├── #6  Prompt Caching
├── #8  Speculative Provider Racing
└── Topic Drift Detection                    ← tái sử dụng embeddingClient từ 2A

Sprint 4
├── #9  Semantic Response Caching            ← tái sử dụng embeddingClient từ 2A
└── #10 Background Pre-generation
```
