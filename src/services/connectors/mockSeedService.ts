/**
 * Mock Seeds Service — Retrieves available mock datasets for development and QA testing.
 */

import type { SeedProfile } from '@/types';

export const DEFAULT_MOCK_SEEDS: readonly SeedProfile[] = [
  { key: 'default', name: 'Standard Seed (250 orders)', description: 'Balanced mock dataset', orderCount: 250 },
  { key: 'mega_sale', name: 'Mega Sale Campaign', description: 'Surge of processing orders', orderCount: 250 },
  { key: 'high_returns', name: 'High Return / Cancellation', description: 'Orders with issues', orderCount: 250 },
  { key: 'fresh_orders', name: 'Fresh Live Stream Orders', description: 'Recent orders', orderCount: 250 },
];

export async function getMockSeedsService(): Promise<readonly SeedProfile[]> {
  try {
    const baseUrl = process.env.LAZADA_API_BASE_URL ?? 'http://localhost:4000/rest';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanBase}/mock/seeds`);
    if (!res.ok) {
      return DEFAULT_MOCK_SEEDS;
    }
    const json = await res.json();
    return (json.data?.seeds as readonly SeedProfile[]) ?? DEFAULT_MOCK_SEEDS;
  } catch {
    return DEFAULT_MOCK_SEEDS;
  }
}
