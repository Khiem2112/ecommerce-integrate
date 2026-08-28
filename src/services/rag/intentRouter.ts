/**
 * Intent Router — fast dynamic intent classification and tier routing.
 * Classifies customer queries into Simple, Standard, or Complex tiers using
 * sub-millisecond regex pattern matching with database intent fallback.
 */

import type { RetentionStrategy } from '@/types';

export type IntentTier = 'simple' | 'standard' | 'complex';

export type ResolvedIntent = {
  readonly tier: IntentTier;
  readonly code: string;
  readonly confidence: number;
  readonly source: 'pattern_match' | 'db_intent' | 'default_fallback';
};

// Patterns for fast turn-by-turn intent matching (~0ms execution time)
const COMPLEX_INTENT_PATTERNS = [
  { pattern: /(hủy\s*(đơn|hàng)|cancel|hủy\s*giùm|huỷ)/i, code: 'cancellation' },
  { pattern: /(trả\s*hàng|hoàn\s*tiền|đòi\s*tiền|refund|return|đổi\s*trả)/i, code: 'refund_request' },
  { pattern: /(lừa\s*đảo|gian\s*lận|bồi\s*thường|khiếu\s*nại|phàn\s*nàn|complaint|hỏng|vỡ|rách|hư\s*hỏng|sai\s*hàng|thiếu\s*hàng|thái\s*độ|báo\s*công\s*an|chửi)/i, code: 'complaint' },
];

const STANDARD_INTENT_PATTERNS = [
  { pattern: /(giao\s*hàng|vận\s*chuyển|đang\s*ở\s*đâu|khi\s*nào\s*(nhận|giao|tới)|mã\s*vận\s*đơn|tracking|shipper|giao\s*chưa|delivery|shipping|đơn\s*đến\s*đâu)/i, code: 'delivery_status' },
  { pattern: /(voucher|mã\s*giảm\s*giá|khuyến\s*mãi|coupon|giảm\s*giá|ưu\s*đãi)/i, code: 'voucher' },
  { pattern: /(đổi\s*(size|địa\s*chỉ|sđt|số\s*điện\s*thoại)|sửa\s*đơn)/i, code: 'order_modification' },
];

const SIMPLE_INTENT_PATTERNS = [
  { pattern: /(chào|hi\s*shop|hello|alo|shop\s*ơi|ad\s*ơi|cảm\s*ơn|thanks|thank\s*you|ok|dạ|vâng|tuyệt)/i, code: 'general' },
  { pattern: /(còn\s*(hàng|size|màu)|giá\s*bao\s*nhiêu|thông\s*tin\s*sản\s*phẩm|specs|hướng\s*dẫn\s*dùng|tư\s*vấn)/i, code: 'product_info' },
  { pattern: /(mua\s*lại|đặt\s*thêm|order\s*tiếp|mua\s*tiếp)/i, code: 'repurchase' },
];

/**
 * Classify a query into an Intent Tier dynamically.
 * Priority: Fast Pattern Matcher (latest message) -> DB intent -> Simple fallback
 */
export function resolveIntentTier(
  latestMessageText: string,
  dbIntentCode?: string | null,
): ResolvedIntent {
  const trimmed = latestMessageText.trim();

  // 1. Fast Pattern Matching on the latest message
  for (const { pattern, code } of COMPLEX_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { tier: 'complex', code, confidence: 0.95, source: 'pattern_match' };
    }
  }

  for (const { pattern, code } of STANDARD_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { tier: 'standard', code, confidence: 0.9, source: 'pattern_match' };
    }
  }

  for (const { pattern, code } of SIMPLE_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { tier: 'simple', code, confidence: 0.9, source: 'pattern_match' };
    }
  }

  // 2. Fallback to Database Intent if message doesn't match clear keywords
  if (dbIntentCode) {
    switch (dbIntentCode) {
      case 'complaint':
      case 'refund_request':
      case 'cancellation':
      case 'escalation':
        return { tier: 'complex', code: dbIntentCode, confidence: 0.85, source: 'db_intent' };
      case 'delivery_status':
      case 'voucher':
      case 'order_modification':
        return { tier: 'standard', code: dbIntentCode, confidence: 0.85, source: 'db_intent' };
      case 'product_info':
      case 'repurchase':
      case 'general':
      default:
        return { tier: 'simple', code: dbIntentCode, confidence: 0.8, source: 'db_intent' };
    }
  }

  // 3. Default fallback for ambiguous or short greetings
  return {
    tier: 'simple',
    code: 'general',
    confidence: 0.7,
    source: 'default_fallback',
  };
}

/**
 * Filter active retention strategies appropriate for the intent tier.
 * - Simple tier: 1 best strategy (goodwill or concise) -> fast single draft
 * - Standard tier: 1-2 strategies
 * - Complex tier: all active strategies (2-3)
 */
export function filterStrategiesForTier(
  tier: IntentTier,
  strategies: readonly RetentionStrategy[],
): RetentionStrategy[] {
  if (strategies.length === 0) return [];

  if (tier === 'simple') {
    // Pick the most concise/polite strategy for simple inquiries
    const preferred = strategies.find(
      (s) => s.code === 'strat_goodwill' || s.code === 'strat_concise',
    );
    return [preferred ?? strategies[0]];
  }

  if (tier === 'standard') {
    // Return up to 2 strategies
    const primary = strategies.find(
      (s) => s.code === 'strat_concise' || s.code === 'strat_goodwill',
    );
    const secondary = strategies.find((s) => s.code !== primary?.code);
    return [primary ?? strategies[0], secondary ?? strategies[1]].filter(
      (s): s is RetentionStrategy => s != null,
    );
  }

  // Complex tier uses full catalog
  return [...strategies];
}
