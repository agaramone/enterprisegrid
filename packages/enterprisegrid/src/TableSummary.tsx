import React, { useState, useMemo } from 'react';
import { Sparkles, Check, Copy, Download, Bot, ArrowUp, ArrowDown } from './icons';
import {
  LLMConfig,
  LLMInsightItem,
  executeLLMTask,
  generateSmartLocalInsights,
  generateSmartLocalSummary,
} from './llmAdapter';

export interface ColumnSummaryStat {
  columnId: string;
  columnName: string;
  type: 'numeric' | 'categorical';
  count: number;
  // Numeric metrics
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
  median?: number;
  formattedSum?: string;
  formattedAvg?: string;
  formattedMin?: string;
  formattedMax?: string;
  // Categorical metrics
  uniqueCount?: number;
  topValue?: string;
  topValueCount?: number;
  topValuePercent?: number;
}

export interface ExternalSummaryData<T = any> {
  activeRows: T[];
  selectedRows: T[];
  activeRowCount: number;
  totalRowCount: number;
  selectedRowCount: number;
  isFiltered: boolean;
  isSelectionScope: boolean;
  kpis: LLMInsightItem[];
  columnStats: ColumnSummaryStat[];
  executiveSummary: string;
  aiSummary?: string | null;
  aiInsights?: LLMInsightItem[];
  updatedAt: string;
}

export interface TableSummaryProps<T = any> {
  /** Pre-computed live summary object emitted by <DataTable onSummaryChange={...} /> */
  summaryData?: ExternalSummaryData<T> | null;
  /** Raw rows array if using <TableSummary /> standalone without onSummaryChange */
  data?: T[];
  /** Selected rows subset if using <TableSummary /> standalone */
  selectedRows?: T[];
  /** Total row count before filtering if using standalone */
  totalRowCount?: number;
  /** Table columns configuration */
  columns?: Array<{
    id?: string | number;
    name?: React.ReactNode;
    selector?: (row: T, rowIndex?: number) => any;
    omit?: boolean;
  }>;
  /** Summary section title */
  title?: React.ReactNode;
  /** Visual layout variant */
  variant?: 'detailed' | 'cards' | 'compact' | 'sidebar';
  /** Show top-level KPI cards (default: true) */
  showKpis?: boolean;
  /** Show per-column statistical & categorical breakdowns (default: true) */
  showColumnStats?: boolean;
  /** Show executive narrative summary (default: true) */
  showExecutiveSummary?: boolean;
  /** Allow generating on-demand AI summary via configured LLM provider (default: true) */
  enableAiSummary?: boolean;
  /** Universal LLM configuration */
  llmConfig?: LLMConfig<T>;
  /** Summarize selected rows when rows are selected (default: true) */
  preferSelectedRows?: boolean;
  /** Color theme ('light' | 'dark') */
  theme?: 'light' | 'dark';
  /** Additional CSS class names */
  className?: string;
}

function parseNumericValue(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return NaN;
    // Avoid treating multi-value strings or dates like 2026-06-25 as simple numbers
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return NaN;
    const cleaned = trimmed.replace(/[$,%\s,]/g, '');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return NaN;
    return parseFloat(cleaned);
  }
  return NaN;
}

function formatStatNumber(num: number, isYearLike: boolean): string {
  if (isYearLike) return String(Math.round(num));
  if (Math.abs(num) >= 1000) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.00$/, '');
}

/**
 * Computes comprehensive statistical, numeric, and categorical summaries
 * for any table dataset so it can be displayed outside the table.
 */
export function computeExternalSummary<T extends Record<string, any>>(
  activeRows: T[],
  columns: Array<{
    id?: string | number;
    name?: React.ReactNode;
    selector?: (row: T, rowIndex?: number) => any;
    omit?: boolean;
  }> = [],
  options?: {
    selectedRows?: T[];
    totalRowCount?: number;
    preferSelectedRows?: boolean;
    aiSummary?: string | null;
    aiInsights?: LLMInsightItem[];
  }
): ExternalSummaryData<T> {
  const selectedRows = options?.selectedRows || [];
  const preferSelected = options?.preferSelectedRows !== false;
  const isSelectionScope = preferSelected && selectedRows.length > 0;
  const targetRows = isSelectionScope ? selectedRows : activeRows;
  const totalRowCount = options?.totalRowCount ?? activeRows.length;

  const normalizedColumns = columns
    .filter((c) => !c.omit)
    .map((c, idx) => {
      const id = String(c.id ?? (typeof c.name === 'string' ? c.name : `col_${idx}`));
      const name = typeof c.name === 'string' ? c.name : id;
      return {
        id,
        name,
        selector: c.selector || ((row: any) => row?.[id]),
      };
    })
    .filter((c) => c.id.toLowerCase() !== 'action' && c.id.toLowerCase() !== 'actions' && c.id.toLowerCase() !== 'trend');

  const columnStats: ColumnSummaryStat[] = [];

  for (const col of normalizedColumns) {
    if (col.id.toLowerCase() === 'id') continue;

    const rawValues = targetRows
      .map((row, idx) => col.selector(row, idx))
      .filter((v) => v !== undefined && v !== null && v !== '' && !Array.isArray(v));

    if (rawValues.length === 0) continue;

    const numericValues = rawValues.map(parseNumericValue).filter((n) => !isNaN(n));
    const isNumeric = numericValues.length >= Math.max(1, Math.ceil(rawValues.length * 0.6));

    if (isNumeric) {
      const sorted = [...numericValues].sort((a, b) => a - b);
      const sum = numericValues.reduce((acc, v) => acc + v, 0);
      const avg = sum / numericValues.length;
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

      const isYearLike =
        col.id.toLowerCase().includes('year') ||
        (min >= 1850 && max <= 2100 && numericValues.every((n) => Number.isInteger(n)));

      columnStats.push({
        columnId: col.id,
        columnName: col.name,
        type: 'numeric',
        count: numericValues.length,
        sum,
        avg,
        min,
        max,
        median,
        formattedSum: isYearLike ? '—' : formatStatNumber(sum, false),
        formattedAvg: formatStatNumber(avg, isYearLike),
        formattedMin: formatStatNumber(min, isYearLike),
        formattedMax: formatStatNumber(max, isYearLike),
      });
    } else {
      const freq = new Map<string, number>();
      for (const val of rawValues) {
        const key = String(val).trim();
        if (!key) continue;
        freq.set(key, (freq.get(key) || 0) + 1);
      }
      let topValue = '—';
      let topValueCount = 0;
      freq.forEach((count, key) => {
        if (count > topValueCount) {
          topValueCount = count;
          topValue = key;
        }
      });
      const topValuePercent = rawValues.length > 0 ? Math.round((topValueCount / rawValues.length) * 100) : 0;

      columnStats.push({
        columnId: col.id,
        columnName: col.name,
        type: 'categorical',
        count: rawValues.length,
        uniqueCount: freq.size,
        topValue,
        topValueCount,
        topValuePercent,
      });
    }
  }

  const kpis = generateSmartLocalInsights(targetRows, normalizedColumns);
  const executiveSummary = generateSmartLocalSummary(targetRows, normalizedColumns);

  return {
    activeRows,
    selectedRows,
    activeRowCount: activeRows.length,
    totalRowCount,
    selectedRowCount: selectedRows.length,
    isFiltered: activeRows.length < totalRowCount,
    isSelectionScope,
    kpis,
    columnStats,
    executiveSummary,
    aiSummary: options?.aiSummary ?? null,
    aiInsights: options?.aiInsights,
    updatedAt: new Date().toLocaleTimeString(),
  };
}

/**
 * Standalone & External Table Summary Component (`<TableSummary />`)
 * Can be placed anywhere outside `<DataTable />` (above, below, sidebar, or separate dashboard panel)
 * to display live KPIs, per-column aggregations, and AI executive summaries.
 */
export function TableSummary<T extends Record<string, any> = any>({
  summaryData,
  data = [],
  selectedRows = [],
  totalRowCount,
  columns = [],
  title = 'External Table Summary & Analytics',
  variant = 'detailed',
  showKpis = true,
  showColumnStats = true,
  showExecutiveSummary = true,
  enableAiSummary = true,
  llmConfig,
  preferSelectedRows = true,
  theme = 'light',
  className = '',
}: TableSummaryProps<T>) {
  const [customAiSummary, setCustomAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeLayout, setActiveLayout] = useState<'detailed' | 'cards' | 'compact' | 'sidebar'>(variant);

  const computed = useMemo<ExternalSummaryData<T>>(() => {
    if (summaryData) return summaryData;
    return computeExternalSummary(data, columns, {
      selectedRows,
      totalRowCount,
      preferSelectedRows,
    });
  }, [summaryData, data, columns, selectedRows, totalRowCount, preferSelectedRows]);

  const displayedSummaryText = customAiSummary || computed.aiSummary || computed.executiveSummary;
  const isDark = theme === 'dark';

  const handleGenerateExternalAiSummary = async () => {
    setIsGeneratingAi(true);
    try {
      const targetRows = computed.isSelectionScope ? computed.selectedRows : computed.activeRows;
      const schema = computed.columnStats.map((c) => ({
        id: c.columnId,
        name: c.columnName,
        sampleType: c.type,
      }));
      const cols = computed.columnStats.map((c) => ({
        id: c.columnId,
        name: c.columnName,
      }));

      const result = await executeLLMTask(
        llmConfig,
        {
          task: 'summary',
          schema,
          rows: targetRows,
          totalRowCount: targetRows.length,
        },
        cols
      );
      if (typeof result === 'string' && result.trim()) {
        setCustomAiSummary(result);
      }
    } catch {
      setCustomAiSummary(computed.executiveSummary);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopySummary = () => {
    const lines: string[] = [
      `# ${typeof title === 'string' ? title : 'Table Data Summary'}`,
      `Scope: ${computed.isSelectionScope ? `${computed.selectedRowCount} Selected Rows` : `${computed.activeRowCount} of ${computed.totalRowCount} Rows`}`,
      '',
      `## Executive Summary`,
      displayedSummaryText,
      '',
      `## Column Aggregations`,
      ...computed.columnStats.map((stat) =>
        stat.type === 'numeric'
          ? `- ${stat.columnName}: Avg ${stat.formattedAvg} | Min ${stat.formattedMin} | Max ${stat.formattedMax}${stat.formattedSum !== '—' ? ` | Sum ${stat.formattedSum}` : ''}`
          : `- ${stat.columnName}: ${stat.uniqueCount} unique values | Top: "${stat.topValue}" (${stat.topValueCount} rows, ${stat.topValuePercent}%)`
      ),
    ];
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const handleExportSummaryJson = () => {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      scope: computed.isSelectionScope ? 'selected_rows' : computed.isFiltered ? 'filtered_rows' : 'all_rows',
      activeRowCount: computed.activeRowCount,
      totalRowCount: computed.totalRowCount,
      selectedRowCount: computed.selectedRowCount,
      executiveSummary: displayedSummaryText,
      kpis: computed.kpis,
      columnStats: computed.columnStats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'table-summary-report.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        isDark
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200 text-slate-800 shadow-xs'
      } ${className}`}
    >
      {/* Header Bar */}
      <div
        className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/70'
        }`}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-600 text-white">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>

          {/* Live Scope Indicator */}
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold tabular-nums border ${
              computed.isSelectionScope
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : computed.isFiltered
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : isDark
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {computed.isSelectionScope
              ? `Summarizing ${computed.selectedRowCount} Selected Row${computed.selectedRowCount === 1 ? '' : 's'}`
              : computed.isFiltered
              ? `Filtered View: ${computed.activeRowCount} of ${computed.totalRowCount} Rows`
              : `All Data: ${computed.activeRowCount} Rows`}
          </span>
        </div>

        {/* Controls: View Switcher + AI Refresh + Copy + Export */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className={`inline-flex rounded-lg p-0.5 border text-[11px] ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {(['detailed', 'cards', 'compact'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActiveLayout(mode)}
                className={`px-2 py-0.5 rounded-md font-semibold capitalize transition-colors ${
                  activeLayout === mode
                    ? isDark
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-900 shadow-2xs'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {enableAiSummary && (
            <button
              type="button"
              onClick={handleGenerateExternalAiSummary}
              disabled={isGeneratingAi}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isGeneratingAi ? 'Analyzing...' : 'AI Summarize'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopySummary}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="Copy summary report to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportSummaryJson}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="Download summary report JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 space-y-4">
        {/* 1. Executive Narrative Summary Banner */}
        {showExecutiveSummary && (
          <div
            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
              isDark
                ? 'bg-indigo-950/30 border-indigo-900/60 text-indigo-100'
                : 'bg-indigo-50/60 border-indigo-100 text-slate-700'
            }`}
          >
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {customAiSummary || computed.aiSummary ? 'AI Executive Summary' : 'Live Data Synopsis'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                  Updated {computed.updatedAt}
                </span>
              </div>
              <p className="text-xs leading-relaxed">{displayedSummaryText}</p>
            </div>
            {customAiSummary && (
              <button
                type="button"
                onClick={() => setCustomAiSummary(null)}
                className="text-[11px] text-indigo-600 hover:underline shrink-0 font-medium"
              >
                Reset
              </button>
            )}
          </div>
        )}

        {/* 2. Top-level KPI Cards */}
        {showKpis && activeLayout !== 'compact' && computed.kpis.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {computed.kpis.map((kpi, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border ${
                  isDark ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50/70 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {kpi.title}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      kpi.trend === 'up'
                        ? 'bg-emerald-100 text-emerald-800'
                        : kpi.trend === 'down'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {kpi.trend === 'up' && <ArrowUp className="w-2.5 h-2.5" />}
                    {kpi.trend === 'down' && <ArrowDown className="w-2.5 h-2.5" />}
                    {kpi.trend || 'neutral'}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums tracking-tight my-0.5">
                  {kpi.value}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{kpi.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* 3. Per-Column Statistical & Categorical Aggregations */}
        {showColumnStats && activeLayout === 'detailed' && computed.columnStats.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Column-Level Aggregations & Distribution ({computed.columnStats.length} Columns)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {computed.columnStats.map((stat) => (
                <div
                  key={stat.columnId}
                  className={`p-3 rounded-lg border text-xs flex flex-col justify-between ${
                    isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-white border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold truncate">{stat.columnName}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        stat.type === 'numeric'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}
                    >
                      {stat.type === 'numeric' ? 'Numeric' : 'Category'}
                    </span>
                  </div>

                  {stat.type === 'numeric' ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Avg:</span>
                        <span className="font-bold text-indigo-600">{stat.formattedAvg}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Sum:</span>
                        <span className="font-semibold">{stat.formattedSum}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Min:</span>
                        <span>{stat.formattedMin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Max:</span>
                        <span>{stat.formattedMax}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Unique Values:</span>
                        <span className="font-mono font-bold tabular-nums">{stat.uniqueCount}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 shrink-0">Top Value:</span>
                        <span className="font-semibold truncate text-right" title={stat.topValue}>
                          {stat.topValue} ({stat.topValuePercent}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compact Strip Mode */}
        {activeLayout === 'compact' && (
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums pt-1">
            {computed.columnStats.map((stat) => (
              <div
                key={stat.columnId}
                className={`px-2.5 py-1 rounded-md border flex items-center gap-2 ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="font-sans font-semibold text-slate-500">{stat.columnName}:</span>
                {stat.type === 'numeric' ? (
                  <span>
                    Avg <strong>{stat.formattedAvg}</strong> (Min {stat.formattedMin} – Max {stat.formattedMax})
                  </span>
                ) : (
                  <span className="font-sans">
                    <strong>{stat.uniqueCount}</strong> unique · Top: <strong>{stat.topValue}</strong>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default TableSummary;
