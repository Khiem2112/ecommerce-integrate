'use client';

import { useState, useTransition, useMemo } from 'react';
import { getLazadaCategoriesAction, getLazadaBrandsAction } from '@/actions/lazadaDevActions';
import type { LeafCategory, BrandItem } from '@/services/connectors/lazada/lazadaDevService';
import { Badge, Button } from '@/components/atoms';
import { CategoryAttributesModal } from './CategoryAttributesModal';

export type MetadataExplorerProps = {
  readonly initialCategories?: readonly LeafCategory[];
  readonly initialFromCache?: boolean;
  readonly onSelectCategoryForRunner?: (categoryId: number, payloadXml: string) => void;
};

export function MetadataExplorer({
  initialCategories = [],
  initialFromCache = false,
  onSelectCategoryForRunner,
}: MetadataExplorerProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'brands'>('categories');

  // Categories state
  const [categories, setCategories] = useState<readonly LeafCategory[]>(initialCategories);
  const [fromCache, setFromCache] = useState(initialFromCache);
  const [catSearch, setCatSearch] = useState('');
  const [catPage, setCatPage] = useState(1);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedCatName, setSelectedCatName] = useState<string>('');
  const [isCatPending, startCatTransition] = useTransition();

  // Brands state
  const [brands, setBrands] = useState<readonly BrandItem[]>([]);
  const [brandSearch, setBrandSearch] = useState('');
  const [isBrandsLoaded, setIsBrandsLoaded] = useState(false);
  const [isBrandPending, startBrandTransition] = useTransition();

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Fetch / Refresh Categories
  const handleLoadCategories = (forceRefresh: boolean = false) => {
    startCatTransition(async () => {
      const res = await getLazadaCategoriesAction(forceRefresh);
      if (res.success && res.data) {
        setCategories(res.data.categories);
        setFromCache(res.data.fromCache);
        setCatPage(1);
      }
    });
  };

  // Fetch Brands
  const handleLoadBrands = (keyword?: string) => {
    startBrandTransition(async () => {
      const res = await getLazadaBrandsAction(0, 100, keyword);
      if (res.success && res.data) {
        setBrands(res.data.brands);
        setIsBrandsLoaded(true);
      }
    });
  };

  // Filter Categories Offline (Fast 0ms)
  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const kw = catSearch.toLowerCase().trim();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(kw) ||
        c.path.toLowerCase().includes(kw) ||
        String(c.id).includes(kw),
    );
  }, [categories, catSearch]);

  const CAT_PAGE_SIZE = 20;
  const totalCatPages = Math.ceil(filteredCategories.length / CAT_PAGE_SIZE) || 1;
  const paginatedCategories = useMemo(() => {
    const start = (catPage - 1) * CAT_PAGE_SIZE;
    return filteredCategories.slice(start, start + CAT_PAGE_SIZE);
  }, [filteredCategories, catPage]);

  // Filter Brands
  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return brands;
    const kw = brandSearch.toLowerCase().trim();
    return brands.filter(
      (b) => b.name.toLowerCase().includes(kw) || String(b.brandId).includes(kw),
    );
  }, [brands, brandSearch]);

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'categories'
                ? 'bg-foreground text-background'
                : 'text-muted hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            📂 Danh mục Lá (Categories Table)
          </button>
          <button
            onClick={() => {
              setActiveTab('brands');
              if (!isBrandsLoaded) handleLoadBrands();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'brands'
                ? 'bg-foreground text-background'
                : 'text-muted hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            🏷️ Thương hiệu (Brands Table)
          </button>
        </div>

        {activeTab === 'categories' && (
          <div className="flex items-center gap-2">
            {categories.length > 0 && (
              <Badge variant={fromCache ? 'success' : 'info'} size="xs">
                {fromCache ? '⚡ Đã lưu đệm (0 API Request)' : 'Mới cập nhật'}
              </Badge>
            )}
            <Button
              variant="outline"
              size="xs"
              isLoading={isCatPending}
              onClick={() => handleLoadCategories(true)}
            >
              🔄 Làm mới từ Lazada
            </Button>
          </div>
        )}

        {activeTab === 'brands' && (
          <Button
            variant="outline"
            size="xs"
            isLoading={isBrandPending}
            onClick={() => handleLoadBrands(brandSearch)}
          >
            🔄 Tải lại Brands
          </Button>
        )}
      </div>

      {/* TAB 1: CATEGORIES TABLE */}
      {activeTab === 'categories' && (
        <div className="space-y-3">
          {/* Search bar & info */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={catSearch}
                onChange={(e) => {
                  setCatSearch(e.target.value);
                  setCatPage(1);
                }}
                placeholder="🔍 Tìm theo tên danh mục, ID (ví dụ: áo, 10100270)..."
                className="w-full h-9 rounded-xl border border-hairline bg-surface-lifted pl-3 pr-8 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              {catSearch && (
                <button
                  onClick={() => setCatSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-xs text-muted shrink-0">
              Tìm thấy <strong className="text-foreground">{filteredCategories.length}</strong> / {categories.length} danh mục lá
            </div>
          </div>

          {categories.length === 0 && !isCatPending && (
            <div className="rounded-2xl border border-hairline bg-surface-lifted p-8 text-center space-y-3">
              <p className="text-xs text-muted">Chưa tải cây danh mục. Bấm nút bên dưới để tải và lưu đệm cục bộ.</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleLoadCategories(false)}
              >
                Tải cây danh mục từ Lazada
              </Button>
            </div>
          )}

          {categories.length > 0 && (
            <div className="rounded-2xl border border-hairline bg-surface overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-foreground/5 border-b border-hairline text-muted">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-32">Category ID</th>
                      <th className="py-2.5 px-3 font-semibold w-48">Tên danh mục</th>
                      <th className="py-2.5 px-3 font-semibold">Đường dẫn phân cấp (Breadcrumb Path)</th>
                      <th className="py-2.5 px-3 font-semibold w-36 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {paginatedCategories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-foreground/2 transition-colors">
                        <td className="py-2 px-3 font-mono font-semibold text-foreground whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(String(cat.id), `cat-${cat.id}`)}
                            title="Bấm để copy ID"
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-foreground/5 hover:bg-foreground/15 transition-colors cursor-pointer"
                          >
                            <span>{cat.id}</span>
                            <span className="text-[10px] text-muted">
                              {copiedId === `cat-${cat.id}` ? '✓' : '📋'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">{cat.name}</td>
                        <td className="py-2 px-3 text-muted">{cat.path}</td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              setSelectedCatId(cat.id);
                              setSelectedCatName(cat.path);
                            }}
                          >
                            Xem thuộc tính
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalCatPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-hairline bg-foreground/2 text-xs">
                  <span className="text-muted">
                    Trang {catPage} / {totalCatPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={catPage <= 1}
                      onClick={() => setCatPage((p) => p - 1)}
                    >
                      ← Trước
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={catPage >= totalCatPages}
                      onClick={() => setCatPage((p) => p + 1)}
                    >
                      Sau →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BRANDS TABLE */}
      {activeTab === 'brands' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLoadBrands(brandSearch);
                }}
                placeholder="🔍 Tìm thương hiệu (ví dụ: No Brand, Nike, Apple)... Bấm Enter để tìm trực tiếp"
                className="w-full h-9 rounded-xl border border-hairline bg-surface-lifted pl-3 pr-8 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              {brandSearch && (
                <button
                  onClick={() => {
                    setBrandSearch('');
                    handleLoadBrands('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="text-xs text-muted shrink-0">
              Hiển thị <strong className="text-foreground">{filteredBrands.length}</strong> thương hiệu
            </div>
          </div>

          {brands.length === 0 && !isBrandPending && (
            <div className="rounded-2xl border border-hairline bg-surface-lifted p-8 text-center space-y-3">
              <p className="text-xs text-muted">Chưa tải danh sách thương hiệu.</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleLoadBrands()}
              >
                Tải danh sách Brands
              </Button>
            </div>
          )}

          {brands.length > 0 && (
            <div className="rounded-2xl border border-hairline bg-surface overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-foreground/5 border-b border-hairline text-muted">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold w-40">Brand ID</th>
                      <th className="py-2.5 px-3 font-semibold">Tên Thương Hiệu</th>
                      <th className="py-2.5 px-3 font-semibold">Global Identifier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {filteredBrands.map((b) => (
                      <tr key={String(b.brandId)} className="hover:bg-foreground/2 transition-colors">
                        <td className="py-2 px-3 font-mono font-semibold text-foreground whitespace-nowrap">
                          <button
                            onClick={() => copyToClipboard(String(b.brandId), `brand-${b.brandId}`)}
                            title="Bấm để copy Brand ID"
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-foreground/5 hover:bg-foreground/15 transition-colors cursor-pointer"
                          >
                            <span>{b.brandId}</span>
                            <span className="text-[10px] text-muted">
                              {copiedId === `brand-${b.brandId}` ? '✓' : '📋'}
                            </span>
                          </button>
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">{b.name}</td>
                        <td className="py-2 px-3 text-muted font-mono">{b.globalIdentifier || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Attributes Modal */}
      {selectedCatId !== null && (
        <CategoryAttributesModal
          categoryId={selectedCatId}
          categoryName={selectedCatName}
          onClose={() => setSelectedCatId(null)}
          onUseInRunner={(catId, payloadXml) => {
            setSelectedCatId(null);
            if (onSelectCategoryForRunner) {
              onSelectCategoryForRunner(catId, payloadXml);
            }
          }}
        />
      )}
    </div>
  );
}
