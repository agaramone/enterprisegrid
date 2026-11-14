import React, { useState } from 'react';
import { RotateCcw, Columns, Rows, Eye, Code2, Link as LinkIcon, Check } from 'lucide-react';
import LiveCodeEditor from './LiveCodeEditor';

export interface BasePlaygroundProps {
  id?: string;
  title: string;
  description: React.ReactNode;
  initialConfig: Record<string, boolean>;
  renderCode: (config: Record<string, boolean>) => string;
  renderTable: (config: Record<string, boolean>) => React.ReactNode;
}

type ViewMode = 'stacked' | 'split' | 'preview' | 'code';

export function BasePlayground({
  id,
  title,
  description,
  initialConfig,
  renderCode,
  renderTable,
}: BasePlaygroundProps) {
  const [config, setConfig] = useState(initialConfig);
  const [viewMode, setViewMode] = useState<ViewMode>('stacked');
  const [linkCopied, setLinkCopied] = useState(false);

  const sectionId = id || title.toLowerCase().replace(/\s+/g, '-');

  const toggleConfig = (key: string) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isDirty = Object.keys(initialConfig).some((k) => config[k] !== initialConfig[k]);

  const copyAnchorLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#${sectionId}`;
      await navigator.clipboard?.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      // ignore clipboard restriction
    }
  };

  return (
    <section className="mb-16 scroll-mt-8 pt-2" id={sectionId}>
      <div className="flex items-center gap-2 min-w-0 mb-3">
        <h2 className="text-2xl font-display font-bold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={copyAnchorLink}
          aria-label={`Copy link to ${title}`}
          title="Copy section link"
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
        >
          {linkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <LinkIcon className="w-4 h-4" />}
        </button>
      </div>

      <div className="text-[15.5px] text-slate-600 mb-4 leading-[1.75] max-w-[75ch]">
        {description}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          {Object.keys(config).map((key) => {
            const active = config[key];
            return (
              <label
                key={key}
                className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors select-none ${
                  active
                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleConfig(key)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="capitalize whitespace-nowrap">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </label>
            );
          })}
        </div>

        {/* Layout & Reset Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <button
              type="button"
              onClick={() => setConfig(initialConfig)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <div
            role="group"
            aria-label="Playground view mode"
            className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0"
          >
            <button
              type="button"
              onClick={() => setViewMode('stacked')}
              title="Stacked layout (Full-width preview)"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                viewMode === 'stacked' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Rows className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stacked</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              title="Side-by-side split view"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors hidden xl:flex items-center gap-1 whitespace-nowrap shrink-0 ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              title="Preview only"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                viewMode === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              title="Code only"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                viewMode === 'code' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Code</span>
            </button>
          </div>
        </div>
      </div>

      <div className={viewMode === 'split' ? 'grid grid-cols-1 xl:grid-cols-2 gap-6 items-start' : 'space-y-5'}>
        {viewMode !== 'code' && (
          <div className="w-full min-w-0 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Live Preview</span>
              <span className="text-[11px] font-normal text-slate-400">Interactive Grid</span>
            </div>
            <div className="p-4 flex-grow overflow-auto relative min-h-[260px]">
              {renderTable(config)}
            </div>
          </div>
        )}

        {viewMode !== 'preview' && (
          <div className="w-full min-w-0">
            <LiveCodeEditor language="jsx" title={`${sectionId}.tsx`}>
              {renderCode(config)}
            </LiveCodeEditor>
          </div>
        )}
      </div>
    </section>
  );
}
