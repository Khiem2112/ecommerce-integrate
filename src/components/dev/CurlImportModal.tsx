'use client';

import { useState } from 'react';
import { parseCurlCommand, type ParsedCurlResult } from '@/utils/curlParser';
import { Badge, Button } from '@/components/atoms';

export type CurlImportModalProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onApply: (parsed: ParsedCurlResult) => void;
};

export function CurlImportModal({ isOpen, onClose, onApply }: CurlImportModalProps) {
  const [rawCurl, setRawCurl] = useState('');
  const [preview, setPreview] = useState<ParsedCurlResult | null>(null);

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setRawCurl(text);
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    try {
      const result = parseCurlCommand(text);
      setPreview(result);
    } catch {
      setPreview(null);
    }
  };

  const handleApply = () => {
    if (preview) {
      onApply(preview);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-hairline">
          <div>
            <h3 className="text-base font-semibold text-foreground">Import cURL Command</h3>
            <p className="text-xs text-muted">
              Dán câu lệnh cURL từ Lazada API Docs hoặc DevTools để tự động bóc tách tham số.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-sm cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Câu lệnh cURL:
            </label>
            <textarea
              rows={5}
              value={rawCurl}
              onChange={(e) => handleParse(e.target.value)}
              placeholder="curl -X POST &quot;https://api.lazada.vn/rest/product/create&quot; -d &quot;payload=...&quot;"
              className="w-full rounded-lg border border-hairline bg-surface-lifted p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {preview && (
            <div className="rounded-xl border border-hairline bg-surface-lifted p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Kết quả bóc tách:</span>
                <div className="flex items-center gap-2">
                  <Badge variant={preview.method === 'POST' ? 'warning' : 'info'} size="xs">
                    {preview.method}
                  </Badge>
                  <code className="font-mono text-xs text-foreground bg-foreground/10 px-2 py-0.5 rounded">
                    {preview.path}
                  </code>
                </div>
              </div>

              {preview.params.length > 0 && (
                <div className="mt-2">
                  <span className="text-[11px] text-muted block mb-1">
                    Tham số nhận diện được ({preview.params.length}):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {preview.params.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded bg-foreground/5 px-2 py-1 text-xs font-mono"
                      >
                        <span className="text-foreground font-medium">{p.key}:</span>
                        <span className="text-muted truncate max-w-[280px]" title={p.value}>
                          {p.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-hairline">
          <Button variant="outline" size="sm" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!preview}
            onClick={handleApply}
          >
            Áp dụng vào Runner
          </Button>
        </div>
      </div>
    </div>
  );
}
