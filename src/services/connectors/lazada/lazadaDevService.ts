/**
 * Lazada Dev Service - Backend service for Lazada Metadata Explorer & Generic API Runner
 * Supports caching category tree, querying attributes, brands, and executing dynamic API requests.
 */

import fs from 'node:fs';
import path from 'node:path';
import { LazadaClient } from './lazadaClient';
import type { LazadaCategoryTreeNode, LazadaCategoryAttribute } from '@/types/lazada';

export type LeafCategory = {
  readonly id: number;
  readonly name: string;
  readonly path: string;
  readonly isLeaf: boolean;
};

export type FormattedCategoryAttributes = {
  readonly categoryId: number;
  readonly mandatory: readonly {
    readonly name: string;
    readonly label: string;
    readonly inputType: string;
    readonly attributeType: string;
    readonly isMandatory: boolean;
    readonly options: readonly string[];
  }[];
  readonly optional: readonly {
    readonly name: string;
    readonly label: string;
    readonly inputType: string;
    readonly attributeType: string;
    readonly isMandatory: boolean;
    readonly options: readonly string[];
  }[];
  readonly totalCount: number;
};

export type BrandItem = {
  readonly brandId: number | string;
  readonly name: string;
  readonly globalIdentifier?: string;
};

export type GenericApiResponse = {
  readonly success: boolean;
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
  readonly requestId?: string;
  readonly durationMs: number;
  readonly data?: unknown;
  readonly raw?: unknown;
};

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CATEGORY_CACHE_FILE = path.join(CACHE_DIR, 'lazada_categories.json');

let inMemoryCategories: LeafCategory[] | null = null;

export class LazadaDevService {
  private readonly client: LazadaClient;

  constructor() {
    this.client = new LazadaClient({
      timeoutMs: 15000,
      maxRetries: 1,
    });
  }

  public getConfig() {
    return this.client.getConfig();
  }

  /**
   * Execute any generic Lazada API request with timing and complete response payload.
   */
  public async executeGeneric(
    method: 'GET' | 'POST',
    apiPath: string,
    params: Record<string, unknown> = {},
  ): Promise<GenericApiResponse> {
    const startTime = Date.now();
    try {
      const cleanedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
      const data = await this.client.request<unknown>(method, cleanedPath, params);
      const durationMs = Date.now() - startTime;

      return {
        success: true,
        statusCode: 200,
        code: '0',
        message: 'Success',
        durationMs,
        data,
        raw: { code: '0', data },
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorObj = err as Record<string, unknown>;
      const code = String(errorObj?.code ?? 'ERROR');
      const message = String(errorObj?.message ?? (err instanceof Error ? err.message : 'Unknown error'));
      const requestId = errorObj?.requestId ? String(errorObj.requestId) : undefined;
      const raw = errorObj?.rawPayload ?? { code, message, requestId };

      return {
        success: false,
        statusCode: 400,
        code,
        message,
        requestId,
        durationMs,
        raw,
      };
    }
  }

  /**
   * Get flattened leaf categories with breadcrumb paths.
   * Cached to disk (.cache/lazada_categories.json) to preserve 10,000 req/day quota.
   */
  public async getCategories(forceRefresh: boolean = false): Promise<{
    readonly categories: readonly LeafCategory[];
    readonly fromCache: boolean;
    readonly totalCount: number;
  }> {
    // 1. Check in-memory cache
    if (!forceRefresh && inMemoryCategories && inMemoryCategories.length > 0) {
      return {
        categories: inMemoryCategories,
        fromCache: true,
        totalCount: inMemoryCategories.length,
      };
    }

    // 2. Check disk cache
    if (!forceRefresh && fs.existsSync(CATEGORY_CACHE_FILE)) {
      try {
        const cachedRaw = fs.readFileSync(CATEGORY_CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(cachedRaw) as LeafCategory[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryCategories = parsed;
          return {
            categories: parsed,
            fromCache: true,
            totalCount: parsed.length,
          };
        }
      } catch {
        // Fallback to live fetch on corrupt cache
      }
    }

    // 3. Live fetch from Lazada API
    const rawTree = await this.client.get<LazadaCategoryTreeNode[]>('/category/tree/get', {
      language_code: 'vi_VN',
    });

    const leafList: LeafCategory[] = [];

    const traverse = (node: LazadaCategoryTreeNode, currentPath: string) => {
      const name = node.name ?? '';
      const catId = node.category_id;
      const isLeaf = Boolean(node.leaf);
      const fullPath = currentPath ? `${currentPath} > ${name}` : name;

      if (isLeaf) {
        leafList.push({
          id: catId,
          name,
          path: fullPath,
          isLeaf: true,
        });
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, fullPath);
        }
      }
    };

    if (Array.isArray(rawTree)) {
      for (const rootNode of rawTree) {
        traverse(rootNode, '');
      }
    }

    // 4. Save to disk cache
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(CATEGORY_CACHE_FILE, JSON.stringify(leafList, null, 2), 'utf-8');
    } catch {
      // Non-fatal cache write error
    }

    inMemoryCategories = leafList;

    return {
      categories: leafList,
      fromCache: false,
      totalCount: leafList.length,
    };
  }

  /**
   * Query brands with pagination and optional keyword search.
   */
  public async getBrands(startRow: number = 0, pageSize: number = 50, keyword?: string): Promise<{
    readonly brands: readonly BrandItem[];
    readonly total: number;
  }> {
    const raw = await this.client.get<Array<{ brand_id: number | string; name: string; global_identifier?: string }>>(
      '/category/brands/query',
      {
        startRow: String(startRow),
        pageSize: String(pageSize),
      },
    );

    let brands: BrandItem[] = (raw ?? []).map((b) => ({
      brandId: b.brand_id,
      name: b.name,
      globalIdentifier: b.global_identifier,
    }));

    if (keyword && keyword.trim() !== '') {
      const kw = keyword.toLowerCase().trim();
      brands = brands.filter((b) => b.name.toLowerCase().includes(kw) || String(b.brandId).includes(kw));
    }

    return {
      brands,
      total: brands.length,
    };
  }

  /**
   * Fetch category attributes and separate into Mandatory and Optional.
   */
  public async getCategoryAttributes(categoryId: number): Promise<FormattedCategoryAttributes> {
    const raw = await this.client.get<LazadaCategoryAttribute[]>('/category/attributes/get', {
      primary_category_id: String(categoryId),
    });

    const list = Array.isArray(raw) ? raw : [];
    const mandatoryList: FormattedCategoryAttributes['mandatory'][number][] = [];
    const optionalList: FormattedCategoryAttributes['optional'][number][] = [];

    for (const attr of list) {
      const isMand = attr.is_mandatory === 1 || String(attr.is_mandatory) === '1';
      const options = (attr.options ?? []).map((o: { name: string }) => o.name).filter(Boolean);

      const item = {
        name: attr.name,
        label: attr.label || attr.name,
        inputType: attr.input_type || 'text',
        attributeType: attr.attribute_type || 'normal',
        isMandatory: isMand,
        options,
      };

      if (isMand) {
        mandatoryList.push(item);
      } else {
        optionalList.push(item);
      }
    }

    return {
      categoryId,
      mandatory: mandatoryList,
      optional: optionalList,
      totalCount: list.length,
    };
  }
}
