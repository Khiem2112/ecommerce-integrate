'use client';

import { useState, useEffect } from 'react';
import { getLazadaDevConfigAction } from '@/actions/lazadaDevActions';
import { Badge } from '@/components/atoms';
import { MetadataExplorer } from './MetadataExplorer';
import { GenericApiRunner } from './GenericApiRunner';
import { OrderContractInspector } from './OrderContractInspector';

export function LazadaDevPlayground() {
  const [activeMainTab, setActiveMainTab] = useState<'metadata' | 'runner' | 'orders'>('metadata');
  const [runnerMethod, setRunnerMethod] = useState<'GET' | 'POST'>('POST');
  const [runnerPath, setRunnerPath] = useState<string>('/product/create');
  const [runnerPayload, setRunnerPayload] = useState<string>('');
  const [config, setConfig] = useState<{
    readonly baseUrl: string;
    readonly appKey: string;
    readonly hasSecret: boolean;
    readonly hasToken: boolean;
  } | null>(null);

  useEffect(() => {
    getLazadaDevConfigAction().then((res) => {
      if (res.success && res.data) {
        setConfig(res.data);
      }
    });
  }, []);

  const handleSelectCategoryForRunner = (_categoryId: number, payloadXml: string) => {
    setRunnerMethod('POST');
    setRunnerPath('/product/create');
    setRunnerPayload(payloadXml);
    setActiveMainTab('runner');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Connection Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-hairline bg-surface shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-foreground">
              Lazada Metadata & API Dev Playground
            </h1>
            <Badge variant="purple" size="xs">
              Phase 0 Tool
            </Badge>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Tra cứu siêu dữ liệu (Categories & Brands), Import cURL và kiểm chứng Data Contract Lazada.
          </p>
        </div>

        {/* Credentials Status Indicators */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" size="xs" className="font-mono">
            Gateway: {config?.baseUrl ?? 'https://api.lazada.vn/rest'}
          </Badge>
          <Badge variant={config?.hasSecret ? 'success' : 'error'} size="xs">
            AppKey: {config?.appKey || 'N/A'} {config?.hasSecret ? '✓' : '⚠️ No Secret'}
          </Badge>
          <Badge variant={config?.hasToken ? 'success' : 'warning'} size="xs">
            {config?.hasToken ? '🎟️ Access Token OK' : '⚠️ No Access Token'}
          </Badge>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-hairline pb-3">
        <button
          onClick={() => setActiveMainTab('metadata')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeMainTab === 'metadata'
              ? 'bg-foreground text-background shadow-xs'
              : 'text-muted hover:text-foreground hover:bg-foreground/5'
          }`}
        >
          <span>📂</span>
          <span>Categories & Brands Table</span>
        </button>

        <button
          onClick={() => setActiveMainTab('runner')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeMainTab === 'runner'
              ? 'bg-foreground text-background shadow-xs'
              : 'text-muted hover:text-foreground hover:bg-foreground/5'
          }`}
        >
          <span>⚡</span>
          <span>cURL Importer & Generic API Runner</span>
        </button>

        <button
          onClick={() => setActiveMainTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
            activeMainTab === 'orders'
              ? 'bg-foreground text-background shadow-xs'
              : 'text-muted hover:text-foreground hover:bg-foreground/5'
          }`}
        >
          <span>📦</span>
          <span>Orders & Items Explorer</span>
        </button>
      </div>

      {/* TAB CONTENTS */}
      <div>
        {activeMainTab === 'metadata' && (
          <MetadataExplorer onSelectCategoryForRunner={handleSelectCategoryForRunner} />
        )}

        {activeMainTab === 'runner' && (
          <GenericApiRunner
            initialMethod={runnerMethod}
            initialPath={runnerPath}
            initialPayloadXml={runnerPayload}
          />
        )}

        {activeMainTab === 'orders' && <OrderContractInspector />}
      </div>
    </div>
  );
}
