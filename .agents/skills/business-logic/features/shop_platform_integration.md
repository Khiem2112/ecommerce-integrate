# Platform Shop Integration & OAuth Lifecycle Business Logic

> **Parent System:** OmniCart  
> **Sub-System:** Integration Operations & Channel Shop Management  
> **Scope:** Multi-shop OAuth 2.0 authorization, credential segregation, per-shop token persistence, and token refresh lifecycle for Lazada and Shopify.

---

## 1. Overview & Multi-Tenant Model

OmniCart operates as a centralized multi-tenant e-commerce operations hub (ISV App). In standard operations:
- **Platform/App Level (OmniCart ISV App):** OmniCart registers **one developer app** on Lazada Open Platform and **one partner app** on Shopify Partner Dashboard.
- **Shop Connection Level (Merchants):** One platform connects to **multiple merchant shops**. Multiple test/sandbox shops can be created for demo/staging (Shopify Development Stores, Lazada Test Seller Accounts).
- **Global Identity Guard:** Each merchant shop is uniquely represented by `PlatformConnection` via `@@unique([platformId, externalShopId])`.

---

## 2. Credential Segregation & Storage Strategy

Credentials are partitioned into two strictly separated layers:

### Layer A: System / Platform App Credentials
- **Items:** `App Key / Client ID`, `App Secret / Client Secret`, `Redirect URI`, `App Scopes`.
- **Ownership:** OmniCart System Level (OmniCart Developer Application).
- **Storage:** Server environment variables (`.env`) or centralized Secret Manager (Infisical / Cloud Secret Store).
  - `LAZADA_APP_KEY`, `LAZADA_APP_SECRET`
  - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- **Rule:** Never duplicate system app keys into individual database rows for standard OAuth connections.

### Layer B: Per-Shop Connection Dynamic Credentials
- **Items:** `access_token`, `refresh_token`, `tokenExpiresAt`, `refreshTokenExpiresAt`, `scopes`, `country`, `seller_id`, `shop_domain`.
- **Ownership:** Distinct per merchant shop connection (`PlatformConnection`).
- **MVP Storage Policy:** Stored in the `integrations` JSON column on `PlatformConnection`.
- **Encapsulation Rule:** All reads/writes to credentials must pass through an isolated service abstraction (e.g., `shopCredentialService`). Direct client DTO serialization, API exposure, or inclusion in `PlatformConnectionAuditLog` is strictly prohibited.
- **Production Evolution:** The JSON payload will be encrypted at rest (AES-256-GCM) using an `APP_ENCRYPTION_KEY` managed via Infisical.

#### TypeScript Schema Contract for `PlatformConnection.integrations`

```typescript
export type LazadaIntegrationData = {
  sellerId: string;
  userId: string;
  country: string;              // "VN", "SG", "MY", etc.
  shortCode?: string;
  account?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;       // ISO 8601 string
  refreshTokenExpiresAt: string;// ISO 8601 string
  customAppKey?: string;        // Populated only for enterprise custom app
  customAppSecret?: string;
};

export type ShopifyIntegrationData = {
  shopDomain: string;           // "{shop}.myshopify.com"
  accessToken: string;
  scopes: string[];
  tokenExpiresAt?: string;
  refreshToken?: string;
  customAppKey?: string;
  customAppSecret?: string;
};

export type PlatformIntegrationData = LazadaIntegrationData | ShopifyIntegrationData;
```

---

## 3. Provider OAuth 2.0 Specifications

### 3.1 Lazada Open Platform (LazOP)
1. **Authorization Handoff:**
   - URL: `https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri={CALLBACK_URL}&client_id={LAZADA_APP_KEY}`
   - Seller logs in via Seller Center and authorizes the app.
2. **Callback Validation:**
   - Callback route receives `code` at `/api/integrations/lazada/callback`.
3. **Token Exchange:**
   - Endpoint: `POST https://auth.lazada.com/rest/auth/token/create`
   - Signed with HMAC-SHA256 using `LAZADA_APP_SECRET`.
   - Response parsing:
     - `externalShopId` is extracted from `country_user_info[0].seller_id` and synced to `PlatformConnection.externalShopId`.
     - `integrations` JSON is populated with `accessToken`, `refreshToken`, `tokenExpiresAt`, `refreshTokenExpiresAt`.
4. **Multi-Shop Testing:**
   - Supported via Lazada Open Platform Console -> *App Management* -> *Test Accounts* (binding multiple seller accounts).

### 3.2 Shopify Partner / Admin API
1. **Authorization Handoff:**
   - URL: `https://{shop}.myshopify.com/admin/oauth/authorize?client_id={SHOPIFY_API_KEY}&scope={SCOPES}&redirect_uri={CALLBACK_URL}&state={NONCE}&grant_options[]=offline`
2. **Callback Validation:**
   - Verify HMAC signature using `SHOPIFY_API_SECRET`.
   - State parameter matching to prevent CSRF.
3. **Token Exchange:**
   - Endpoint: `POST https://{shop}.myshopify.com/admin/oauth/access_token`
   - Response parsing:
     - `externalShopId` is normalized to the shop domain (e.g. `{shop}.myshopify.com`).
     - `integrations` JSON is populated with `accessToken`, `scopes`, and optional `refreshToken`.
4. **Multi-Shop Testing:**
   - Supported via Shopify Partner Dashboard -> *Stores* -> *Create development store* (unlimited free stores).

---

## 4. Token Refresh Lifecycle & Resilience

### 4.1 Platform Refresh Specifics
- **Lazada:**
  - Access token expires in 7 days (test) / 30 days (production).
  - Refresh token expires in 14 days (test) / 180 days (production).
  - Refresh Endpoint: `POST https://auth.lazada.com/rest/auth/token/refresh` with `refresh_token`, `app_key`, `app_secret`, and HMAC-SHA256 signature.
  - Returns new `access_token` and new `refresh_token`.
- **Shopify:**
  - Standard offline tokens do not expire until app uninstallation.
  - Expiring offline tokens: Access token expires in 60 minutes; refresh token in 90 days.
  - Refresh Endpoint: `POST https://{shop}.myshopify.com/admin/oauth/access_token` with `grant_type=refresh_token`.
  - **Refresh Token Rotation:** Using a refresh token immediately invalidates it and issues a replacement.

### 4.2 Refresh Orchestration Rules
1. **Proactive Refresh (Background Cron):**
   - Scheduled worker runs periodically (e.g. every 6 hours).
   - Scans connections where `status = 'connected'` AND `tokenExpiresAt <= NOW() + 24h` (Lazada) or `10m` (Shopify).
   - Refreshes tokens ahead of time to ensure sync batches are never blocked.
2. **Reactive / Just-In-Time (JIT) Check:**
   - Before executing sync operations, connector clients verify token validity. If expired or within 5-minute buffer, refresh immediately.
   - On `401 Unauthorized` / expired token response from marketplace, attempt a single refresh retry before failing.
3. **Concurrency Lock (Distributed Mutex per Connection):**
   - Refresh Token Rotation necessitates that only **one execution context** refreshes a given shop connection at any time.
   - Acquire lock on `connectionId` during refresh. Concurrent jobs wait for the lock and reuse the freshly minted token.
4. **State Transition on Refresh Outcome:**
   - **Success:** Store new tokens in `integrations` JSON, update `lastVerifiedAt = now()`, reset `lastFailureCode = null`.
   - **Transient Failure (5xx, Network Timeout):** Keep `status = 'connected'`, retry with exponential backoff.
   - **Permanent Failure (`IllegalRefreshToken`, `invalid_grant`, uninstalled/revoked):**
     - Transition `PlatformConnection.status` to `reconnect_required`.
     - Set `lastFailureCode = 'TOKEN_EXPIRED'` or `'TOKEN_REVOKED'`.
     - Append redacted audit log to `PlatformConnectionAuditLog`.
     - Block new sync jobs requiring this connection and surface the **Reconnect** prompt on `/shops`.
