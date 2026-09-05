'use client';

import { useState, useEffect, useTransition } from 'react';
import { executeLazadaGenericAction } from '@/actions/lazadaDevActions';
import type { ParsedCurlParam, ParsedCurlResult } from '@/utils/curlParser';
import type { GenericApiResponse } from '@/services/connectors/lazada/lazadaDevService';
import { Badge, Button } from '@/components/atoms';
import { CurlImportModal } from './CurlImportModal';

export type ApiPreset = {
  readonly id: string;
  readonly name: string;
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly params: readonly { readonly key: string; readonly value: string; readonly active: boolean }[];
  readonly rawBody?: string;
};

const DEFAULT_PRESETS: readonly ApiPreset[] = [
  {
    id: 'orders-get',
    name: '📦 Lấy danh sách đơn hàng (/orders/get)',
    method: 'GET',
    path: '/orders/get',
    params: [
      {
        key: 'created_after',
        value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, '+07:00'),
        active: true,
      },
      { key: 'limit', value: '10', active: true },
      { key: 'sort_by', value: 'created_at', active: true },
      { key: 'sort_direction', value: 'DESC', active: true },
      { key: 'status', value: 'packed', active: false },
    ],
  },
  {
    id: 'order-items-get',
    name: '🔍 Chi tiết mặt hàng đơn (/order/items/get)',
    method: 'GET',
    path: '/order/items/get',
    params: [{ key: 'order_id', value: '532041562580318', active: true }],
  },
  {
    id: 'products-get',
    name: '🛍️ Danh sách sản phẩm (/products/get)',
    method: 'GET',
    path: '/products/get',
    params: [
      { key: 'filter', value: 'all', active: true },
      { key: 'limit', value: '10', active: true },
      { key: 'offset', value: '0', active: true },
    ],
  },
  {
    id: 'brands-query',
    name: '🏷️ Danh sách thương hiệu (/category/brands/query)',
    method: 'GET',
    path: '/category/brands/query',
    params: [
      { key: 'startRow', value: '0', active: true },
      { key: 'pageSize', value: '20', active: true },
    ],
  },
];

const COMMON_PATHS = [
  '/orders/get',
  '/order/items/get',
  '/order/get',
  '/products/get',
  '/product/create',
  '/category/tree/get',
  '/category/attributes/get',
  '/category/brands/query',
  '/image/upload',
  '/logistics/shipment/providers/get',
  '/reverse/orders/get',
];

export type GenericApiRunnerProps = {
  readonly initialMethod?: 'GET' | 'POST';
  readonly initialPath?: string;
  readonly initialPayloadXml?: string;
};

export function GenericApiRunner({
  initialMethod = 'GET',
  initialPath = '/orders/get',
  initialPayloadXml,
}: GenericApiRunnerProps) {
  const [method, setMethod] = useState<'GET' | 'POST'>(initialMethod);
  const [apiPath, setApiPath] = useState(initialPath);
  const [params, setParams] = useState<ParsedCurlParam[]>([
    {
      id: 'p-1',
      key: 'created_after',
      value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, '+07:00'),
      active: true,
    },
    { id: 'p-2', key: 'limit', value: '10', active: true },
    { id: 'p-3', key: 'sort_by', value: 'created_at', active: true },
    { id: 'p-4', key: 'sort_direction', value: 'DESC', active: true },
  ]);

  const [rawBody, setRawBody] = useState<string>(initialPayloadXml ?? '');
  const [bodyMode, setBodyMode] = useState<'params' | 'raw'>(initialPayloadXml ? 'raw' : 'params');
  const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);
  const [presets, setPresets] = useState<ApiPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Execution state
  const [response, setResponse] = useState<GenericApiResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [jsonSearch, setJsonSearch] = useState('');

  // Load custom presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('omnicart_lazada_dev_presets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPresets([...DEFAULT_PRESETS, ...parsed]);
          return;
        }
      }
    } catch {
      // fallback
    }
    setPresets([...DEFAULT_PRESETS]);
  }, []);

  // Sync initial props
  useEffect(() => {
    if (initialPath) setApiPath(initialPath);
    if (initialMethod) setMethod(initialMethod);
    if (initialPayloadXml) {
      setRawBody(initialPayloadXml);
      setBodyMode('raw');
      setParams([{ id: 'p-payload', key: 'payload', value: initialPayloadXml, active: true }]);
    }
  }, [initialPath, initialMethod, initialPayloadXml]);

  const handleApplyCurl = (parsed: ParsedCurlResult) => {
    setMethod(parsed.method);
    setApiPath(parsed.path);
    if (parsed.params.length > 0) {
      setParams([...parsed.params]);
      setBodyMode('params');
    }
    if (parsed.rawBody) {
      setRawBody(parsed.rawBody);
    }
  };

  const handleLoadPreset = (preset: ApiPreset) => {
    setMethod(preset.method);
    setApiPath(preset.path);
    setParams(
      preset.params.map((p, idx) => ({
        id: `param-${Date.now()}-${idx}`,
        key: p.key,
        value: p.value,
        active: p.active,
      })),
    );
    if (preset.rawBody) {
      setRawBody(preset.rawBody);
      setBodyMode('raw');
    } else {
      setBodyMode('params');
    }
  };

  const handleSaveCurrentPreset = () => {
    if (!presetName.trim()) return;
    const newPreset: ApiPreset = {
      id: `custom-${Date.now()}`,
      name: `⭐ ${presetName.trim()}`,
      method,
      path: apiPath,
      params: params.map((p) => ({ key: p.key, value: p.value, active: p.active })),
      rawBody: bodyMode === 'raw' ? rawBody : undefined,
    };

    const customPresets = presets.filter((p) => p.id.startsWith('custom-'));
    const updatedCustom = [...customPresets, newPreset];
    try {
      localStorage.setItem('omnicart_lazada_dev_presets', JSON.stringify(updatedCustom));
    } catch {
      // ignore
    }
    setPresets([...DEFAULT_PRESETS, ...updatedCustom]);
    setPresetName('');
    setShowSavePreset(false);
  };

  const handleAddParam = () => {
    setParams((prev) => [
      ...prev,
      {
        id: `param-${Date.now()}-${prev.length}`,
        key: '',
        value: '',
        active: true,
      },
    ]);
  };

  const handleUpdateParam = (id: string, field: 'key' | 'value' | 'active', val: string | boolean) => {
    setParams((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p)),
    );
  };

  const handleRemoveParam = (id: string) => {
    setParams((prev) => prev.filter((p) => p.id !== id));
  };

  const handleExecute = () => {
    startTransition(async () => {
      const activeParams: Record<string, unknown> = {};

      if (bodyMode === 'raw' && rawBody.trim()) {
        if (rawBody.trim().startsWith('<')) {
          activeParams.payload = rawBody.trim();
        } else {
          try {
            const parsedJson = JSON.parse(rawBody);
            Object.assign(activeParams, parsedJson);
          } catch {
            activeParams.payload = rawBody;
          }
        }
      } else {
        for (const p of params) {
          if (p.active && p.key.trim()) {
            activeParams[p.key.trim()] = p.value.trim();
          }
        }
      }

      const res = await executeLazadaGenericAction(method, apiPath, activeParams);
      if (res.data) {
        setResponse(res.data);
      } else {
        setResponse({
          success: false,
          statusCode: 500,
          code: 'SERVER_ERROR',
          message: res.error ?? 'Lỗi không xác định khi thực thi',
          durationMs: 0,
        });
      }
    });
  };

  const handleCopyJson = () => {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response.raw ?? response.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT COLUMN: REQUEST BUILDER (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Top Control Bar: Presets & cURL */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border border-hairline bg-surface-lifted">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <span className="text-xs text-muted font-medium shrink-0">Presets:</span>
            <select
              onChange={(e) => {
                const found = presets.find((p) => p.id === e.target.value);
                if (found) handleLoadPreset(found);
              }}
              defaultValue=""
              className="h-8 rounded-lg border border-hairline bg-surface px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 w-full"
            >
              <option value="" disabled>
                -- Chọn kịch bản mẫu --
              </option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowSavePreset(!showSavePreset)}
            >
              💾 Lưu Preset
            </Button>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => setIsCurlModalOpen(true)}
            >
              📥 Import cURL
            </Button>
          </div>
        </div>

        {/* Save Preset Input Bar */}
        {showSavePreset && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-hairline bg-surface">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nhập tên Preset (ví dụ: Test đơn hàng COD J&T)..."
              className="flex-1 h-8 rounded-lg border border-hairline bg-surface-lifted px-3 text-xs text-foreground focus:outline-none"
            />
            <Button variant="primary" size="xs" onClick={handleSaveCurrentPreset}>
              Lưu lại
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setShowSavePreset(false)}>
              Hủy
            </Button>
          </div>
        )}

        {/* Method & Path Row */}
        <div className="flex items-center gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
            className={`h-10 px-3 font-semibold text-xs rounded-xl border border-hairline transition-colors cursor-pointer ${
              method === 'POST'
                ? 'bg-status-warning/15 text-status-warning border-status-warning/30'
                : 'bg-status-info/15 text-status-info border-status-info/30'
            }`}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          <div className="relative flex-1">
            <input
              type="text"
              list="common-paths"
              value={apiPath}
              onChange={(e) => setApiPath(e.target.value)}
              placeholder="/orders/get, /product/create..."
              className="w-full h-10 rounded-xl border border-hairline bg-surface px-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <datalist id="common-paths">
              {COMMON_PATHS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          <Button
            variant="primary"
            size="md"
            isLoading={isPending}
            onClick={handleExecute}
            className="shrink-0 font-semibold px-5"
          >
            🚀 Execute
          </Button>
        </div>

        {/* Mode Switcher: Params Table vs Raw Payload */}
        <div className="rounded-2xl border border-hairline bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-hairline pb-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBodyMode('params')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  bodyMode === 'params'
                    ? 'bg-foreground text-background'
                    : 'text-muted hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                Bảng tham số (Params Table - {params.filter((p) => p.active).length}/{params.length})
              </button>
              <button
                onClick={() => setBodyMode('raw')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  bodyMode === 'raw'
                    ? 'bg-foreground text-background'
                    : 'text-muted hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                XML / JSON Raw Body
              </button>
            </div>

            {bodyMode === 'params' && (
              <Button variant="ghost" size="xs" onClick={handleAddParam}>
                + Thêm tham số
              </Button>
            )}
          </div>

          {/* PARAMS TABLE MODE */}
          {bodyMode === 'params' && (
            <div className="space-y-2">
              {params.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted">
                  Chưa có tham số nào.{' '}
                  <button
                    onClick={handleAddParam}
                    className="text-foreground underline cursor-pointer"
                  >
                    Bấm vào đây
                  </button>{' '}
                  để thêm tham số mới.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {params.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 p-1.5 rounded-xl border transition-colors ${
                        p.active
                          ? 'border-hairline bg-surface-lifted'
                          : 'border-hairline/40 bg-foreground/2 opacity-50'
                      }`}
                    >
                      {/* Active toggle */}
                      <input
                        type="checkbox"
                        checked={p.active}
                        onChange={(e) => handleUpdateParam(p.id, 'active', e.target.checked)}
                        title="Bật/Tắt tham số này"
                        className="size-4 rounded border-hairline text-foreground focus:ring-0 cursor-pointer ml-1"
                      />

                      {/* Key */}
                      <input
                        type="text"
                        value={p.key}
                        onChange={(e) => handleUpdateParam(p.id, 'key', e.target.value)}
                        placeholder="Tên tham số (key)"
                        className="w-1/3 h-8 rounded-lg border border-hairline bg-surface px-2.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                      />

                      {/* Value */}
                      <input
                        type="text"
                        value={p.value}
                        onChange={(e) => handleUpdateParam(p.id, 'value', e.target.value)}
                        placeholder="Giá trị (value)"
                        className="flex-1 h-8 rounded-lg border border-hairline bg-surface px-2.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                      />

                      {/* Remove */}
                      <button
                        onClick={() => handleRemoveParam(p.id)}
                        className="size-7 grid place-items-center rounded-lg text-muted hover:text-semantic-error hover:bg-semantic-error/10 cursor-pointer transition-colors"
                        title="Xóa tham số"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RAW BODY MODE */}
          {bodyMode === 'raw' && (
            <div>
              <textarea
                rows={12}
                value={rawBody}
                onChange={(e) => setRawBody(e.target.value)}
                placeholder="Dán payload XML (<Request><Product>...</Product></Request>) hoặc JSON payload vào đây..."
                className="w-full rounded-xl border border-hairline bg-surface-lifted p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: RESPONSE INSPECTOR (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="flex flex-col h-full rounded-2xl border border-hairline bg-surface p-4 shadow-xs min-h-[500px]">
          {/* Response Header */}
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Response Output</span>
              {response && (
                <>
                  <Badge variant={response.success ? 'success' : 'error'} size="xs">
                    {response.code === '0' ? '200 OK' : `Error [${response.code}]`}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted">
                    ⚡ {response.durationMs}ms
                  </span>
                </>
              )}
            </div>

            {response && (
              <Button variant="outline" size="xs" onClick={handleCopyJson}>
                {copied ? '✓ Đã Copy' : '📋 Copy JSON'}
              </Button>
            )}
          </div>

          {/* Response Details & JSON */}
          <div className="flex-1 overflow-y-auto pt-3 space-y-3">
            {!response && !isPending && (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 text-muted space-y-2">
                <span className="text-3xl opacity-40">📬</span>
                <p className="text-xs">Chưa có kết quả. Nhập endpoint và bấm <strong>Execute</strong> để gọi API.</p>
              </div>
            )}

            {isPending && (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 text-muted space-y-2">
                <svg className="size-6 animate-spin text-foreground" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-xs font-mono">Đang ký HMAC-SHA256 và gửi request tới Lazada...</p>
              </div>
            )}

            {response && (
              <>
                {response.requestId && (
                  <div className="text-[11px] text-muted font-mono bg-foreground/5 p-2 rounded-lg truncate" title={response.requestId}>
                    Request ID: <strong className="text-foreground">{response.requestId}</strong>
                  </div>
                )}

                {/* Search in response */}
                <input
                  type="text"
                  value={jsonSearch}
                  onChange={(e) => setJsonSearch(e.target.value)}
                  placeholder="🔍 Lọc từ khóa trong JSON response..."
                  className="w-full h-7 rounded-lg border border-hairline bg-surface-lifted px-2.5 text-xs text-foreground placeholder:text-muted focus:outline-none"
                />

                {/* Preformatted JSON */}
                <pre className="p-3 rounded-xl border border-hairline bg-surface-lifted font-mono text-[11px] text-foreground overflow-x-auto max-h-[420px] whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(response.raw ?? response.data, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>
      </div>

      {/* cURL Import Modal */}
      <CurlImportModal
        isOpen={isCurlModalOpen}
        onClose={() => setIsCurlModalOpen(false)}
        onApply={handleApplyCurl}
      />
    </div>
  );
}
