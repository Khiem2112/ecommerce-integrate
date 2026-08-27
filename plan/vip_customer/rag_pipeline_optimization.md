# RAG Pipeline Optimization — Phân tích các phương pháp tối ưu tốc độ

> **Mục tiêu:** Giảm thời gian end-to-end của pipeline `generateGroundedResponse` từ **>160 giây** xuống **dưới 5 giây** cho trường hợp trung bình.
>
> **Baseline hiện tại (từ log 2026-08-22):**
> - System Prompt: ~13,700 chars (~3,500 tokens)
> - User Prompt: ~283 chars (~71 tokens)
> - LLM Output: ~1,000–1,500 tokens (2–3 strategy drafts)
> - Provider chain: opencode (deepseek-v4-pro) → gemini → openai → grok → deepseek → opencode (ox-alpha)
> - Max retries: 3 per provider, exponential backoff 1s/2s/4s
> - Client timeout: **không có** (mặc định SDK = 600s)

---

## Tổng quan so sánh

| # | Phương pháp | Thời gian tối ưu | Độ phức tạp | Rủi ro phá vỡ output |
|:--|:---|:---|:---|:---|
| 1 | Client Timeout + Giảm Retry | -120s → -150s | Thấp | Không |
| 2 | Sắp xếp lại thứ tự Provider | -5s → -30s | Thấp | Không |
| 3 | Intent-Driven Tiered Prompting | -1s → -3s (TTFT + decoding) | Trung bình | Thấp |
| 4 | Prompt Deduplication | -0.5s → -1.5s | Thấp | Thấp |
| 5 | Structured Output (JSON Schema) | -2s → -5s (bỏ retry do lỗi format) | Trung bình | Không |
| 6 | Prompt Caching (Provider-side) | -0.5s → -2s (prefill) | Trung bình | Không |
| 7 | Streaming SSE | 0s (latency thực không đổi, UX perceived = ~1s) | Trung bình–Cao | Không |
| 8 | Speculative Provider Racing | -3s → -6s | Trung bình | Không |
| 9 | Semantic Response Caching | -3s → -5s (cache hit = ~30ms) | Cao | Thấp |
| 10 | Background Pre-generation | ~0s perceived (draft có sẵn khi agent mở chat) | Cao | Không |

---

## Chi tiết từng phương pháp

Sắp xếp theo **thứ tự ưu tiên triển khai** (impact/effort ratio cao nhất trước).

---

### 1. Client Timeout cứng + Giảm Retry count

**Ưu tiên: 🔴 CRITICAL — Triển khai đầu tiên**

**Vấn đề hiện tại:**
- OpenAI SDK v7 có timeout mặc định **600 giây (10 phút)**. Khi provider bị nghẽn hoặc cold-start chậm, mỗi attempt treo 45–90 giây hoàn toàn im lặng.
- `MAX_RETRIES_PER_PROVIDER = 3` với exponential backoff (1s → 2s → 4s) nghĩa là một provider chết sẽ ngốn tối đa **3 × (timeout + backoff)** trước khi failover.
- Kết hợp cả hai: 1 provider chậm = **~180 giây bị lãng phí**.

**Giải pháp:**
- Đặt `timeout: 8_000` (8 giây) trên OpenAI client constructor.
- Đặt `httpOptions: { timeout: 8_000 }` trên GoogleGenAI constructor.
- Giảm `MAX_RETRIES_PER_PROVIDER` từ 3 xuống **1** (thử 1 lần, fail thì chuyển provider).
- Worst-case mới: 5 providers × 1 attempt × 8s timeout = **40 giây** (vs 160s+ hiện tại).

**Thời gian tối ưu:** Giảm **120–150 giây** trong worst-case scenario.

**Độ phức tạp:** Thấp — sửa 3 dòng config trong [`llmUtils.ts`](../src/utils/rag/llmUtils.ts).

**Tool / Thư viện:** Có sẵn trong `openai` SDK v7 (`timeout` option) và `@google/genai` SDK (`httpOptions`).

**Files ảnh hưởng:**
- `src/utils/rag/llmUtils.ts` — `callOpenAICompatible()`, `callGemini()`, `MAX_RETRIES_PER_PROVIDER`

---

### 2. Sắp xếp lại thứ tự Provider

**Ưu tiên: 🔴 CRITICAL — Triển khai cùng lúc với #1**

**Vấn đề hiện tại:**
- `PROVIDER_CONFIGS` đặt `opencode` (proxy gateway qua `opencode.ai/zen/go/v1`) ở vị trí đầu tiên.
- OpenCode proxy thêm 1 hop network + potential queue delay, làm TTFT (Time-To-First-Token) chậm hơn so với gọi trực tiếp DeepSeek/Gemini API.
- User yêu cầu: ưu tiên `opencode deepseek-v4-pro` lên đầu.

**Giải pháp:**
- Đưa `opencode deepseek-v4-pro` lên đầu danh sách (theo yêu cầu user).
- Loại bỏ entry trùng lặp `opencode ox-alpha` (cùng API key, cùng base URL, chỉ khác model — nếu `deepseek-v4-pro` fail thì `ox-alpha` cũng có khả năng cao fail vì cùng endpoint).
- Đặt các provider có TTFT thấp nhất ở vị trí fallback: `gemini-2.0-flash` → `gpt-4o-mini` → `deepseek-v4-flash`.

**Thứ tự đề xuất:**
```
1. opencode / deepseek-v4-pro  (ưu tiên theo yêu cầu)
2. gemini  / gemini-2.0-flash  (TTFT ~300ms, free tier)
3. deepseek / deepseek-v4-flash (TTFT ~400ms, giá rẻ)
4. openai  / gpt-4o-mini       (TTFT ~500ms, ổn định)
5. grok   / grok-3-mini-fast   (TTFT ~600ms, fallback)
```

**Thời gian tối ưu:** Giảm **5–30 giây** nếu provider đầu tiên respond nhanh (không cần failover).

**Độ phức tạp:** Thấp — sắp xếp lại mảng `PROVIDER_CONFIGS`.

**Tool / Thư viện:** Không cần thêm dependency.

**Files ảnh hưởng:**
- `src/utils/rag/llmUtils.ts` — `PROVIDER_CONFIGS` array

---

### 3. Intent-Driven Tiered Prompting (Prompt phân tầng theo ý định)

**Ưu tiên: 🟠 HIGH — Triển khai sau #1 và #2**

**Vấn đề hiện tại:**
- Mọi tin nhắn (kể cả "Cảm ơn shop!" hay hỏi specs sản phẩm) đều nạp đầy đủ:
  - 3-Layer Context (Turn + Dossier + Evidence)
  - 7 Retention Strategies catalog
  - 12 Store Policies
  - ~25 Allowed Fact Citations
  - Multi-Draft JSON schema
- System prompt luôn ~3,500 tokens bất kể độ phức tạp.
- Điều này gây **context pollution** (LLM bị phân tán bởi thông tin không liên quan) và **lãng phí token/thời gian**.

**Giải pháp:**

Phân loại intent thành 3 tầng, mỗi tầng có prompt template riêng:

| Tầng | Intent codes | Context nạp | Drafts | Tokens ước tính |
|:---|:---|:---|:---|:---|
| **Simple** | `product_info`, `general`, `repurchase`, `null` | Chỉ conversation messages + linked order (nếu có) | 1 | ~500–800 |
| **Standard** | `delivery_status`, `voucher`, `order_modification` | Turn context + Order + Relevant policies | 1–2 | ~1,500–2,000 |
| **Complex** | `complaint`, `refund_request`, `cancellation`, `escalation` | Full 3 Layers + Strategy Catalog + All policies | 2–3 | ~3,000–3,200 |

**Tác động cụ thể:**
- Simple intent: Giảm từ ~3,500 tokens → ~600 tokens (**-83%**). Prefill time giảm ~1–2s, decoding time giảm ~1s (output chỉ 1 draft thay vì 3).
- Standard intent: Giảm ~40%. Bỏ customer dossier metrics (vipScore, voucherSensitivity) và evidence layer khi không cần thiết.
- Complex intent: Giảm ~9% (chỉ từ deduplication, giữ nguyên full pipeline).

**Thời gian tối ưu:** Giảm **1–3 giây** cho mỗi request (chủ yếu từ giảm TTFT và decoding time).

**Độ phức tạp:** Trung bình — tạo file mới `intentRouter.ts`, thêm hàm `buildLiteSystemPrompt`, sửa `generateGroundedResponse` để routing, tạo adapter wrap single-draft thành MultiDraft shape.

**Tool / Thư viện:** Không cần thêm dependency. Sử dụng `detectedIntent` đã có sẵn trong `conversation.intent`.

**Files ảnh hưởng:**
- `src/services/rag/intentRouter.ts` — **MỚI**: phân loại intent complexity
- `src/utils/rag/promptUtils.ts` — thêm `buildLiteSystemPrompt()`, `buildStandardSystemPrompt()`
- `src/services/rag/index.ts` — routing logic trong `generateGroundedResponse()`
- `src/services/rag/liteResponseParser.ts` — **MỚI**: parse single-draft, wrap thành MultiDraft format

**Lưu ý thiết kế:**
- Frontend (`AiResponsePreview.tsx`) không cần sửa vì output API luôn trả về cùng `MultiDraftResponse` shape. Với simple intent, `strategies` array chỉ có 1 phần tử.
- Grounding validation vẫn chạy trên simple intent nhưng nhẹ hơn (không cần fact catalog đầy đủ).

---

### 4. Prompt Deduplication (Loại bỏ nội dung trùng lặp trong prompt)

**Ưu tiên: 🟡 MEDIUM — Triển khai cùng lúc với #3**

**Vấn đề hiện tại:**

System prompt hiện tại chứa **2 bản sao** của cùng một dữ liệu:

1. **Store Policies** xuất hiện ở:
   - `## ALLOWED FACT CITATIONS` → dưới dạng `[policy:RETURN_WINDOW] (Store Policy [RETURN_WINDOW]): "Customers may request..."` (~38 tokens mỗi policy)
   - `## STORE POLICIES (you MUST follow these)` → dưới dạng `[RETURN_WINDOW] Customers may request...` (~22 tokens mỗi policy)
   - Với 12 policies → **~720 tokens bị trùng lặp**.

2. **Customer data** xuất hiện ở:
   - `## CUSTOMER PROFILE & METRICS` → `VIP Score: 42.5/100`, `Total Spend: 1,874,588 VND`...
   - `## ALLOWED FACT CITATIONS` → `[customer:score] (VIP Engagement Score): "42.5/100"`...
   - Với ~15 customer facts → **~450 tokens bị trùng lặp**.

**Giải pháp:**

Hai chiến lược (có thể kết hợp):

**Chiến lược A — Rút gọn ALLOWED FACT CITATIONS (Recommended):**
- Chỉ liệt kê fact ID + label ngắn gọn (bỏ value vì value đã có ở sections phía trên).
- Trước: `[customer:tier] (VIP Customer Tier): "Silver (Tier: silver, Priority: 2)" (confidence: 1.00)`
- Sau: `[customer:tier] VIP Customer Tier (conf: 1.00)`
- LLM vẫn cite đúng vì data context đã xuất hiện ở `## CUSTOMER PROFILE` và `## LINKED ORDER`.

**Chiến lược B — Loại bỏ section STORE POLICIES:**
- Section `## STORE POLICIES (you MUST follow these)` là bản sao nguyên văn của các `[policy:*]` entries trong ALLOWED FACT CITATIONS.
- Loại bỏ hoàn toàn section này, giữ lại chỉ ALLOWED FACT CITATIONS.

**Thời gian tối ưu:** Giảm **0.5–1.5 giây** (ít hơn ~800–1,200 tokens giúp giảm prefill time).

**Độ phức tạp:** Thấp — sửa 2 hàm format.

**Tool / Thư viện:** Không cần thêm dependency.

**Files ảnh hưởng:**
- `src/services/rag/groundingFacts.ts` — `formatGroundingFactsForPrompt()` (rút gọn value)
- `src/utils/rag/promptUtils.ts` — `buildSystemPrompt()` (loại bỏ `formatPolicies()` call)

**Lưu ý:**
- Grounding Validator (`groundingUtils.ts`) sử dụng `Map<string, GroundingFact>` catalog đầy đủ (không dùng text trong prompt). Nên việc rút gọn prompt **không ảnh hưởng** đến logic validation.
- Cần test lại xem LLM có còn cite chính xác policy IDs không khi value text bị bỏ khỏi ALLOWED FACT CITATIONS.

---

### 5. Structured Output / JSON Schema Mode

**Ưu tiên: 🟡 MEDIUM**

**Vấn đề hiện tại:**
- Prompt hiện tại dùng `response_format: { type: 'json_object' }` — chỉ bảo đảm output là JSON hợp lệ, nhưng **không bảo đảm đúng schema**.
- Khi LLM trả về JSON sai schema (thiếu field, sai type, thêm field lạ), Zod validation fail → retry → thêm 8–16 giây.
- Prompt phải include một JSON example block dài ~400 tokens (`## OUTPUT RESPONSE FORMAT`) để hướng dẫn format, tốn token không cần thiết.

**Giải pháp:**
- **OpenAI / Grok / OpenCode:** Chuyển sang `response_format: { type: 'json_schema', json_schema: { ... } }` (Structured Outputs). SDK OpenAI v7 hỗ trợ truyền Zod schema trực tiếp qua `zodResponseFormat()`.
- **Gemini:** Sử dụng `responseSchema` property trong `generateContent()` config, truyền JSON Schema object.
- **DeepSeek:** Hỗ trợ `json_schema` mode tương tự OpenAI.

**Lợi ích:**
- LLM dùng constrained decoding (guided generation), output **luôn match schema 100%** → loại bỏ hoàn toàn retry do lỗi format.
- Có thể loại bỏ `## OUTPUT RESPONSE FORMAT` example block trong prompt → tiết kiệm ~400 tokens.
- Decoding có thể nhanh hơn vì LLM không cần "suy nghĩ" về format.

**Thời gian tối ưu:** Giảm **2–5 giây** (loại bỏ retry do format error + giảm ~400 tokens).

**Độ phức tạp:** Trung bình — cần convert Zod schema sang JSON Schema format cho mỗi provider, handle sự khác biệt giữa các SDK.

**Tool / Thư viện:**
- `openai` SDK v7: `zodResponseFormat()` từ `openai/helpers/zod`
- `@google/genai` SDK: `responseSchema` trong `GenerateContentConfig`
- Zod v4: `z.toJSONSchema()` (Zod v4 có built-in JSON Schema export)

**Files ảnh hưởng:**
- `src/utils/rag/llmUtils.ts` — `callOpenAICompatible()`, `callGemini()`
- `src/utils/rag/promptUtils.ts` — loại bỏ `MULTI_DRAFT_RESPONSE_JSON_FORMAT` block khỏi system prompt
- `src/forms/ragForm.ts` — export JSON Schema version song song với Zod schema

---

### 6. Prompt Caching (Provider-Side KV Cache)

**Ưu tiên: 🟡 MEDIUM**

**Vấn đề hiện tại:**
- Mỗi request gửi toàn bộ system prompt (~3,500 tokens) từ đầu. Provider phải chạy full prefill mỗi lần.
- Phần lớn system prompt là **tĩnh** giữa các request (hướng dẫn, strategy catalog, policy rules, JSON format). Chỉ có customer data và conversation context là thay đổi.

**Giải pháp:**
- **Gemini:** Sử dụng `cachedContents` API — tạo `CachedContent` chứa phần tĩnh của system prompt, sau đó reference trong `generateContent()`. Cache tồn tại 1 giờ mặc định (có thể configure).
- **OpenAI:** Automatic Prompt Caching — OpenAI tự động cache prefix của prompt nếu request gửi lại cùng prefix. Cần **đặt phần tĩnh ở đầu** system prompt (trước customer data).
- **DeepSeek:** Hỗ trợ `prefix_caching` tương tự OpenAI (tự động, miễn phí).

**Điều kiện để cache hoạt động:**
- Phần tĩnh (instructions + strategy catalog + policies + JSON schema) phải nằm **ở đầu** system prompt.
- Phần động (customer data + conversation context + fact citations) phải nằm **ở cuối**.
- Hiện tại prompt đã gần đúng thứ tự này, chỉ cần đảo vị trí một số sections.

**Thời gian tối ưu:** Giảm **0.5–2 giây** prefill time (cache hit giảm ~80% prefill cost cho ~2,000 token tĩnh). Giảm **50% chi phí** token đầu vào trên Gemini/OpenAI.

**Độ phức tạp:** Trung bình — cần restructure system prompt để đặt static content trước dynamic content. Với Gemini cần quản lý vòng đời `CachedContent` object.

**Tool / Thư viện:**
- Gemini: `@google/genai` → `ai.caches.create()`, `ai.models.generateContent({ cachedContent: ... })`
- OpenAI: Tự động (không cần code change, chỉ cần prompt prefix ổn định ≥ 1024 tokens)
- DeepSeek: Tự động

**Files ảnh hưởng:**
- `src/utils/rag/promptUtils.ts` — restructure `buildSystemPrompt()` (static sections trước, dynamic sau)
- `src/utils/rag/llmUtils.ts` — `callGemini()` (thêm cached content management)

---

### 7. Streaming SSE (Server-Sent Events)

**Ưu tiên: 🟢 LOW-MEDIUM — Tối ưu UX, không giảm latency thực**

**Vấn đề hiện tại:**
- Frontend gọi `fetch('/api/rag/generate')` và chờ **toàn bộ** JSON response hoàn chỉnh (blocking).
- User nhìn thấy spinner/loading 100% thời gian cho đến khi nhận được kết quả.
- Perceived latency = actual latency = 3–5 giây (sau khi áp dụng #1–#6).

**Giải pháp:**
- Server stream partial JSON tokens về client qua SSE (`ReadableStream` + `TextEncoder`).
- Client parse partial tokens dần dần, hiển thị draft text đang được "đánh máy" (typewriter effect).
- User nhìn thấy nội dung xuất hiện sau ~500ms (TTFT), perceived wait giảm từ 3–5s xuống ~1s.

**Thách thức với JSON response:**
- LLM output là structured JSON, không phải text tự do → không thể parse partial JSON trivially.
- Có 2 cách tiếp cận:
  - **A. Streaming JSON parser** (vd: `@streamparser/json`): Parse JSON tokens khi chúng đến, extract `draftText` fields sớm nhất có thể.
  - **B. Dual-pass**: Accumulate full JSON → parse → render. Nhưng trong lúc accumulate, hiển thị raw text chunks như "thinking" indicator (vẫn cải thiện UX).

**Thời gian tối ưu:** 0 giây giảm latency thực, nhưng **perceived latency giảm từ 3–5s xuống ~1s** (first content visible).

**Độ phức tạp:** Trung bình–Cao.
- Server: Chuyển `route.ts` từ `NextResponse.json()` sang `new Response(ReadableStream)`.
- Client: Chuyển `useRagGenerate` hook từ `fetch` + `response.json()` sang `EventSource` hoặc `fetch` + `ReadableStream` reader.
- Grounding validation: Phải chạy **sau khi** toàn bộ JSON accumulated (không thể validate partial response).

**Tool / Thư viện:**
- Server: Next.js App Router hỗ trợ `ReadableStream` response natively
- Client: Web `ReadableStream` API / `EventSource` API (built-in browser)
- Optional: `@streamparser/json` cho incremental JSON parsing

**Files ảnh hưởng:**
- `src/app/api/rag/generate/route.ts` — chuyển sang streaming response
- `src/utils/rag/llmUtils.ts` — thêm `callOpenAICompatibleStream()`, `callGeminiStream()`
- `src/hooks/useRagGenerate.ts` — chuyển sang stream reader
- `src/components/copilot/AiResponsePreview.tsx` — progressive rendering UI

---

### 8. Speculative Provider Racing (Hedging)

**Ưu tiên: 🟢 LOW-MEDIUM**

**Vấn đề hiện tại:**
- Provider chain chạy tuần tự: thử provider 1 → fail → thử provider 2 → fail → ...
- Nếu provider ưu tiên (opencode) chậm nhưng **không timeout** (trả về sau 7.5s), ta vẫn phải chờ hết 7.5s dù provider khác có thể trả về trong 2s.

**Giải pháp:**
- Gửi request đến provider chính ngay lập tức.
- Sau **1.5 giây** (hedging delay), nếu chưa nhận first token từ provider chính, **đồng thời** gửi request đến provider phụ.
- Provider nào trả về kết quả hợp lệ trước thì dùng, abort request còn lại qua `AbortController`.

**Ví dụ timeline:**
```
t=0ms     → Gửi request đến opencode/deepseek-v4-pro
t=1500ms  → Chưa có response → Gửi thêm request đến gemini/gemini-2.0-flash
t=2100ms  → Gemini trả về trước → Dùng kết quả Gemini, abort opencode
```

**Thời gian tối ưu:** Giảm **3–6 giây** trong trường hợp provider chính chậm (đuôi dài P95/P99).

**Độ phức tạp:** Trung bình — cần `AbortController`, `Promise.race()`, handle cleanup.

**Tool / Thư viện:**
- Built-in: `AbortController` (Node.js), `Promise.race()`
- `openai` SDK v7 hỗ trợ `signal: abortController.signal` trong request options

**Files ảnh hưởng:**
- `src/services/rag/llmService.ts` — `generateResponse()` (thêm racing logic)
- `src/utils/rag/llmUtils.ts` — `callOpenAICompatible()`, `callGemini()` (thêm `signal` param)

**Trade-off:**
- Tốn thêm API cost khi cả 2 provider đều chạy song song (trung bình ~30% request sẽ trigger hedging).
- Logic phức tạp hơn để handle race conditions và error propagation.

---

### 9. Semantic Response Caching

**Ưu tiên: 🔵 LOW — Phase sau**

**Vấn đề hiện tại:**
- Mỗi lần nhân viên CSKH click "Generate" đều gọi LLM mới, kể cả khi câu hỏi tương tự đã được trả lời trước đó.
- Các câu hỏi FAQ/product-info lặp lại nhiều: "Ship bao lâu?", "Có free ship không?", "Sản phẩm X có size gì?".

**Giải pháp:**
- Tính **embedding vector** của `(intentCode, latestCustomerMessage)`.
- Tìm kiếm trong cache (Redis + vector similarity) xem có response tương tự gần đây không (cosine similarity ≥ 0.92).
- Nếu cache hit: Trả về cached response ngay lập tức (**~30ms**), bỏ qua LLM call.
- Nếu cache miss: Gọi LLM bình thường, lưu response vào cache với TTL 1–4 giờ.

**Cache key design:**
```
key = hash(intentCode + customerTierCode + orderStatusCode + normalize(messageText))
```

**Thời gian tối ưu:** Giảm **3–5 giây** cho cache hit requests (ước tính 30–50% requests là FAQ/repeated queries → amortized saving ~1.5–2.5s).

**Độ phức tạp:** Cao.
- Cần deploy Redis (hoặc Upstash Redis serverless).
- Cần embedding model (vd: `text-embedding-3-small` từ OpenAI, hoặc Gemini embedding).
- Cache invalidation khi policies thay đổi.
- Phải xác định rõ khi nào cache hit là an toàn (không cache complaint/refund responses).

**Tool / Thư viện:**
- `ioredis` hoặc `@upstash/redis` (Redis client)
- `openai` SDK → `client.embeddings.create()` cho text embedding
- Hoặc: `@google/genai` → `ai.models.embedContent()`

**Files ảnh hưởng:**
- `src/lib/redis.ts` — **MỚI**: Redis connection
- `src/services/rag/responseCache.ts` — **MỚI**: semantic cache layer
- `src/services/rag/index.ts` — check cache trước khi gọi LLM
- `.env` — thêm `REDIS_URL`

---

### 10. Background Pre-generation (Tạo draft trước khi agent mở chat)

**Ưu tiên: 🔵 LOW — Phase sau**

**Vấn đề hiện tại:**
- Draft chỉ được tạo khi nhân viên CSKH click nút "Generate AI Response" trong chat panel.
- Nhân viên phải chờ toàn bộ pipeline chạy xong mới thấy draft.

**Giải pháp:**
- Khi hệ thống nhận tin nhắn mới từ khách (qua webhook hoặc polling), **tự động chạy pipeline ở background** và lưu draft vào database.
- Khi nhân viên CSKH mở cuộc hội thoại, draft đã sẵn sàng → hiển thị ngay lập tức (**0ms perceived latency**).
- Nếu draft chưa kịp tạo xong (nhân viên mở chat quá nhanh), fallback sang on-demand generation như hiện tại.

**Pre-generation trigger:**
```
Webhook tin nhắn mới
  → Kiểm tra: sender === 'buyer' && lastMessage.isHuman
  → Enqueue background job: generateGroundedResponse(conversationId)
  → Lưu draft vào table `ai_draft_cache`
```

**Thời gian tối ưu:** **~0 giây perceived** cho nhân viên CSKH (draft đã có sẵn).

**Độ phức tạp:** Cao.
- Cần background job queue (vd: BullMQ + Redis, hoặc Inngest, hoặc simple setTimeout/cron).
- Cần database table mới để lưu pre-generated drafts.
- Cần invalidation logic khi có tin nhắn mới giữa lúc pre-generate và agent mở chat.
- Cần xử lý rate limiting / cost control (không pre-generate cho mọi tin nhắn spam).

**Tool / Thư viện:**
- `bullmq` + `ioredis` (job queue) — hoặc `inngest` (serverless background jobs)
- Prisma migration (table `AiDraftCache`)
- Hoặc đơn giản: Next.js `after()` API (experimental) / `waitUntil()` cho edge runtime

**Files ảnh hưởng:**
- `src/model/schema.prisma` — thêm model `AiDraftCache`
- `src/services/rag/pregeneration.ts` — **MỚI**: background generation service
- `src/app/api/webhook/[platform]/route.ts` — trigger pre-generation khi nhận message
- `src/hooks/useRagGenerate.ts` — check cached draft trước khi gọi API
- `src/app/api/rag/generate/route.ts` — check DB cache trước khi chạy pipeline

---

## Lộ trình triển khai đề xuất

```
Sprint 1 (Ngay lập tức)
├── #1  Client Timeout + Giảm Retry        → Impact: 🔴 Critical, Effort: 1h
├── #2  Sắp xếp lại Provider               → Impact: 🔴 Critical, Effort: 30m
└── #4  Prompt Deduplication                → Impact: 🟡 Medium,   Effort: 1h

Sprint 2 (Tuần sau)
├── #3  Intent-Driven Tiered Prompting      → Impact: 🟠 High,     Effort: 4–6h
└── #5  Structured Output / JSON Schema     → Impact: 🟡 Medium,   Effort: 2–3h

Sprint 3 (Khi cần tối ưu thêm)
├── #6  Prompt Caching                      → Impact: 🟡 Medium,   Effort: 2–3h
└── #8  Speculative Provider Racing         → Impact: 🟢 Low-Med,  Effort: 3–4h

Sprint 4 (Khi scale lên production)
├── #7  Streaming SSE                       → Impact: 🟢 Low-Med,  Effort: 6–8h
├── #9  Semantic Response Caching           → Impact: 🔵 Low,      Effort: 8–12h
└── #10 Background Pre-generation           → Impact: 🔵 Low,      Effort: 8–12h
```

---

## Ước tính latency tổng hợp sau từng Sprint

| Giai đoạn | Worst-case | Typical case | Best case |
|:---|:---|:---|:---|
| **Hiện tại** | >160s | ~45s | ~8s |
| **Sau Sprint 1** (#1 + #2 + #4) | ~40s | ~6s | ~3s |
| **Sau Sprint 2** (#3 + #5) | ~10s | ~3s | ~1.5s |
| **Sau Sprint 3** (#6 + #8) | ~8s | ~2s | ~1s |
| **Sau Sprint 4** (#7 + #9 + #10) | ~8s | ~1.5s | ~30ms (cache hit) |
