import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search as SearchIcon, Copy, Check, X } from 'lucide-react';
import { SEO } from '../components/SEO';
import Footer from '../components/Footer';
import LiveCodeEditor from '../components/LiveCodeEditor';

interface ApiEntry {
  prop: string;
  type: string;
  required?: boolean;
  defaultValue?: string;
  category: string;
  description: string;
}

const API_ENTRIES: ApiEntry[] = [
  // Core & Layout
  { prop: 'columns', type: 'TableColumn<T>[]', required: true, category: 'Core & Layout', description: 'Column configuration array defining selectors, sorting, editing, pinning, aggregations, sparklines, and heatmaps.' },
  { prop: 'data', type: 'T[]', required: true, category: 'Core & Layout', description: 'Array of row objects displayed inside the grid.' },
  { prop: 'id', type: 'string', category: 'Core & Layout', description: 'Unique identifier for the table instance, used by Saved Views and local storage keys.' },
  { prop: 'keyField', type: 'string', defaultValue: '"id"', category: 'Core & Layout', description: 'Property name on each row object used as a stable React key.' },
  { prop: 'config', type: 'Config', category: 'Core & Layout', description: 'Object controlling toolbar capabilities (pagination, selectableRows, calendarView, mapView, kanbanView, galleryView, savedViews, shareableViews, auditTrail, timeTravel, rowComments, bookmarks, commandPalette, sidePreview, swipeActions, offlineEditing, fullscreen, keyboardNavigation, contextMenu).' },
  { prop: 'title', type: 'string | ReactNode', category: 'Core & Layout', description: 'Title rendered on the left side of the table header bar.' },
  { prop: 'actions', type: 'ReactNode | ReactNode[]', category: 'Core & Layout', description: 'Custom actions rendered on the right side of the header bar.' },
  { prop: 'subHeader', type: 'ReactNode', category: 'Core & Layout', description: 'Optional sub-header content bar displayed beneath the main header.' },
  { prop: 'subHeaderAlign', type: '"left" | "center" | "right"', defaultValue: '"right"', category: 'Core & Layout', description: 'Horizontal alignment for subHeader content.' },
  { prop: 'subHeaderWrap', type: 'boolean', defaultValue: 'true', category: 'Core & Layout', description: 'Allow subHeader items to wrap across lines.' },
  { prop: 'noHeader', type: 'boolean', defaultValue: 'false', category: 'Core & Layout', description: 'Hide the top title and toolbar header completely.' },
  { prop: 'noTableHead', type: 'boolean', defaultValue: 'false', category: 'Core & Layout', description: 'Hide the column header <thead> row.' },
  { prop: 'persistTableHead', type: 'boolean', defaultValue: 'false', category: 'Core & Layout', description: 'Keep column headers visible even when the dataset is empty.' },
  { prop: 'dense', type: 'boolean', defaultValue: 'false', category: 'Core & Layout', description: 'Compact row padding override.' },
  { prop: 'responsive', type: 'boolean', defaultValue: 'true', category: 'Core & Layout', description: 'Wraps the table inside a horizontally scrollable container.' },
  { prop: 'responsiveLayout', type: "'auto' | 'scroll' | 'cards'", defaultValue: "'auto'", category: 'Core & Layout', description: 'Controls narrow-container layout: auto switches to stacked mobile cards below mobileBreakpoint with a toolbar Cards/Table toggle, scroll keeps horizontal scrolling, and cards always renders stacked cards.' },
  { prop: 'mobileBreakpoint', type: 'number', defaultValue: '640', category: 'Core & Layout', description: 'Container width threshold (px, measured via ResizeObserver) below which responsiveLayout="auto" renders mobile stacked cards.' },
  { prop: 'fixedHeader', type: 'boolean', defaultValue: 'false', category: 'Core & Layout', description: 'Keeps the column header sticky at the top during vertical scroll.' },
  { prop: 'fixedHeaderScrollHeight', type: 'string', defaultValue: '"100vh"', category: 'Core & Layout', description: 'Maximum height of the scroll container when fixedHeader is true.' },
  { prop: 'direction', type: '"ltr" | "rtl" | "auto"', defaultValue: '"ltr"', category: 'Core & Layout', description: 'Text direction applied to the root grid wrapper.' },
  { prop: 'disabled', type: 'boolean', defaultValue: 'false', category: 'Core & Layout', description: 'Disables sorting, search, selection, pagination, and interactive toolbar controls.' },
  { prop: 'showRowNumbers', type: 'boolean', defaultValue: 'false', category: 'Core & Layout', description: 'Renders a 1-based # row index column in table and mobile card layouts.' },
  { prop: 'highlightSearch', type: 'boolean', defaultValue: 'true', category: 'Core & Layout', description: 'Automatically highlights matching global search substrings inside text and numeric cells.' },
  { prop: 'showStatusBar', type: 'boolean', defaultValue: 'false', category: 'Core & Layout', description: 'Renders a spreadsheet-style bottom status bar showing row counts, selection count, and live numeric Sum, Avg, Min, and Max.' },

  // Enterprise Productivity
  { prop: 'quickFilters', type: 'QuickFilter<T>[]', category: 'Enterprise Productivity', description: 'Segmented filter buttons above the table ({ id, label, predicate }) with live match counts and an All reset button.' },
  { prop: 'bulkActions', type: 'BulkAction<T>[]', category: 'Enterprise Productivity', description: 'Contextual batch action buttons ({ id, label, icon, variant, onClick }) displayed in a dedicated bar whenever rows are selected.' },
  { prop: 'onAddRow', type: '(newRow?: Partial<T>) => void', category: 'Enterprise Productivity', description: 'Adds a "+ Add Row" toolbar button. When accepting a parameter, opens an auto-generated form modal built from columns.' },
  { prop: 'addRowLabel', type: 'string', defaultValue: '"Add Row"', category: 'Enterprise Productivity', description: 'Custom label for the Add Row button and modal title.' },
  { prop: 'onDeleteRows', type: '(selectedRows: T[]) => void', category: 'Enterprise Productivity', description: 'Shows a "Delete (N)" button in the contextual bulk actions bar and calls this handler with selected rows.' },
  { prop: 'enableContextMenu', type: 'boolean', defaultValue: 'true (with items)', category: 'Enterprise Productivity', description: 'Enables right-click row context menu with Copy Row JSON, Inspect in Side Preview, Toggle Bookmark, and custom items.' },
  { prop: 'rowContextMenu', type: 'RowContextMenuItem<T>[]', category: 'Enterprise Productivity', description: 'Custom menu actions ({ id, label, icon, danger, onClick }) appended to the right-click row context menu.' },
  { prop: 'enableKeyboardNavigation', type: 'boolean', defaultValue: 'false', category: 'Enterprise Productivity', description: 'Enables ArrowUp/Down/Left/Right cell focus navigation, Space to toggle row selection, Enter to edit/preview, and Escape to clear.' },
  { prop: 'fullscreenToggle', type: 'boolean', defaultValue: 'false', category: 'Enterprise Productivity', description: 'Renders a fullscreen maximize/minimize button in the toolbar and supports Escape to exit fullscreen.' },
  { prop: 'persistStateKey', type: 'string', category: 'Enterprise Productivity', description: 'Automatically saves and restores density, visible columns, column order, column widths, pinned columns, rows per page, and groupBy in localStorage.' },
  { prop: 'groupBy', type: 'string', category: 'Enterprise Productivity', description: 'Groups rows into collapsible sections with item counts by column ID or field key.' },
  { prop: 'resizable', type: 'boolean', defaultValue: 'false', category: 'Enterprise Productivity', description: 'Enables drag handles on column headers for live column width resizing; double-clicking a handle resets the column back to auto-fit.' },
  { prop: 'onCellEdit', type: '(row: T, value: string, column: TableColumn<T>) => void', category: 'Enterprise Productivity', description: 'Callback fired when a user commits an inline cell edit.' },
  { prop: 'virtualize', type: 'boolean', defaultValue: 'false', category: 'Enterprise Productivity', description: 'Enables zero-dependency windowed row virtualization for smooth scrolling across large unpaginated datasets.' },
  { prop: 'virtualRowHeight / virtualOverscan', type: 'number / number', defaultValue: '48 / 8', category: 'Enterprise Productivity', description: 'Configures estimated row height (px) and offscreen buffer row count when virtualize is enabled.' },
  { prop: 'onImportRows', type: '(rows: Partial<T>[]) => void', category: 'Enterprise Productivity', description: 'Enables a built-in "Import CSV" toolbar button and file upload/paste modal with auto column mapping and live preview.' },
  { prop: 'plugins', type: 'DataTablePlugin<T>[]', category: 'Enterprise Productivity', description: 'Modular plugins injecting toolbar controls, row actions, or data/column transforms.' },
  { prop: 'renderSidePreview', type: '(row: T, onClose: () => void) => ReactNode', category: 'Enterprise Productivity', description: 'Custom renderer for the slide-over inspection drawer when config.sidePreview is enabled.' },

  // Column Definition
  { prop: 'column.id', type: 'string | number', required: true, category: 'Column Definition', description: 'Unique column identifier used for sorting, filtering, resizing, pinning, and state persistence.' },
  { prop: 'column.name', type: 'ReactNode', required: true, category: 'Column Definition', description: 'Column header label.' },
  { prop: 'column.selector', type: '(row: T, index?: number) => any', required: true, category: 'Column Definition', description: 'Accessor function returning the raw value for sorting, filtering, export, and aggregation.' },
  { prop: 'column.aggregation', type: "'sum' | 'avg' | 'min' | 'max' | 'count' | 'unique' | ((rows: T[]) => ReactNode)", category: 'Column Definition', description: 'Automatically computes and renders column totals, averages, min, max, count, unique counts, or custom reducers in the table footer.' },
  { prop: 'column.aggregationLabel', type: 'string', category: 'Column Definition', description: 'Optional prefix label shown before the computed footer aggregation (e.g. "Total" or "Avg").' },
  { prop: 'column.pinned', type: "'left' | 'right' | null", category: 'Column Definition', description: 'Pins the column as sticky left or right during horizontal scrolling.' },
  { prop: 'column.copyable', type: 'boolean', defaultValue: 'false', category: 'Column Definition', description: 'Displays a hover-revealed one-click copy icon with confirmation feedback inside each cell of this column.' },
  { prop: 'column.editable / editor', type: 'boolean / CellEditor<T>', category: 'Column Definition', description: 'Enables inline editing with text, number, date, checkbox, select dropdown, or custom JSX editor.' },
  { prop: 'column.filterable / filterType', type: "boolean / 'text' | 'number' | 'date'", category: 'Column Definition', description: 'Enables column header filter popover with string, numeric comparison, or date operators.' },
  { prop: 'column.sparkline / heatmap', type: 'boolean', category: 'Column Definition', description: 'Renders inline SVG trend sparklines or numeric color-scale heatmaps inside cells.' },
  { prop: 'column.cell / format', type: 'Function', category: 'Column Definition', description: 'Custom ReactNode cell renderer or formatted display function while preserving raw selector values.' },
  { prop: 'column.right / center / hide / omit', type: 'boolean / Media', category: 'Column Definition', description: 'Controls text alignment, responsive breakpoint auto-hiding (sm/md/lg/px), or column omission.' },

  // Universal AI & LLM
  { prop: 'llmConfig', type: 'LLMConfig<T>', category: 'Universal AI & LLM', description: 'Universal provider config supporting openai, anthropic, gemini (gemini-3.8-flash), ollama, openrouter, custom endpoint, or complete(prompt, context) callback.' },
  { prop: 'enableAiQuery', type: 'boolean', defaultValue: 'false', category: 'Universal AI & LLM', description: 'Adds the natural-language AI search bar in the toolbar.' },
  { prop: 'onAiQuery', type: '(query: string) => Promise<T[]>', category: 'Universal AI & LLM', description: 'Optional override for natural language filtering. Defaults to llmConfig + local analytical fallback.' },
  { prop: 'enableAiInsights', type: 'boolean', defaultValue: 'false', category: 'Universal AI & LLM', description: 'Enables the KPI Insights Dashboard generator in the toolbar.' },
  { prop: 'enableAiSummary', type: 'boolean', defaultValue: 'false', category: 'Universal AI & LLM', description: 'Enables Executive AI Summary generation and the interactive LLM Provider Copilot Modal.' },

  // External Summary
  { prop: 'externalSummary', type: "boolean | 'top' | 'bottom' | 'both'", defaultValue: 'false', category: 'External Summary', description: 'Automatically renders <TableSummary /> outside the grid container (above, below, or both).' },
  { prop: 'externalSummaryTitle', type: 'ReactNode', category: 'External Summary', description: 'Heading displayed on the built-in external TableSummary panel.' },
  { prop: 'externalSummaryVariant', type: "'detailed' | 'cards' | 'compact' | 'sidebar'", defaultValue: "'detailed'", category: 'External Summary', description: 'Visual layout preset for the external summary panel.' },
  { prop: 'onSummaryChange', type: '(summary: ExternalSummaryData<T>) => void', category: 'External Summary', description: 'Emits live row counts, selection count, numeric column stats (sum/avg/min/max), categorical counts, and executive summary whenever grid state updates.' },
  { prop: '<TableSummary />', type: 'Component', category: 'External Summary', description: 'Standalone exported component accepting { summaryData, data, columns, selectedRows, title, variant, llmConfig, theme } for rendering summaries anywhere outside the table.' },
  { prop: 'computeExternalSummary', type: 'Function', category: 'External Summary', description: 'Pure helper computing ExternalSummaryData<T> for custom dashboards or server-side summaries.' },

  // Sorting & Pagination
  { prop: 'sortable', type: 'boolean', defaultValue: 'false', category: 'Sorting & Pagination', description: 'Enables sorting globally across columns unless overridden per column.' },
  { prop: 'sortMulti', type: 'boolean', defaultValue: 'false', category: 'Sorting & Pagination', description: 'Allows Shift/Ctrl/Cmd + Click multi-column priority sorting.' },
  { prop: 'defaultSortFieldId', type: 'string | number', category: 'Sorting & Pagination', description: 'Initial column ID sorted on first mount.' },
  { prop: 'defaultSortAsc', type: 'boolean', defaultValue: 'true', category: 'Sorting & Pagination', description: 'Initial sort direction for defaultSortFieldId.' },
  { prop: 'sortServer / onSort', type: 'boolean / Function', category: 'Sorting & Pagination', description: 'Defers sorting to your backend API and emits sorted column metadata.' },
  { prop: 'pagination', type: 'boolean', defaultValue: 'false', category: 'Sorting & Pagination', description: 'Enables built-in pagination controls.' },
  { prop: 'paginationPerPage', type: 'number', defaultValue: '10', category: 'Sorting & Pagination', description: 'Default rows per page.' },
  { prop: 'paginationPosition', type: "'top' | 'bottom' | 'both'", defaultValue: '"bottom"', category: 'Sorting & Pagination', description: 'Where the pagination bar is rendered.' },
  { prop: 'paginationServer / paginationTotalRows', type: 'boolean / number', category: 'Sorting & Pagination', description: 'Enables server-driven pagination with onChangePage and onChangeRowsPerPage.' },
  { prop: 'showFooter / footerComponent', type: 'boolean / ComponentType', category: 'Sorting & Pagination', description: 'Controls footer visibility or replaces the default footer with a custom component.' },

  // Selection & Expandable
  { prop: 'selectableRows', type: 'boolean', defaultValue: 'false', category: 'Selection & Expandable', description: 'Enables row selection checkboxes.' },
  { prop: 'selectableRowsSingle', type: 'boolean', defaultValue: 'false', category: 'Selection & Expandable', description: 'Restricts selection to a single active row.' },
  { prop: 'selectableRowsRange', type: 'boolean', defaultValue: 'true', category: 'Selection & Expandable', description: 'Enables Shift + Click range selection.' },
  { prop: 'selectedRows / onSelectedRowsChange', type: 'T[] / Function', category: 'Selection & Expandable', description: 'Controlled selected rows array and change listener receiving { allSelected, selectedCount, selectedRows }.' },
  { prop: 'expandableRows', type: 'boolean', defaultValue: 'false', category: 'Selection & Expandable', description: 'Enables expandable master-detail row drawers.' },
  { prop: 'expandableRowsComponent', type: 'ComponentType<{ data: T }>', category: 'Selection & Expandable', description: 'Custom React component rendered inside each expanded row drawer.' },
  { prop: 'expandOnRowClicked / onRowExpandToggled', type: 'boolean / Function', category: 'Selection & Expandable', description: 'Expand rows on row click and listen to expand/collapse transitions.' },

  // Row Events & Styling
  { prop: 'onRowClicked / onRowDoubleClicked / onRowMiddleClicked', type: 'Function', category: 'Row Events & Styling', description: 'Row mouse click event handlers receiving (row, mouseEvent).' },
  { prop: 'theme / createTheme()', type: 'string / Function', category: 'Row Events & Styling', description: 'Built-in light/dark themes or custom themes registered via createTheme().' },
  { prop: 'customStyles', type: 'TableStyles', category: 'Row Events & Styling', description: 'Granular inline style overrides for header, headRow, headCells, rows, cells, footer, and pagination.' },
  { prop: 'conditionalRowStyles', type: 'ConditionalStyles<T>[]', category: 'Row Events & Styling', description: 'Applies dynamic styles or CSS classes to rows matching a when(row) predicate.' },
  { prop: 'striped / highlightOnHover / pointerOnHover', type: 'boolean', category: 'Row Events & Styling', description: 'Row zebra striping, hover highlights, and pointer cursor helpers.' },
  { prop: 'columnSeparator / headerSeparator', type: 'boolean | "subtle" | "full"', category: 'Row Events & Styling', description: 'Vertical hairline or full-height dividers between cells and header columns.' },
  { prop: 'progressPending / noDataComponent', type: 'boolean / ReactNode', category: 'Row Events & Styling', description: 'Shimmer loading skeleton state and custom empty-state renderer.' },

  // Ref Handle & Hooks
  { prop: 'ref.current.clearSelectedRows()', type: '() => void', category: 'Ref Handle & Hooks', description: 'Imperatively clears all selected rows.' },
  { prop: 'ref.current.selectAll()', type: '() => void', category: 'Ref Handle & Hooks', description: 'Imperatively selects all non-disabled rows in the filtered view.' },
  { prop: 'ref.current.expandAllRows() / collapseAllRows()', type: '() => void', category: 'Ref Handle & Hooks', description: 'Imperatively expands or collapses all expandable rows in the active view.' },
  { prop: 'ref.current.resetFilters()', type: '() => void', category: 'Ref Handle & Hooks', description: 'Clears global search, column filters, quick filters, AI filter, bookmarks filter, and grouping.' },
  { prop: 'ref.current.resetLayout()', type: '() => void', category: 'Ref Handle & Hooks', description: 'Resets column order, visibility, widths, pinning, density, and persistStateKey localStorage.' },
  { prop: 'ref.current.setSearch(query)', type: '(query: string) => void', category: 'Ref Handle & Hooks', description: 'Sets the global search query programmatically.' },
  { prop: 'ref.current.setGroupBy(columnId)', type: '(columnId: string | null) => void', category: 'Ref Handle & Hooks', description: 'Programmatically sets or clears active row grouping.' },
  { prop: 'ref.current.exportCSV() / exportJSON() / exportMarkdown() / exportHTML()', type: '() => void', category: 'Ref Handle & Hooks', description: 'Triggers CSV, JSON, Markdown, or standalone styled HTML file download programmatically.' },
  { prop: 'ref.current.copyAsMarkdown()', type: '() => Promise<boolean>', category: 'Ref Handle & Hooks', description: 'Copies the current filtered dataset as a Markdown table to the clipboard.' },
  { prop: 'ref.current.undoLastEdit()', type: '() => boolean', category: 'Ref Handle & Hooks', description: 'Reverts the most recent inline cell edit via onCellEdit (also bound to Ctrl+Z).' },
  { prop: 'ref.current.importCSV(csvText)', type: '(csvText: string) => Partial<T>[]', category: 'Ref Handle & Hooks', description: 'Parses CSV/TSV text, auto-maps columns, and emits onImportRows.' },
  { prop: 'ref.current.scrollToRow(index)', type: '(index: number) => void', category: 'Ref Handle & Hooks', description: 'Smoothly scrolls the table viewport to the target row index.' },
  { prop: 'ref.current.goToPage(page)', type: '(page: number) => void', category: 'Ref Handle & Hooks', description: 'Programmatically navigates to the specified 1-based page number.' },
  { prop: 'ref.current.getSelectedRows() / getFilteredData()', type: '() => T[]', category: 'Ref Handle & Hooks', description: 'Returns selected rows or current filtered & sorted rows on demand.' },
  { prop: 'ref.current.getSummaryData()', type: '() => ExternalSummaryData<T>', category: 'Ref Handle & Hooks', description: 'Returns live computed summary metrics and column aggregations.' },
  { prop: 'ref.current.toggleFullscreen()', type: '() => void', category: 'Ref Handle & Hooks', description: 'Toggles fullscreen mode on the grid.' },
  { prop: 'parseCSV(csvText)', type: 'Function', category: 'Ref Handle & Hooks', description: 'Zero-dependency RFC-4180 CSV/TSV parser exported by @enterprisegrid/grid.' },
  { prop: 'useColumnVisibility / useTableExport', type: 'Hooks', category: 'Ref Handle & Hooks', description: 'Headless React hooks exported by @enterprisegrid/grid for external column toggles and CSV/JSON export.' },
];

const CATEGORIES = [
  'All',
  'Core & Layout',
  'Enterprise Productivity',
  'Column Definition',
  'Universal AI & LLM',
  'External Summary',
  'Sorting & Pagination',
  'Selection & Expandable',
  'Row Events & Styling',
  'Ref Handle & Hooks',
];

const TYPE_DEFINITIONS = `export interface DataTableHandle<T = any> {
  clearSort: () => void;
  clearSelectedRows: () => void;
  selectAll: () => void;
  expandAllRows: () => void;
  collapseAllRows: () => void;
  resetFilters: () => void;
  resetLayout: () => void;
  setSearch: (query: string) => void;
  setGroupBy: (columnId: string | null) => void;
  exportCSV: () => void;
  exportJSON: () => void;
  exportMarkdown: () => void;
  exportHTML: () => void;
  copyAsMarkdown: () => Promise<boolean>;
  undoLastEdit: () => boolean;
  importCSV: (csvText: string) => Partial<T>[];
  scrollToRow: (index: number) => void;
  goToPage: (page: number) => void;
  getSelectedRows: () => T[];
  getFilteredData: () => T[];
  getSummaryData: () => ExternalSummaryData<T>;
  toggleFullscreen: () => void;
}

export interface QuickFilter<T> {
  id: string;
  label: string;
  predicate: (row: T) => boolean;
}

export interface BulkAction<T> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'danger';
  onClick: (selectedRows: T[], clearSelection: () => void) => void;
}

export interface RowContextMenuItem<T> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: (row: T, rowIndex: number) => void;
}

export interface LLMConfig<T = any> {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter' | 'custom' | 'local';
  model?: string;
  apiKey?: string;
  endpoint?: string;
  headers?: Record<string, string>;
  systemPrompt?: string;
  fallbackToLocal?: boolean;
  complete?: (prompt: string, context: { task: 'query' | 'insights' | 'summary' | 'chat'; schema: any[]; sampleRows: T[]; totalRows: number; systemPrompt: string }) => Promise<string>;
}`;

export default function ApiPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [reqFilter, setReqFilter] = useState<'all' | 'required'>('all');
  const [copiedProp, setCopiedProp] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: API_ENTRIES.length };
    for (const entry of API_ENTRIES) {
      counts[entry.category] = (counts[entry.category] || 0) + 1;
    }
    return counts;
  }, []);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return API_ENTRIES.filter((entry) => {
      const matchesCat = selectedCategory === 'All' || entry.category === selectedCategory;
      if (!matchesCat) return false;
      if (reqFilter === 'required' && !entry.required) return false;
      if (!q) return true;
      return (
        entry.prop.toLowerCase().includes(q) ||
        entry.type.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q)
      );
    });
  }, [search, selectedCategory, reqFilter]);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, ApiEntry[]> = {};
    filteredEntries.forEach((entry) => {
      if (!groups[entry.category]) groups[entry.category] = [];
      groups[entry.category].push(entry);
    });
    return groups;
  }, [filteredEntries]);

  const handleCopyProp = async (prop: string) => {
    try {
      await navigator.clipboard?.writeText(prop);
      setCopiedProp(prop);
      setTimeout(() => setCopiedProp(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/70">
      <SEO
        title="API Reference"
        description="Complete searchable API Reference for @enterprisegrid/grid: props, TableColumn options, LLMConfig, External TableSummary, DataTableHandle ref methods, and hooks."
        url="https://enterprisegrid.io/api"
        keywords="EnterpriseGrid API, React table props, TableColumn TypeScript, LLMConfig, TableSummary, DataTableHandle"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: 'EnterpriseGrid API Reference',
          description: 'Complete searchable API Reference for @enterprisegrid/grid.',
          audience: { '@type': 'Audience', audienceType: 'Developers' },
          about: {
            '@type': 'SoftwareApplication',
            name: 'EnterpriseGrid',
            applicationCategory: 'DeveloperApplication',
          },
        }}
      />

      <div className="container mx-auto px-4 sm:px-8 py-10 max-w-7xl flex-1">
        <div className="mb-8 border-b border-slate-200 pb-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 mb-3">
            <span className="font-mono text-indigo-600 font-semibold">@enterprisegrid/grid</span>
            <span aria-hidden="true">·</span>
            <span>TypeScript API Reference</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{API_ENTRIES.length} documented exports &amp; props</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-3">
            API Reference
          </h1>
          <p className="text-base sm:text-[17px] text-slate-600 max-w-[68ch] leading-[1.75]">
            Complete reference for <code>&lt;DataTable /&gt;</code> props, <code>TableColumn&lt;T&gt;</code> definitions, <code>&lt;TableSummary /&gt;</code>, <code>llmConfig</code>, imperative ref methods, and exported hooks.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Desktop Sticky Category Sidebar */}
          <aside className="hidden lg:block w-60 shrink-0 sticky top-6">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5">
                Categories
              </div>
              <nav aria-label="API categories" className="space-y-0.5 mt-1">
                {CATEGORIES.map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      <span
                        className={`text-xs font-mono tabular-nums ml-2 shrink-0 ${
                          isActive ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {categoryCounts[cat] || 0}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main API Content */}
          <div className="flex-1 min-w-0 w-full">
            {/* Search & Filters Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search props, types, or descriptions (press / to focus)..."
                    aria-label="Search API reference"
                    className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear API search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setReqFilter('all')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        reqFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      All Props
                    </button>
                    <button
                      type="button"
                      onClick={() => setReqFilter('required')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        reqFilter === 'required' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Required Only
                    </button>
                  </div>

                  <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                    {filteredEntries.length} / {API_ENTRIES.length}
                  </span>
                </div>
              </div>

              {/* Mobile / Tablet Category Selector */}
              <div className="flex lg:hidden flex-wrap gap-1.5 pt-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* API Matrix Table */}
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs mb-10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider w-60">
                      Property / Export
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider w-52">
                      Type
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider w-32">
                      Default / Req
                    </th>
                    <th className="py-3.5 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                  {Object.keys(groupedEntries).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center">
                        <p className="text-slate-600 text-sm mb-3">
                          No API properties matched "{search}".
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setSelectedCategory('All');
                            setReqFilter('all');
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                        >
                          Reset Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    Object.entries(groupedEntries).map(([cat, entries]) => (
                      <React.Fragment key={cat}>
                        <tr className="bg-slate-50/90 border-y border-slate-200">
                          <td
                            colSpan={4}
                            className="px-4 py-2.5 font-display font-bold text-slate-800 text-xs tracking-wider uppercase"
                          >
                            {cat} <span className="font-mono text-slate-400 font-normal ml-1 tabular-nums">({entries.length})</span>
                          </td>
                        </tr>
                        {entries.map((entry) => (
                          <tr key={`${cat}-${entry.prop}`} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-4 font-mono text-[13px] font-semibold text-indigo-700 align-top">
                              <div className="flex items-start justify-between gap-2 group">
                                <span className="break-words leading-[1.6]">{entry.prop}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyProp(entry.prop)}
                                  title={`Copy ${entry.prop}`}
                                  aria-label={`Copy ${entry.prop}`}
                                  className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-70 group-hover:opacity-100 transition-all shrink-0"
                                >
                                  {copiedProp === entry.prop ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-[12.5px] text-amber-800 align-top break-words leading-[1.65]">
                              {entry.type}
                            </td>
                            <td className="p-4 font-mono text-xs align-top leading-[1.65]">
                              {entry.required ? (
                                <span className="font-bold text-emerald-700 text-xs">
                                  Required
                                </span>
                              ) : entry.defaultValue ? (
                                <span className="text-slate-600 text-xs">{entry.defaultValue}</span>
                              ) : (
                                <span className="text-slate-400 text-xs">Optional</span>
                              )}
                            </td>
                            <td className="p-4 text-[14.5px] text-slate-600 leading-[1.7] align-top">
                              {entry.description}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Core TypeScript Interfaces Reference */}
            <section className="mb-8">
              <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">
                Core TypeScript Interfaces
              </h2>
              <p className="text-[15px] text-slate-600 mb-4 leading-[1.75]">
                All interfaces and generic types are exported directly from <code>@enterprisegrid/grid</code>.
              </p>
              <LiveCodeEditor language="typescript" title="types.d.ts">
                {TYPE_DEFINITIONS}
              </LiveCodeEditor>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
