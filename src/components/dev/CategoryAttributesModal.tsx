'use client';

import { useState, useEffect, useTransition } from 'react';
import { getLazadaCategoryAttributesAction } from '@/actions/lazadaDevActions';
import type { FormattedCategoryAttributes } from '@/services/connectors/lazada/lazadaDevService';
import { Badge, Button } from '@/components/atoms';

export type CategoryAttributesModalProps = {
  readonly categoryId: number | null;
  readonly categoryName?: string;
  readonly onClose: () => void;
  readonly onUseInRunner?: (categoryId: number, samplePayloadXml: string) => void;
};

export function CategoryAttributesModal({
  categoryId,
  categoryName,
  onClose,
  onUseInRunner,
}: CategoryAttributesModalProps) {
  const [data, setData] = useState<FormattedCategoryAttributes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [optionalSearch, setOptionalSearch] = useState('');

  useEffect(() => {
    if (!categoryId) return;
    setData(null);
    setError(null);
    startTransition(async () => {
      const res = await getLazadaCategoryAttributesAction(categoryId);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error ?? 'Không thể tải thuộc tính danh mục');
      }
    });
  }, [categoryId]);

  if (!categoryId) return null;

  const buildSamplePayload = () => {
    return `<?xml version="1.0" encoding="UTF-8" ?>
<Request>
    <Product>
        <PrimaryCategory>${categoryId}</PrimaryCategory>
        <SPUId></SPUId>
        <AssociatedSku></AssociatedSku>
        <Images>
            <Image>https://sg-test-11.slatic.net/p/741ffae76f4402eae71cb1fcd0eec38f.png</Image>
        </Images>
        <Attributes>
            <name>Mock Test Product Title</name>
            <short_description><![CDATA[Short description]]></short_description>
            <description><![CDATA[<p>Detailed product description</p>]]></description>
            <brand>No Brand</brand>
            <model>Standard</model>
            <warranty_type>No Warranty</warranty_type>
        </Attributes>
        <Skus>
            <Sku>
                <SellerSku>MOCK-SKU-${Date.now()}</SellerSku>
                <quantity>100</quantity>
                <price>199000.00</price>
                <package_content>1 x Product</package_content>
                <package_weight>0.3</package_weight>
                <package_length>20</package_length>
                <package_width>15</package_width>
                <package_height>3</package_height>
                <Images>
                    <Image>https://sg-test-11.slatic.net/p/741ffae76f4402eae71cb1fcd0eec38f.png</Image>
                </Images>
            </Sku>
        </Skus>
    </Product>
</Request>`;
  };

  const handleCopyPayload = () => {
    const payload = buildSamplePayload();
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredOptional = (data?.optional ?? []).filter(
    (attr) =>
      attr.name.toLowerCase().includes(optionalSearch.toLowerCase()) ||
      attr.label.toLowerCase().includes(optionalSearch.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-hairline shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">Category Schema & Attributes</h3>
              <Badge variant="primary" size="sm">
                ID: {categoryId}
              </Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {categoryName ?? 'Chi tiết thuộc tính bắt buộc & tùy chọn cho danh mục'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-sm cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {isPending && (
            <div className="flex items-center justify-center py-16 text-muted text-xs gap-2">
              <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Đang tải thuộc tính danh mục từ Lazada...</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-semantic-error/30 bg-semantic-error/10 p-4 text-xs text-semantic-error">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Mandatory Attributes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-semantic-error" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Thuộc tính Bắt buộc (Mandatory Fields - {data.mandatory.length})
                    </h4>
                  </div>
                  <span className="text-[11px] text-muted">
                    Bắt buộc phải có trong XML payload khi gọi /product/create
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {data.mandatory.map((attr) => (
                    <div
                      key={attr.name}
                      className="rounded-xl border border-semantic-error/25 bg-semantic-error/5 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {attr.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="error" size="xs">
                            {attr.inputType}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted">{attr.label}</p>
                      {attr.options.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span className="text-[10px] text-muted self-center">Options:</span>
                          {attr.options.slice(0, 5).map((opt) => (
                            <span
                              key={opt}
                              className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground font-mono"
                            >
                              {opt}
                            </span>
                          ))}
                          {attr.options.length > 5 && (
                            <span className="text-[10px] text-muted">
                              +{attr.options.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Attributes */}
              <div className="space-y-3 pt-4 border-t border-hairline">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-muted" />
                    <h4 className="text-sm font-semibold text-foreground">
                      Thuộc tính Tùy chọn (Optional Fields - {data.optional.length})
                    </h4>
                  </div>
                  <input
                    type="text"
                    value={optionalSearch}
                    onChange={(e) => setOptionalSearch(e.target.value)}
                    placeholder="Lọc thuộc tính tùy chọn..."
                    className="h-7 w-48 rounded-lg border border-hairline bg-surface-lifted px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                  {filteredOptional.map((attr) => (
                    <div
                      key={attr.name}
                      className="rounded-lg border border-hairline bg-surface-lifted p-2 space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-medium text-foreground truncate" title={attr.name}>
                          {attr.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted truncate" title={attr.label}>
                        {attr.label}
                      </p>
                      <span className="text-[9px] text-muted bg-foreground/5 px-1 py-0.2 rounded inline-block">
                        {attr.inputType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-hairline shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPayload}
            disabled={!data}
          >
            {copied ? '✓ Đã sao chép XML' : '📋 Copy Sample XML Payload'}
          </Button>

          <div className="flex items-center gap-2">
            {onUseInRunner && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onUseInRunner(categoryId, buildSamplePayload())}
                disabled={!data}
              >
                Gửi tới API Runner
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
