'use server';

/**
 * Server Actions for Lazada Dev Playground & Metadata Explorer
 */

import { LazadaDevService } from '@/services/connectors/lazada/lazadaDevService';

const devService = new LazadaDevService();

export type ServerActionResult<T> = {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly code?: string;
};

/**
 * Get current client credentials configuration.
 */
export async function getLazadaDevConfigAction() {
  try {
    const config = devService.getConfig();
    return {
      success: true,
      data: config,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get config',
    };
  }
}

/**
 * Execute a dynamic Lazada API request.
 */
export async function executeLazadaGenericAction(
  method: 'GET' | 'POST',
  apiPath: string,
  params: Record<string, unknown> = {},
) {
  try {
    const res = await devService.executeGeneric(method, apiPath, params);
    return {
      success: res.success,
      data: res,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Execution failed',
    };
  }
}

/**
 * Get flattened leaf categories (with disk/memory caching).
 */
export async function getLazadaCategoriesAction(forceRefresh: boolean = false) {
  try {
    const res = await devService.getCategories(forceRefresh);
    return {
      success: true,
      data: res,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch categories',
    };
  }
}

/**
 * Query brands with pagination.
 */
export async function getLazadaBrandsAction(startRow: number = 0, pageSize: number = 50, keyword?: string) {
  try {
    const res = await devService.getBrands(startRow, pageSize, keyword);
    return {
      success: true,
      data: res,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to query brands',
    };
  }
}

/**
 * Fetch category attributes schema.
 */
export async function getLazadaCategoryAttributesAction(categoryId: number) {
  try {
    const res = await devService.getCategoryAttributes(categoryId);
    return {
      success: true,
      data: res,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch category attributes',
    };
  }
}
