import React, { useState, useMemo, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  ChevronDown, Search, ChevronLeft, ChevronRight, Settings2, Download, Eye, EyeOff,
  LayoutGrid, ChevronsLeft, ChevronsRight, GripVertical, Map as MapIcon, MapPin,
  Calendar as CalendarIcon, Save, Bookmark, Share2, History, Undo2, Redo2, Clock,
  MessageSquare, Send, AtSign, X, Star, Command, Terminal, Keyboard, Copy, Check,
  Cloud, CloudOff, RefreshCw, Trello, Sparkles, Pin, Layers, Filter, Bot, FileText,
  Maximize2, Minimize2, Plus, Trash2, Printer, Upload, RotateCcw, TableIcon
} from './icons';
import { motion, AnimatePresence } from './motionFallback';
import { NativeCalendarView, NativeMapView } from './NativeViews';
import { Sparkline, SparklineConfig } from './Sparkline';
import {
  LLMConfig,
  LLMProviderType,
  LLMInsightItem,
  executeLLMTask,
  executeSmartLocalQuery,
  generateSmartLocalInsights,
  generateSmartLocalSummary,
} from './llmAdapter';
import {
  TableSummary,
  computeExternalSummary,
  ExternalSummaryData,
} from './TableSummary';

const DANGEROUS_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Neutralize spreadsheet formula injection (CSV/DDE injection) when exporting to CSV.
 * Prefixes cells starting with =, +, -, @, tab, or carriage return (excluding plain negative numbers)
 * with a single quote and properly escapes double quotes per RFC-4180.
 */
function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  let strVal = String(val);
  if (/^[=+\-@\t\r]/.test(strVal) && !/^-\d+(\.\d+)?$/.test(strVal.trim())) {
    strVal = `'${strVal}`;
  }
  return strVal.includes(',') || strVal.includes('"') || strVal.includes('\n') || strVal.includes('\r')
    ? `"${strVal.replace(/"/g, '""')}"`
    : strVal;
}

/**
 * Zero-dependency RFC-4180 compliant CSV / TSV parser.
 * Automatically detects comma vs tab delimiter and supports quoted multi-line fields and escaped quotes ("").
 */
export function parseCSV(csvText: string): Record<string, string>[] {
  if (!csvText || typeof csvText !== 'string') return [];
  const normalized = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const firstNewline = normalized.indexOf('\n');
  const firstLine = firstNewline === -1 ? normalized : normalized.slice(0, firstNewline);
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\n') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }
  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell !== '')) {
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h, idx) => {
    const cleanHeader = (h || `column_${idx + 1}`).trim();
    return DANGEROUS_OBJECT_KEYS.has(cleanHeader) ? `column_${idx + 1}` : cleanHeader;
  });
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (!DANGEROUS_OBJECT_KEYS.has(header)) {
        record[header] = cells[idx] ?? '';
      }
    });
    return record;
  });
}

export type SortFunction<T> = (rows: T[], column: TableColumn<T>, direction: 'asc' | 'desc') => T[];

export interface ActiveSort<T> {
  column: TableColumn<T>;
  id: string | number;
  direction: 'asc' | 'desc';
}

export interface DataTableHandle<T = any> {
  clearSort: () => void;
  clearSelectedRows: () => void;
  selectAll: () => void;
  expandAllRows: () => void;
  collapseAllRows: () => void;
  resetFilters: () => void;
  resetLayout: () => void;
  setSearch: (query: string) => void;
  setGroupBy: (columnId: string | null) => void;
  goToPage: (page: number) => void;
  exportCSV: () => void;
  exportJSON: () => void;
  exportMarkdown: () => void;
  exportHTML: () => void;
  copyAsMarkdown: () => Promise<boolean>;
  undoLastEdit: () => boolean;
  importCSV: (csvText: string) => Partial<T>[];
  scrollToRow: (index: number) => void;
  getSelectedRows: () => T[];
  getFilteredData: () => T[];
  getSummaryData: () => ExternalSummaryData<T>;
  toggleFullscreen: () => void;
}

export enum Media {
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
}

export enum Direction {
  LTR = 'ltr',
  RTL = 'rtl',
  AUTO = 'auto',
}

export enum Alignment {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export interface CustomCellEditorContext<T> {
  row: T;
  value: string;
  setValue: (next: string) => void;
  commit: (value?: string) => void;
  cancel: () => void;
  column: TableColumn<T>;
}

export type CellEditor<T = unknown> =
  | { type: 'text'; placeholder?: string; }
  | { type: 'number'; placeholder?: string; min?: number; max?: number; step?: number; }
  | { type: 'date'; min?: string; max?: string; }
  | { type: 'checkbox'; }
  | { type: 'select'; options: Array<{ value: string; label: React.ReactNode }>; placeholder?: string; }
  | { type: 'custom'; render: (ctx: CustomCellEditorContext<T>) => React.ReactNode; };

export interface PaginationOptions {
  rowsPerPageText?: string;
  rangeSeparatorText?: string;
  noRowsPerPage?: boolean;
  selectAllRowsItem?: boolean;
  selectAllRowsItemText?: string;
}

export interface PaginationServerOptions {
  persistSelectedOnPageChange?: boolean;
  persistSelectedOnSort?: boolean;
}

export interface PaginationComponentProps {
  rowsPerPage: number;
  rowCount: number;
  currentPage: number;
  onChangePage: (page: number, totalRows: number) => void;
  onChangeRowsPerPage: (numRows: number, currentPage: number) => void;
}

export interface HeatmapConfig {
  min?: number;
  max?: number;
  colorScale?: string[] | 'blues' | 'greens' | 'reds' | 'amber' | 'purples' | 'slate';
  textContrast?: boolean;
}

export type TableColumn<T> = {
  id: string | number;
  name: React.ReactNode;
  selector: (row: T, index?: number) => any;
  cell?: (row: T, index: number, column: TableColumn<T>, id: string | number) => React.ReactNode;
  format?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  sortFunction?: (a: T, b: T) => number;
  sortField?: string;
  filterable?: boolean;
  filterType?: 'text' | 'number' | 'date';
  filterFunction?: (row: T, filter: any) => boolean;
  editable?: boolean;
  editor?: CellEditor<T>;
  validate?: (value: string, row: T, column: TableColumn<T>) => boolean | string;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  grow?: number;
  right?: boolean;
  center?: boolean;
  wrap?: boolean;
  compact?: boolean;
  button?: boolean;
  allowOverflow?: boolean;
  ignoreRowClick?: boolean;
  hide?: Media | number | string;
  omit?: boolean;
  reorder?: boolean;
  style?: React.CSSProperties;
  conditionalCellStyles?: ConditionalStyles<T>[];
  footer?: React.ReactNode | ((rows: T[]) => React.ReactNode);
  sparkline?: boolean;
  sparklineConfig?: SparklineConfig;
  heatmap?: boolean;
  heatmapConfig?: HeatmapConfig;
  pinned?: 'left' | 'right' | null;
  /** Render a hover-revealed one-click copy button inside each cell of this column */
  copyable?: boolean;
  /** Built-in column aggregation computed across filtered/sorted rows and rendered in footer */
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'unique' | ((rows: T[]) => React.ReactNode);
  /** Optional prefix label for auto-computed aggregation (e.g. "Total" or "Avg") */
  aggregationLabel?: string;
};

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

export interface FooterComponentProps<T> {
  rows: T[];
  columns: TableColumn<T>[];
}


export interface FilterState {
  value: string | number;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
}

export interface SavedView {
  id: string;
  name: string;
  state: {
    search: string;
    viewMode: 'table' | 'map' | 'calendar' | 'kanban' | 'gallery';
    density: 'compact' | 'normal' | 'spacious';
    columnsOrder: string[];
    visibleColumns: Record<string, boolean>;
    sortColumns: any[];
    internalFilters: Record<string, FilterState>;
    columnWidths: Record<string, number>;
  };
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  rowId: string | number;
  columnId: string;
  columnName: string;
  oldValue: any;
  newValue: any;
}

export interface ColumnGroup {
  id?: string;
  name: React.ReactNode;
  columnIds: (string | number)[];
  align?: 'left' | 'center' | 'right';
  reorder?: boolean;
}

export interface TableStyles {
  table?: {
    style?: React.CSSProperties;
  };
  tableWrapper?: {
    style?: React.CSSProperties;
  };
  responsiveWrapper?: {
    style?: React.CSSProperties;
  };
  header?: {
    style?: React.CSSProperties;
    fontColor?: string;
    fontSize?: string;
  };
  subHeader?: {
    style?: React.CSSProperties;
  };
  head?: {
    style?: React.CSSProperties;
  };
  headRow?: {
    style?: React.CSSProperties;
    denseStyle?: React.CSSProperties;
  };
  headCells?: {
    style?: React.CSSProperties;
    draggingStyle?: React.CSSProperties;
  };
  cells?: {
    style?: React.CSSProperties;
    draggingStyle?: React.CSSProperties;
  };
  rows?: {
    style?: React.CSSProperties;
    selectedHighlightStyle?: React.CSSProperties;
    highlightOnHoverStyle?: React.CSSProperties;
    stripedStyle?: React.CSSProperties;
    denseStyle?: React.CSSProperties;
  };
  expanderRow?: {
    style?: React.CSSProperties;
  };
  expanderCell?: {
    style?: React.CSSProperties;
  };
  expanderButton?: {
    style?: React.CSSProperties;
  };
  pagination?: {
    style?: React.CSSProperties;
    pageButtonsStyle?: React.CSSProperties;
  };
  footer?: {
    style?: React.CSSProperties;
  };
  footerCells?: {
    style?: React.CSSProperties;
  };
  noData?: {
    style?: React.CSSProperties;
  };
  progress?: {
    style?: React.CSSProperties;
  };
}

export interface ConditionalStyles<T> {
  when: (row: T) => boolean;
  style?: React.CSSProperties | ((row: T) => React.CSSProperties);
  classNames?: string[];
}

export interface Theme {
  text: {
    primary: string;
    secondary: string;
    disabled?: string;
  };
  background: {
    default: string;
  };
  context: {
    background: string;
    text: string;
  };
  divider: {
    default: string;
  };
  button: {
    default: string;
    hover: string;
    focus: string;
    disabled?: string;
  };
  action?: {
    button?: string;
    hover?: string;
    disabled?: string;
  };
  selected: {
    default: string;
    text: string;
  };
  highlightOnHover: {
    default: string;
    text: string;
  };
  striped: {
    default: string;
    text: string;
  };
  colorScheme?: 'light' | 'dark';
}

const defaultThemes: Record<string, Theme> = {
  default: {
    text: {
      primary: '#1e293b', // slate-800
      secondary: '#64748b', // slate-500
      disabled: '#94a3b8',
    },
    background: {
      default: '#ffffff',
    },
    context: {
      background: '#e0e7ff', // indigo-100
      text: '#4f46e5', // indigo-600
    },
    divider: {
      default: '#e2e8f0', // slate-200
    },
    button: {
      default: '#64748b',
      hover: 'rgba(0, 0, 0, 0.04)',
      focus: 'rgba(0, 0, 0, 0.12)',
      disabled: 'rgba(0, 0, 0, 0.12)',
    },
    selected: {
      default: '#e0e7ff',
      text: '#4f46e5',
    },
    highlightOnHover: {
      default: 'rgba(0, 0, 0, 0.04)',
      text: '#1e293b',
    },
    striped: {
      default: 'rgba(0, 0, 0, 0.015)',
      text: '#1e293b',
    },
    colorScheme: 'light',
  },
  dark: {
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      disabled: '#475569',
    },
    background: {
      default: '#0f172a',
    },
    context: {
      background: '#312e81',
      text: '#c7d2fe',
    },
    divider: {
      default: '#334155',
    },
    button: {
      default: '#94a3b8',
      hover: 'rgba(255, 255, 255, 0.04)',
      focus: 'rgba(255, 255, 255, 0.12)',
      disabled: 'rgba(255, 255, 255, 0.12)',
    },
    selected: {
      default: '#312e81',
      text: '#c7d2fe',
    },
    highlightOnHover: {
      default: 'rgba(255, 255, 255, 0.04)',
      text: '#f8fafc',
    },
    striped: {
      default: 'rgba(255, 255, 255, 0.02)',
      text: '#f8fafc',
    },
    colorScheme: 'dark',
  }
};

const themeRegistry: Record<string, Theme> = { ...defaultThemes };

export function createTheme(name: string, overrides: Partial<Theme> | any, inherit: string = 'default') {
  const base = themeRegistry[inherit] || themeRegistry.default;
  const text = { ...base.text, ...(overrides?.text || {}) };
  const background = { ...base.background, ...(overrides?.background || {}) };
  const context = { ...base.context, ...(overrides?.context || {}) };
  const divider = { ...base.divider, ...(overrides?.divider || {}) };
  const actionOverrides = overrides?.action ? {
    ...(overrides.action.button ? { default: overrides.action.button } : {}),
    ...(overrides.action.hover ? { hover: overrides.action.hover } : {}),
    ...(overrides.action.disabled ? { disabled: overrides.action.disabled } : {}),
  } : {};
  const button = { ...base.button, ...actionOverrides, ...(overrides?.button || {}) };
  const action = {
    button: button.default,
    hover: button.hover,
    disabled: button.disabled,
    ...(overrides?.action || {})
  };
  const selected = { ...base.selected, ...(overrides?.selected || {}) };
  const highlightOnHover = { ...base.highlightOnHover, ...(overrides?.highlightOnHover || {}) };
  const striped = { ...base.striped, ...(overrides?.striped || {}) };
  const colorScheme = overrides?.colorScheme || base.colorScheme;
  
  themeRegistry[name] = { text, background, context, divider, button, action, selected, highlightOnHover, striped, colorScheme };
  return themeRegistry[name];
}

export interface Localization {
  pagination?: {
    rowsPerPage?: string;
    nextPage?: string;
    previousPage?: string;
    firstPage?: string;
    lastPage?: string;
    nextPageAriaLabel?: string;
    previousPageAriaLabel?: string;
  };
  filter?: {
    apply?: string;
    clear?: string;
  };
  expandable?: {
    expand?: string;
    collapse?: string;
  };
}

export interface ColumnFilterOptions {
  /** @deprecated Use localization={{ filter: { apply, clear } }} instead */
  applyText?: string;
  /** @deprecated Use localization={{ filter: { apply, clear } }} instead */
  clearText?: string;
}

export interface ExpandableRowsOptions {
  /** @deprecated Use localization={{ expandable: { expand, collapse } }} instead */
  expandText?: string;
  /** @deprecated Use localization={{ expandable: { expand, collapse } }} instead */
  collapseText?: string;
}

export interface DataTablePlugin<T> {
  name: string;
  onInit?: (context: {
    data: T[];
    columns: TableColumn<T>[];
    setViewMode: (viewMode: 'table' | 'map' | 'calendar' | 'kanban' | 'gallery') => void;
    setDensity: (density: 'compact' | 'normal' | 'spacious') => void;
  }) => void;
  renderToolbarLeft?: () => React.ReactNode;
  renderToolbarRight?: () => React.ReactNode;
  renderRowAction?: (row: T, index: number) => React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  transformData?: (data: T[]) => T[];
  transformColumns?: (columns: TableColumn<T>[]) => TableColumn<T>[];
}

export interface SwipeAction<T> {
  key: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  onClick: (row: T, index: number) => void;
}

export interface MobileSwipeConfig<T> {
  left?: SwipeAction<T>[];
  right?: SwipeAction<T>[];
}

type Config = {
  pagination?: boolean;
  selectableRows?: boolean;
  sortable?: boolean;
  searchable?: boolean;
  exportable?: boolean;
  densityToggle?: boolean;
  columnVisibility?: boolean;
  animations?: boolean;
  mapView?: boolean;
  calendarView?: boolean;
  kanbanView?: boolean;
  galleryView?: boolean;
  savedViews?: boolean;
  shareableViews?: boolean;
  auditTrail?: boolean;
  timeTravel?: boolean;
  rowComments?: boolean;
  bookmarks?: boolean;
  commandPalette?: boolean;
  sidePreview?: boolean;
  swipeActions?: boolean;
  offlineEditing?: boolean;
  rowGrouping?: boolean;
  columnPinning?: boolean;
  aiQuery?: boolean;
  aiInsights?: boolean;
  aiSummary?: boolean;
  fullscreen?: boolean;
  keyboardNavigation?: boolean;
  contextMenu?: boolean;
};

interface DataTableProps<T> {
  id?: string;
  data?: T[];
  plugins?: DataTablePlugin<T>[];
  mobileSwipeActions?: MobileSwipeConfig<T>;
  renderSidePreview?: (row: T, onClose: () => void) => React.ReactNode;
  columns?: TableColumn<T>[];
  keyField?: string;
  progressPending?: boolean;
  progressComponent?: React.ReactNode;
  noDataComponent?: React.ReactNode;
  config?: Config;
  mapConfig?: {
    latField: string;
    lngField: string;
    titleField?: string;
  };
  calendarConfig?: {
    dateField: string;
    endDateField?: string;
    titleField?: string;
  };
  kanbanConfig?: {
    columnField: string;
    titleField?: string;
    descriptionField?: string;
    columns?: string[];
  };
  galleryConfig?: {
    titleField?: string;
    descriptionField?: string;
    imageField?: string;
  };
  localization?: Localization;
  columnFilterOptions?: ColumnFilterOptions;
  expandableRowsOptions?: ExpandableRowsOptions;

  // Layout & appearance props
  title?: string | React.ReactNode;
  actions?: React.ReactNode | React.ReactNode[];
  subHeader?: React.ReactNode;
  subHeaderAlign?: Alignment;
  subHeaderWrap?: boolean;
  noHeader?: boolean;
  noTableHead?: boolean;
  persistTableHead?: boolean;
  dense?: boolean;
  responsive?: boolean;
  /** Responsive mode on narrow containers/screens: 'auto' (switches to stacked cards below mobileBreakpoint with user toggle), 'scroll' (horizontal table scroll), or 'cards' (always stacked cards) */
  responsiveLayout?: 'auto' | 'scroll' | 'cards';
  /** Container width threshold (px) below which responsiveLayout="auto" renders mobile stacked cards (default: 640) */
  mobileBreakpoint?: number;
  fixedHeader?: boolean;
  fixedHeaderScrollHeight?: string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  direction?: Direction;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  disabled?: boolean;

  // Theming & styling props
  theme?: string;
  customStyles?: TableStyles;
  conditionalRowStyles?: ConditionalStyles<T>[];
  striped?: boolean;
  highlightOnHover?: boolean;
  pointerOnHover?: boolean;
  columnSeparator?: boolean | "subtle" | "full";
  headerSeparator?: boolean | "subtle" | "full";
  animateRows?: boolean;

  // Sorting props
  defaultSortFieldId?: string | number;
  defaultSortAsc?: boolean;
  sortServer?: boolean;
  sortMulti?: boolean;
  sortFunction?: SortFunction<T> | null;
  sortIcon?: React.ReactNode;
  onSort?: (
    column: TableColumn<T>,
    direction: 'asc' | 'desc' | 'clear',
    sortedRows: T[],
    sortColumns: ActiveSort<T>[]
  ) => void;

  // Pagination props
  pagination?: boolean;
  paginationPerPage?: number;
  paginationPosition?: 'top' | 'bottom' | 'both';
  paginationRowsPerPageOptions?: number[];
  paginationDefaultPage?: number;
  paginationPage?: number;
  paginationResetDefaultPage?: boolean;
  paginationTotalRows?: number;
  paginationServer?: boolean;
  paginationServerOptions?: PaginationServerOptions;
  paginationComponentOptions?: PaginationOptions;
  paginationComponent?: React.ComponentType<PaginationComponentProps>;
  paginationIcons?: {
    previous?: React.ReactNode;
    next?: React.ReactNode;
    first?: React.ReactNode;
    last?: React.ReactNode;
  };
  onChangePage?: (page: number, totalRows: number) => void;
  onChangeRowsPerPage?: (rowsPerPage: number, page: number) => void;
  footerComponent?: React.ComponentType<FooterComponentProps<T>>;
  showFooter?: boolean;

  // Selection Props
  selectableRows?: boolean;
  selectableRowsSingle?: boolean;
  selectableRowsNoSelectAll?: boolean;
  selectableRowsVisibleOnly?: boolean;
  selectableRowsHighlight?: boolean;
  selectableRowsRange?: boolean;
  selectableRowDisabled?: (row: T) => boolean;
  selectableRowSelected?: (row: T) => boolean;
  selectedRows?: T[];
  selectableRowsComponent?: "input" | React.ComponentType<any>;
  selectableRowsComponentProps?: Record<string, any>;
  onSelectedRowsChange?: (state: { allSelected: boolean; selectedCount: number; selectedRows: T[] }) => void;

  // Expandable Rows Props
  expandableRows?: boolean;
  expandableRowsComponent?: React.ComponentType<{ data: T } & any>;
  expandableRowsComponentProps?: Record<string, any>;
  expandableRowExpanded?: (row: T) => boolean;
  expandableRowDisabled?: (row: T) => boolean;
  expandableRowsHideExpander?: boolean;
  expandOnRowClicked?: boolean;
  expandOnRowDoubleClicked?: boolean;
  expandableInheritConditionalStyles?: boolean;
  expandableIcon?: { collapsed: React.ReactNode; expanded: React.ReactNode };
  onRowExpandToggled?: (expanded: boolean, row: T) => void;

  // Row Events Props
  onRowClicked?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowDoubleClicked?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowMiddleClicked?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowMouseEnter?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowMouseLeave?: (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;

  // Column Features Props
  resizable?: boolean;
  columnGroups?: ColumnGroup[];
  filterValues?: Record<string | number, FilterState>;
  onFilterChange?: (columnId: string | number, filter: FilterState) => void;
  onColumnOrderChange?: (columns: TableColumn<T>[]) => void;
  onColumnGroupOrderChange?: (groups: ColumnGroup[], columns: TableColumn<T>[]) => void;
  onCellEdit?: (row: T, value: string, column: TableColumn<T>) => void;

  // Legacy Top-Level Config Booleans
  sortable?: boolean;
  searchable?: boolean;
  exportable?: boolean;
  densityToggle?: boolean;
  columnVisibility?: boolean;
  animations?: boolean;

  // Built-in AI & Universal LLM Props
  llmConfig?: LLMConfig<T>;
  enableAiQuery?: boolean;
  onAiQuery?: (query: string) => Promise<T[]>;
  enableAiInsights?: boolean;
  onAiInsights?: (data: T[]) => Promise<Array<{ title: string; value: string; trend?: 'up' | 'down' | 'neutral'; description: string }>>;
  enableAiSummary?: boolean;
  onAiSummary?: (data: T[]) => Promise<string>;

  // Row Grouping Prop
  groupBy?: string;

  // Enterprise Productivity Props
  /** Segmented quick filter buttons displayed above the table */
  quickFilters?: QuickFilter<T>[];
  /** Contextual bulk action buttons shown when rows are selected */
  bulkActions?: BulkAction<T>[];
  /** Built-in bulk delete handler for selected rows */
  onDeleteRows?: (selectedRows: T[]) => void;
  /** Built-in "+ Add Row" modal/action handler */
  onAddRow?: (newRow?: Partial<T>) => void;
  /** Custom label for the Add Row button (default: "Add Row") */
  addRowLabel?: string;
  /** Enable right-click row context menu (default: true when rowContextMenu or config.contextMenu is set) */
  enableContextMenu?: boolean;
  /** Custom items appended to the row right-click context menu */
  rowContextMenu?: RowContextMenuItem<T>[];
  /** Enable arrow-key, Space, and Enter keyboard navigation across table cells */
  enableKeyboardNavigation?: boolean;
  /** Show Fullscreen toggle button in toolbar */
  fullscreenToggle?: boolean;
  /** Persist column order, visibility, widths, density, pinning, and page size in localStorage */
  persistStateKey?: string;

  /** Enable zero-dependency windowed row virtualization for large datasets */
  virtualize?: boolean;
  /** Estimated row height in pixels used during row virtualization (default: 48) */
  virtualRowHeight?: number;
  /** Extra rows rendered above and below the viewport when virtualize is enabled (default: 8) */
  virtualOverscan?: number;
  /** Built-in CSV/TSV file upload & paste import callback */
  onImportRows?: (rows: Partial<T>[]) => void;
  /** Render a 1-based '#' row number column in table and mobile card views */
  showRowNumbers?: boolean;
  /** Automatically highlight matching global search substrings inside text/numeric cells (default: true) */
  highlightSearch?: boolean;
  /** Render a bottom spreadsheet-style status bar showing row counts, selection count, and live numeric Sum/Avg/Min/Max */
  showStatusBar?: boolean;

  // External Table Data Summary Props
  /** Render a comprehensive TableSummary outside the table card ('top' | 'bottom' | 'both' | boolean) */
  externalSummary?: boolean | 'top' | 'bottom' | 'both';
  /** Custom title for the external summary panel */
  externalSummaryTitle?: React.ReactNode;
  /** Visual layout variant for the external summary panel */
  externalSummaryVariant?: 'detailed' | 'cards' | 'compact' | 'sidebar';
  /** Callback fired whenever active filtered/sorted/selected table summary metrics change */
  onSummaryChange?: (summary: ExternalSummaryData<T>) => void;

  // Pro Features & Supporter Donation Props
  /** Whether the user has donated to unlock supporter status (hides all PRO badges and donation notifications) */
  isDonated?: boolean;
  /** Callback fired when the user completes a donation via the built-in Pro supporter prompt */
  onDonate?: (amount: number) => void;
}

const DefaultSpinner = () => (
  <div className="flex flex-col items-center gap-2 p-8">
    <div className="w-8 h-8 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
    <span className="text-xs font-medium text-slate-500">Loading records...</span>
  </div>
);

const DefaultNoDataComponent = () => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="text-slate-300 mb-2">
      <LayoutGrid className="w-12 h-12 stroke-1" />
    </div>
    <h4 className="text-sm font-semibold text-slate-700">No data available</h4>
    <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">There are no records to display in this view.</p>
  </div>
);

interface AnimatePresenceWrapperProps {
  children: React.ReactNode;
  enabled: boolean;
}

const AnimatePresenceWrapper: React.FC<AnimatePresenceWrapperProps> = ({ children, enabled }) => {
  if (!enabled) {
    return <>{children}</>;
  }
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {children}
    </AnimatePresence>
  );
};

class SafeFeatureBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Optional feature degraded gracefully without crashing host grid
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

const DONATION_STORAGE_KEY = 'eg_pro_donated';
const DONATION_EVENT_NAME = 'eg-donation-changed';

export function isEnterpriseGridDonated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DONATION_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setEnterpriseGridDonated(donated: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (donated) {
      localStorage.setItem(DONATION_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(DONATION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent<boolean>(DONATION_EVENT_NAME, { detail: donated }));
}

const getNumericValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,%]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const colorPresets: Record<string, [string, string]> = {
  blues: ['#f0f9ff', '#1d4ed8'],
  greens: ['#f0fdf4', '#15803d'],
  reds: ['#fef2f2', '#b91c1c'],
  amber: ['#fffbeb', '#b45309'],
  purples: ['#faf5ff', '#6d28d9'],
  slate: ['#f8fafc', '#334155']
};

function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = color1.startsWith('#') ? color1.replace('#', '') : color1;
  const c2 = color2.startsWith('#') ? color2.replace('#', '') : color2;

  const parseHex = (hex: string) => {
    if (hex.length === 3) {
      return hex.split('').map(char => char + char).join('');
    }
    return hex;
  };

  const hex1 = parseHex(c1);
  const hex2 = parseHex(c2);

  const r1 = parseInt(hex1.substring(0, 2), 16) || 0;
  const g1 = parseInt(hex1.substring(2, 4), 16) || 0;
  const b1 = parseInt(hex1.substring(4, 6), 16) || 0;

  const r2 = parseInt(hex2.substring(0, 2), 16) || 0;
  const g2 = parseInt(hex2.substring(2, 4), 16) || 0;
  const b2 = parseInt(hex2.substring(4, 6), 16) || 0;

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  const rHex = Math.min(Math.max(r, 0), 255).toString(16).padStart(2, '0');
  const gHex = Math.min(Math.max(g, 0), 255).toString(16).padStart(2, '0');
  const bHex = Math.min(Math.max(b, 0), 255).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

function getHeatmapStyles(
  value: number,
  min: number,
  max: number,
  config?: HeatmapConfig
): React.CSSProperties {
  const scale = config?.colorScale || 'blues';
  let startColor = '#f0f9ff';
  let endColor = '#1d4ed8';

  if (Array.isArray(scale)) {
    if (scale.length >= 2) {
      startColor = scale[0];
      endColor = scale[scale.length - 1];
    } else if (scale.length === 1) {
      startColor = '#ffffff';
      endColor = scale[0];
    }
  } else if (typeof scale === 'string' && colorPresets[scale]) {
    [startColor, endColor] = colorPresets[scale];
  }

  let factor = 0;
  if (max > min) {
    factor = (value - min) / (max - min);
  }
  factor = Math.min(Math.max(factor, 0), 1);

  const bgColor = interpolateColor(startColor, endColor, factor);

  let textColor = undefined;
  if (config?.textContrast !== false) {
    const c = bgColor.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    textColor = yiq >= 128 ? '#1e293b' : '#ffffff';
  }

  return {
    backgroundColor: bgColor,
    color: textColor,
  };
}

async function safeFetchJson<R = any>(url: string, init?: RequestInit): Promise<R | null> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers?.get?.('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return null;
    }
    return (await res.json()) as R;
  } catch {
    return null;
  }
}

function DataTableInner<T extends Record<string, any>>({
  id,
  data,
  columns,
  plugins,
  mobileSwipeActions,
  renderSidePreview,
  keyField = 'id',
  progressPending = false,
  progressComponent,
  noDataComponent,
  config,
  mapConfig,
  calendarConfig,
  kanbanConfig,
  galleryConfig,

  // Layout & appearance defaults
  title,
  actions,
  subHeader,
  subHeaderAlign = Alignment.RIGHT,
  subHeaderWrap = true,
  noHeader = false,
  noTableHead = false,
  persistTableHead = false,
  dense = false,
  responsive = true,
  responsiveLayout = 'auto',
  mobileBreakpoint = 640,
  fixedHeader = false,
  fixedHeaderScrollHeight = '100vh',
  onScroll,
  direction = Direction.LTR,
  className = '',
  style = {},
  ariaLabel,
  disabled = false,

  // Theming & styling defaults
  theme = 'default',
  customStyles,
  conditionalRowStyles,
  striped = false,
  highlightOnHover = false,
  pointerOnHover = false,
  columnSeparator,
  headerSeparator = true,
  animateRows = false,

  // Sorting props
  defaultSortFieldId,
  defaultSortAsc = true,
  sortServer = false,
  sortMulti = false,
  sortFunction = null,
  sortIcon,
  onSort,

  // Pagination props
  pagination,
  paginationPerPage = 10,
  paginationPosition = 'bottom',
  paginationRowsPerPageOptions,
  paginationDefaultPage = 1,
  paginationPage,
  paginationResetDefaultPage,
  paginationTotalRows,
  paginationServer = false,
  paginationServerOptions,
  paginationComponentOptions,
  paginationComponent,
  paginationIcons,
  onChangePage,
  onChangeRowsPerPage,
  footerComponent,
  showFooter,

  // Selection Props
  selectableRows,
  selectableRowsSingle = false,
  selectableRowsNoSelectAll = false,
  selectableRowsVisibleOnly = false,
  selectableRowsHighlight = false,
  selectableRowsRange = true,
  selectableRowDisabled,
  selectableRowSelected,
  selectedRows: controlledSelectedRows,
  selectableRowsComponent,
  selectableRowsComponentProps,
  onSelectedRowsChange,

  // Expandable Rows Props
  expandableRows = false,
  expandableRowsComponent,
  expandableRowsComponentProps = {},
  expandableRowExpanded,
  expandableRowDisabled,
  expandableRowsHideExpander = false,
  expandOnRowClicked = false,
  expandOnRowDoubleClicked = false,
  expandableInheritConditionalStyles = false,
  expandableIcon,
  onRowExpandToggled,

  // Row Events Props
  onRowClicked,
  onRowDoubleClicked,
  onRowMiddleClicked,
  onRowMouseEnter,
  onRowMouseLeave,

  // Column Features Props
  resizable = false,
  columnGroups,
  filterValues,
  onFilterChange,
  onColumnOrderChange,
  onColumnGroupOrderChange,
  onCellEdit,
  localization,
  columnFilterOptions,
  expandableRowsOptions,

  // Legacy Top-Level Config Booleans
  sortable,
  searchable,
  exportable,
  densityToggle,
  columnVisibility,
  animations,

  // Built-in AI & Universal LLM Props
  llmConfig,
  enableAiQuery,
  onAiQuery,
  enableAiInsights,
  onAiInsights,
  enableAiSummary,
  onAiSummary,
  groupBy,
  quickFilters,
  bulkActions,
  onDeleteRows,
  onAddRow,
  addRowLabel = 'Add Row',
  enableContextMenu,
  rowContextMenu,
  enableKeyboardNavigation = false,
  fullscreenToggle = false,
  persistStateKey,
  virtualize = false,
  virtualRowHeight = 48,
  virtualOverscan = 8,
  onImportRows,
  showRowNumbers = false,
  highlightSearch = true,
  showStatusBar = false,
  externalSummary = false,
  externalSummaryTitle,
  externalSummaryVariant = 'detailed',
  onSummaryChange,
  isDonated: controlledIsDonated,
  onDonate,
}: DataTableProps<T>, ref: React.Ref<DataTableHandle<T>>) {
  const [localDonated, setLocalDonated] = useState<boolean>(() => isEnterpriseGridDonated());
  const [proNotificationFeature, setProNotificationFeature] = useState<string | null>(null);
  const [proNotificationDismissed, setProNotificationDismissed] = useState<boolean>(false);
  const [showDonationModal, setShowDonationModal] = useState<boolean>(false);
  const [selectedDonationAmount, setSelectedDonationAmount] = useState<number>(15);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleDonationChange = (e: Event) => {
      const customEv = e as CustomEvent<boolean>;
      const nextVal = typeof customEv.detail === 'boolean' ? customEv.detail : isEnterpriseGridDonated();
      setLocalDonated(nextVal);
      if (nextVal) {
        setProNotificationFeature(null);
        setShowDonationModal(false);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === DONATION_STORAGE_KEY) {
        const nextVal = e.newValue === 'true';
        setLocalDonated(nextVal);
        if (nextVal) {
          setProNotificationFeature(null);
          setShowDonationModal(false);
        }
      }
    };
    window.addEventListener(DONATION_EVENT_NAME, handleDonationChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(DONATION_EVENT_NAME, handleDonationChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const effectiveDonated = controlledIsDonated !== undefined ? controlledIsDonated : localDonated;

  const notifyProFeatureUsed = (featureLabel: string) => {
    if (effectiveDonated) return;
    setProNotificationFeature(featureLabel);
    setProNotificationDismissed(false);
  };

  const handleCompleteDonation = (amount: number = selectedDonationAmount) => {
    setEnterpriseGridDonated(true);
    setLocalDonated(true);
    setProNotificationFeature(null);
    setShowDonationModal(false);
    if (onDonate) {
      onDonate(amount);
    }
  };

  const renderProBadge = (variant: 'light' | 'solid' | 'mini' = 'light') => {
    if (effectiveDonated) return null;
    if (variant === 'mini') {
      return (
        <span className="ml-0.5 inline-flex items-center px-1 py-0 text-[8px] font-mono font-extrabold uppercase tracking-wider rounded bg-amber-400 text-slate-950 leading-tight select-none shrink-0">
          PRO
        </span>
      );
    }
    if (variant === 'solid') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-extrabold uppercase tracking-wider rounded bg-amber-300 text-slate-950 leading-none select-none shrink-0">
          PRO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-800 border border-amber-300 leading-none select-none shrink-0">
        PRO
      </span>
    );
  };

  const persistedState = useMemo(() => {
    if (typeof window === 'undefined' || !persistStateKey) return null;
    try {
      const raw = localStorage.getItem(`eg_state_${persistStateKey}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [persistStateKey]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeQuickFilterIds, setActiveQuickFilterIds] = useState<string[]>([]);
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    x: number;
    y: number;
    row: T;
    rowIndex: number;
    col?: TableColumn<T>;
  } | null>(null);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newRowDraft, setNewRowDraft] = useState<Record<string, string>>({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);
  const [cellEditHistory, setCellEditHistory] = useState<Array<{
    row: T;
    col: TableColumn<T>;
    oldValue: string;
    newValue: string;
  }>>([]);

  const rootContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [mobileViewOverride, setMobileViewOverride] = useState<'cards' | 'scroll' | null>(null);

  const tableScrollContainerRef = useRef<HTMLDivElement>(null);
  const [virtualScrollTop, setVirtualScrollTop] = useState(0);
  const [virtualContainerHeight, setVirtualContainerHeight] = useState(520);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const el = rootContainerRef.current;
    if (!el) return undefined;

    const measure = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        const entryWidth = entries[0]?.contentRect?.width;
        if (entryWidth && entryWidth > 0) {
          setContainerWidth(entryWidth);
        } else {
          measure();
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!virtualize || typeof window === 'undefined') return undefined;
    const el = tableScrollContainerRef.current;
    if (!el) return undefined;

    const updateHeight = () => {
      if (el.clientHeight > 0) {
        setVirtualContainerHeight(el.clientHeight);
      }
    };
    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [virtualize]);

  const isContextMenuActive =
    enableContextMenu !== undefined
      ? enableContextMenu
      : (config?.contextMenu ?? Boolean(rowContextMenu && rowContextMenu.length > 0));
  const isKeyboardNavActive = enableKeyboardNavigation || !!config?.keyboardNavigation;
  const isFullscreenEnabled = fullscreenToggle || !!config?.fullscreen;

  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const actualOnline = isOnline && !simulatedOffline;

  const [offlineChanges, setOfflineChanges] = useState<any[]>(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && id) {
      try {
        const saved = localStorage.getItem(`dt_offline_changes_${id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [showOfflineMenu, setShowOfflineMenu] = useState(false);
  const offlineMenuRef = useRef<HTMLDivElement>(null);

  // Sync network state from browser online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined' && id) {
      try {
        localStorage.setItem(`dt_offline_changes_${id}`, JSON.stringify(offlineChanges));
      } catch {
        // Ignore storage quota or restricted storage errors
      }
    }
  }, [offlineChanges, id]);

  // Click outside to close offline menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (offlineMenuRef.current && !offlineMenuRef.current.contains(e.target as Node)) {
        setShowOfflineMenu(false);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousedown', handleOutsideClick);
      }
    };
  }, []);

  const clearOfflineChanges = () => {
    setOfflineChanges([]);
  };

  const syncOfflineChanges = async () => {
    const pending = offlineChanges.filter(c => c.status === 'pending');
    if (pending.length === 0) return;
    setIsSyncing(true);
    
    try {
      await safeFetchJson('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: pending })
      });

      // Apply pending edits and mark as synced (works both with server endpoint and local fallback)
      for (const change of pending) {
        const row = (data || []).find((r, idx) => {
          const key = r[keyField] !== undefined ? r[keyField] : (r.id !== undefined ? r.id : idx);
          return String(key) === String(change.rowId);
        });
        const col = columns?.find(c => String(c.id) === String(change.columnId));
        if (row && col && onCellEdit) {
          onCellEdit(row, change.newValue, col);
        }
      }
      setOfflineChanges(prev => prev.map(c => c.status === 'pending' ? { ...c, status: 'synced' } : c));
    } finally {
      setIsSyncing(false);
      setShowOfflineMenu(false);
    }
  };

  const isAiQueryEnabled = enableAiQuery !== undefined ? enableAiQuery : (config?.aiQuery ?? false);
  const isAiInsightsEnabled = enableAiInsights !== undefined ? enableAiInsights : (config?.aiInsights ?? false);
  const isAiSummaryEnabled = enableAiSummary !== undefined ? enableAiSummary : (config?.aiSummary ?? false);

  const [aiQueryText, setAiQueryText] = useState('');
  const [activeAiQueryLabel, setActiveAiQueryLabel] = useState<string | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiFilteredData, setAiFilteredData] = useState<T[] | null>(null);
  const [aiInsightsList, setAiInsightsList] = useState<LLMInsightItem[] | null>(null);
  const [isGeneratingAiInsights, setIsGeneratingAiInsights] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState<string | null>(null);
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);

  // Runtime LLM Configuration Switcher State (allows users to configure/switch LLM provider live)
  const [showLlmModal, setShowLlmModal] = useState(false);
  const [runtimeProvider, setRuntimeProvider] = useState<LLMProviderType>(llmConfig?.provider || 'gemini');
  const [runtimeModel, setRuntimeModel] = useState<string>(llmConfig?.model || 'gemini-3.8-flash');
  const [runtimeEndpoint, setRuntimeEndpoint] = useState<string>(llmConfig?.endpoint || '');
  const [aiCopilotQuestion, setAiCopilotQuestion] = useState('');
  const [aiCopilotAnswer, setAiCopilotAnswer] = useState<string | null>(null);
  const [isAskingCopilot, setIsAskingCopilot] = useState(false);

  const effectiveLlmConfig = useMemo<LLMConfig<T>>(() => ({
    ...llmConfig,
    provider: llmConfig?.provider || runtimeProvider,
    model: llmConfig?.model || runtimeModel,
    endpoint: llmConfig?.endpoint || runtimeEndpoint || undefined,
  }), [llmConfig, runtimeProvider, runtimeModel, runtimeEndpoint]);

  // Reset AI filtered data when underlying data prop changes
  useEffect(() => {
    setAiFilteredData(null);
    setActiveAiQueryLabel(null);
  }, [data]);

  const transformedData = useMemo(() => {
    let result = (aiFilteredData !== null ? aiFilteredData : data) || [];
    if (plugins) {
      plugins.forEach(p => {
        if (p.transformData) {
          result = p.transformData(result);
        }
      });
    }

    // Merge pending offline changes if offline editing is enabled
    if (config?.offlineEditing && offlineChanges.length > 0) {
      result = result.map((row: any, idx: number) => {
        const rowKey = row[keyField] !== undefined ? row[keyField] : (row.id !== undefined ? row.id : idx);
        const pendingChanges = offlineChanges.filter(c => String(c.rowId) === String(rowKey) && c.status === 'pending');
        if (pendingChanges.length === 0) return row;

        const updatedRow = { ...row };
        pendingChanges.forEach(change => {
          // Find the column by ID (case-insensitive match so camelCase column IDs work)
          const col = columns?.find(c => String(c.id || c.name).toLowerCase() === String(change.columnId).toLowerCase());
          if (col) {
            const targetKey = col.id !== undefined ? String(col.id) : change.columnId;
            updatedRow[targetKey] = change.newValue;
            if (col.sortField) {
              updatedRow[col.sortField] = change.newValue;
            }
          } else {
            updatedRow[change.columnId] = change.newValue;
          }
        });
        return updatedRow;
      });
    }

    return result;
  }, [data, aiFilteredData, plugins, config?.offlineEditing, offlineChanges, keyField, columns]);

  const finalData = transformedData;
  
  const rawColumns = useMemo(() => {
    let result = columns || [];
    if (plugins) {
      plugins.forEach(p => {
        if (p.transformColumns) {
          result = p.transformColumns(result);
        }
      });
    }
    return result;
  }, [columns, plugins]);

  // Column Features State & Logic
  const [columnsOrder, setColumnsOrder] = useState<string[]>(() => persistedState?.columnsOrder || []);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => persistedState?.columnWidths || {});
  const [internalFilters, setInternalFilters] = useState<Record<string, FilterState>>({});
  const [activeFilterPopover, setActiveFilterPopover] = useState<string | null>(null);
  const [pinnedColumns, setPinnedColumns] = useState<Record<string, 'left' | 'right' | null>>(() => {
    if (persistedState?.pinnedColumns) return persistedState.pinnedColumns;
    const initialPins: Record<string, 'left' | 'right' | null> = {};
    (columns || []).forEach(c => {
      const colId = String(c.id || c.name).toLowerCase();
      if (c.pinned) initialPins[colId] = c.pinned;
    });
    return initialPins;
  });
  const [activeGroupBy, setActiveGroupBy] = useState<string>(() => persistedState?.activeGroupBy ?? (groupBy || ''));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (groupBy !== undefined) {
      setActiveGroupBy(groupBy);
    }
  }, [groupBy]);
  
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colId: string;
    value: string;
    error: string | null;
  } | null>(null);

  // Side Preview Panel states
  const [previewRow, setPreviewRow] = useState<T | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Row Comments & Mentions states
  const [rowCommentsData, setRowCommentsData] = useState<Record<string, {
    id: string;
    user: string;
    text: string;
    timestamp: Date;
  }[]>>({
    "1": [
      { id: "c1", user: "Alice", text: "Hey @Bob, please check the inventory count for this line.", timestamp: new Date(Date.now() - 3600000 * 2) },
      { id: "c2", user: "Bob", text: "On it, @Alice! Looks like we have more coming next week.", timestamp: new Date(Date.now() - 3600000 * 1.5) }
    ],
    "2": [
      { id: "c3", user: "Charlie", text: "The status of this item has been updated to Low Stock. @Emma, please review.", timestamp: new Date(Date.now() - 3600000 * 5) }
    ],
    "3": [
      { id: "c4", user: "Emma", text: "High priority! Let's get this finalized ASAP. @David", timestamp: new Date(Date.now() - 3600000 * 8) }
    ]
  });
  const [selectedCommentRowKey, setSelectedCommentRowKey] = useState<any>(null);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [showMentionsList, setShowMentionsList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);

  useEffect(() => {
    if (selectedCommentRowKey) {
      let active = true;
      const loadComments = async () => {
        const serverComments = await safeFetchJson<any[]>(`/api/comments/${selectedCommentRowKey}`);
        if (active && Array.isArray(serverComments)) {
          const parsedComments = serverComments.map((c: any) => ({
            id: c.id,
            user: c.author,
            text: c.text,
            timestamp: new Date(c.timestamp)
          }));
          setRowCommentsData(prev => ({
            ...prev,
            [String(selectedCommentRowKey)]: parsedComments
          }));
        }
      };
      loadComments();
      return () => { active = false; };
    }
    return undefined;
  }, [selectedCommentRowKey]);

  const teamMembers = useMemo(() => ["Alice", "Bob", "Charlie", "David", "Emma"], []);

  const renderCommentText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.slice(1);
        if (teamMembers.includes(name)) {
          return (
            <span key={i} className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 mx-0.5 border border-indigo-100">
              {part}
            </span>
          );
        }
      }
      return part;
    });
  };

  const activeFilters = useMemo(() => {
    return filterValues !== undefined ? filterValues : internalFilters;
  }, [filterValues, internalFilters]);

  const heatmapRanges = useMemo(() => {
    const ranges: Record<string, { min: number; max: number }> = {};
    rawColumns.forEach(col => {
      if (col.heatmap) {
        const colId = String(col.id || col.name).toLowerCase();
        const configMin = col.heatmapConfig?.min;
        const configMax = col.heatmapConfig?.max;

        if (configMin !== undefined && configMax !== undefined) {
          ranges[colId] = { min: configMin, max: configMax };
        } else {
          let minVal = Infinity;
          let maxVal = -Infinity;
          finalData.forEach((row, rowIndex) => {
            if (col.selector) {
              const rawVal = col.selector(row, rowIndex);
              const num = getNumericValue(rawVal);
              if (num < minVal) minVal = num;
              if (num > maxVal) maxVal = num;
            }
          });
          if (minVal === Infinity) minVal = 0;
          if (maxVal === -Infinity) maxVal = 100;
          if (minVal === maxVal) {
            minVal -= 1;
            maxVal += 1;
          }
          ranges[colId] = {
            min: configMin !== undefined ? configMin : minVal,
            max: configMax !== undefined ? configMax : maxVal
          };
        }
      }
    });
    return ranges;
  }, [finalData, rawColumns]);

  const finalColumns = useMemo(() => {
    let activeCols = rawColumns.filter(col => !col.omit);
    if (columnsOrder.length > 0) {
      const colMap = new Map(activeCols.map(col => [String(col.id || col.name).toLowerCase(), col]));
      const ordered: TableColumn<T>[] = [];
      columnsOrder.forEach(id => {
        const col = colMap.get(id);
        if (col) {
          ordered.push(col);
          colMap.delete(id);
        }
      });
      colMap.forEach(col => {
        ordered.push(col);
      });
      activeCols = ordered;
    }

    const hasRowActions = plugins?.some(p => p.renderRowAction);
    if (hasRowActions) {
      const actionCol: TableColumn<T> = {
        id: 'plugin-actions',
        name: 'Actions',
        right: true,
        selector: () => '',
        cell: (row, index) => (
          <div className="flex items-center justify-end gap-1.5">
            {plugins?.map((p, pIdx) => p.renderRowAction && (
              <React.Fragment key={`p-action-${pIdx}`}>
                {p.renderRowAction(row, index)}
              </React.Fragment>
            ))}
          </div>
        )
      };
      activeCols = [...activeCols, actionCol];
    }

    return activeCols;
  }, [rawColumns, columnsOrder, plugins]);

  useEffect(() => {
    const ids = rawColumns.filter(col => !col.omit).map(col => String(col.id || col.name).toLowerCase());
    setColumnsOrder(prev => {
      if (prev.length === ids.length && prev.every((id, idx) => id === ids[idx])) {
        return prev;
      }
      const currentSet = new Set(prev);
      const hasDifference = ids.some(id => !currentSet.has(id)) || ids.length !== prev.length;
      return hasDifference ? ids : prev;
    });
  }, [rawColumns]);

  // Screen & container width state for responsive column hiding and adaptive card layout
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveWidth = containerWidth > 0 ? containerWidth : windowWidth;

  const isColHiddenByBreakpoint = (col: TableColumn<T>) => {
    if (col.hide === undefined) return false;
    
    // Check if col.hide is a number (e.g. 768)
    if (typeof col.hide === 'number') {
      return effectiveWidth < col.hide;
    }
    
    // Check if col.hide is standard media breakpoint
    const breakpointMap: Record<string, number> = {
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    };
    
    const limit = breakpointMap[String(col.hide).toLowerCase()];
    if (limit !== undefined) {
      return effectiveWidth < limit;
    }
    
    return false;
  };

  // Style helper for column width / resizing & sticky column pinning
  const getColStyle = (colId: string, bgColor?: string): React.CSSProperties => {
    const col = finalColumns.find(c => String(c.id || c.name).toLowerCase() === String(colId).toLowerCase());
    const style: React.CSSProperties = {};

    const resizedWidth = columnWidths[colId];
    if (resizedWidth !== undefined) {
      style.width = resizedWidth;
      style.minWidth = resizedWidth;
      style.maxWidth = resizedWidth;
    } else if (col) {
      if (col.width !== undefined) {
        style.width = col.width;
      }
      if (col.minWidth !== undefined) {
        style.minWidth = col.minWidth;
      }
      if (col.maxWidth !== undefined) {
        style.maxWidth = col.maxWidth;
      }
      if (col.grow !== undefined) {
        style.flexGrow = col.grow;
      }
    }

    const pinDir = pinnedColumns[colId] !== undefined ? pinnedColumns[colId] : col?.pinned;
    if (pinDir === 'left') {
      style.position = 'sticky';
      style.left = 0;
      style.zIndex = 12;
      style.backgroundColor = bgColor || themeObj.background.default;
      style.boxShadow = '2px 0 5px -2px rgba(15, 23, 42, 0.12)';
    } else if (pinDir === 'right') {
      style.position = 'sticky';
      style.right = 0;
      style.zIndex = 12;
      style.backgroundColor = bgColor || themeObj.background.default;
      style.boxShadow = '-2px 0 5px -2px rgba(15, 23, 42, 0.12)';
    }
    return style;
  };

  // Resize handler on mouse down
  const handleResizeStart = (colId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const currentTh = event.currentTarget.parentElement;
    const startWidth = columnWidths[colId] || (currentTh ? currentTh.getBoundingClientRect().width : 150);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);
      setColumnWidths(prev => ({
        ...prev,
        [colId]: newWidth
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Drag & drop column reordering
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const handleDragStart = (colId: string, e: React.DragEvent) => {
    setDraggedColId(colId);
    e.dataTransfer.setData('text/plain', colId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetColId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceColId = e.dataTransfer.getData('text/plain') || draggedColId;
    if (!sourceColId || sourceColId === targetColId) return;

    const sourceIdx = columnsOrder.indexOf(sourceColId);
    const targetIdx = columnsOrder.indexOf(targetColId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const nextOrder = [...columnsOrder];
    nextOrder.splice(sourceIdx, 1);
    nextOrder.splice(targetIdx, 0, sourceColId);

    setColumnsOrder(nextOrder);
    setDraggedColId(null);

    const colMap = new Map(rawColumns.map(col => [String(col.id || col.name).toLowerCase(), col]));
    const updatedColumns = nextOrder.map(id => colMap.get(id)).filter(Boolean) as TableColumn<T>[];
    if (onColumnOrderChange) {
      onColumnOrderChange(updatedColumns);
    }
    if (columnGroups && onColumnGroupOrderChange) {
      onColumnGroupOrderChange(columnGroups, updatedColumns);
    }
  };

  // Drag & drop group reordering
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);

  const handleGroupDragStart = (groupId: string, e: React.DragEvent) => {
    setDraggedGroupId(groupId);
    e.dataTransfer.setData('text/group-id', groupId);
  };

  const handleGroupDrop = (targetGroupId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceGroupId = e.dataTransfer.getData('text/group-id') || draggedGroupId;
    if (!sourceGroupId || sourceGroupId === targetGroupId || !columnGroups) return;

    const findGroupById = (id: string) => {
      return columnGroups.find((g, idx) => {
        const gId = g.id || (typeof g.name === 'string' ? g.name : `group-index-${idx}`);
        return gId === id;
      });
    };

    const sourceGroup = findGroupById(sourceGroupId);
    const targetGroup = findGroupById(targetGroupId);
    if (!sourceGroup || !targetGroup) return;

    const sourceIdx = columnGroups.indexOf(sourceGroup);
    const targetIdx = columnGroups.indexOf(targetGroup);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const updatedGroups = [...columnGroups];
    updatedGroups.splice(sourceIdx, 1);
    updatedGroups.splice(targetIdx, 0, sourceGroup);

    const groupColIds = sourceGroup.columnIds.map(String);
    const targetColIds = targetGroup.columnIds.map(String);
    
    let firstTargetIdx = columnsOrder.findIndex(id => targetColIds.includes(String(id)));
    if (firstTargetIdx === -1) firstTargetIdx = 0;

    const otherCols = columnsOrder.filter(id => !groupColIds.includes(String(id)));
    const nextOrder = [
      ...otherCols.slice(0, firstTargetIdx),
      ...groupColIds,
      ...otherCols.slice(firstTargetIdx)
    ];

    setColumnsOrder(nextOrder);
    setDraggedGroupId(null);

    const colMap = new Map(rawColumns.map(col => [String(col.id || col.name).toLowerCase(), col]));
    const updatedColumns = nextOrder.map(id => colMap.get(id)).filter(Boolean) as TableColumn<T>[];
    
    if (onColumnGroupOrderChange) {
      onColumnGroupOrderChange(updatedGroups, updatedColumns);
    }
    if (onColumnOrderChange) {
      onColumnOrderChange(updatedColumns);
    }
  };

  // Derived settings merging individual props and config object values (with props taking priority)
  const isSearchable = searchable !== undefined ? searchable : (config?.searchable ?? true);
  const isSortable = sortable !== undefined ? sortable : (config?.sortable ?? true);
  const isPagination = pagination !== undefined ? pagination : (config?.pagination ?? false);
  const isSelectableRows = selectableRows !== undefined ? selectableRows : (config?.selectableRows ?? false);
  const isExportable = exportable !== undefined ? exportable : (config?.exportable ?? true);
  const isColumnVisibility = columnVisibility !== undefined ? columnVisibility : (config?.columnVisibility ?? true);
  const isDensityToggle = densityToggle !== undefined ? densityToggle : (config?.densityToggle ?? true);
  const isAnimations = animations !== undefined ? animations : (config?.animations ?? true);

  const [sortColumns, setSortColumns] = useState<ActiveSort<T>[]>(() => {
    if (defaultSortFieldId !== undefined) {
      const col = finalColumns.find(c => (String(c.id || c.name).toLowerCase() === String(defaultSortFieldId).toLowerCase()));
      if (col) {
        return [{
          column: col,
          id: defaultSortFieldId,
          direction: defaultSortAsc ? 'asc' : 'desc'
        }];
      }
    }
    return [];
  });

  const sortCol = sortColumns[0]?.id;
  const sortDir = sortColumns[0]?.direction || 'asc';
  const [selected, setSelected] = useState<any[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const getRowKey = (row: any, index: number) => {
    return row[keyField] !== undefined ? row[keyField] : (row.id !== undefined ? row.id : index);
  };

  const updateSelection = (newSelectedKeys: any[]) => {
    if (controlledSelectedRows === undefined) {
      setSelected(newSelectedKeys);
    }
    
    const selectedRowsList = finalData.filter((row: any, idx: number) => 
      newSelectedKeys.includes(getRowKey(row, idx))
    );

    const selectableKeys = filteredData
      .map((row: any, idx: number) => ({ row, key: getRowKey(row, idx) }))
      .filter(({ row }) => !selectableRowDisabled || !selectableRowDisabled(row))
      .map(({ key }) => key);
    const allSelected = selectableKeys.length > 0 && selectableKeys.every(k => newSelectedKeys.includes(k));

    const pageSelectableKeys = paginatedData
      .map((row: any, idx: number) => ({ row, key: getRowKey(row, idx) }))
      .filter(({ row }) => !selectableRowDisabled || !selectableRowDisabled(row))
      .map(({ key }) => key);
    const allSelectedPage = pageSelectableKeys.length > 0 && pageSelectableKeys.every(k => newSelectedKeys.includes(k));

    if (onSelectedRowsChange) {
      onSelectedRowsChange({
        allSelected: selectableRowsVisibleOnly ? allSelectedPage : allSelected,
        selectedCount: selectedRowsList.length,
        selectedRows: selectedRowsList,
      });
    }
  };

  // Sync controlledSelectedRows prop to internal selected state
  useEffect(() => {
    if (controlledSelectedRows !== undefined) {
      const keys = controlledSelectedRows.map((row: any, idx: number) => getRowKey(row, idx));
      setSelected(prev => {
        if (prev.length === keys.length && prev.every((k, i) => k === keys[i])) {
          return prev;
        }
        return keys;
      });
    }
  }, [controlledSelectedRows, keyField]);

  // Handle selectableRowSelected pre-selection
  const initialSelectionLoaded = useRef(false);
  useEffect(() => {
    if (selectableRowSelected && controlledSelectedRows === undefined && !initialSelectionLoaded.current) {
      const preSelectedKeys = finalData
        .filter((row: any) => selectableRowSelected(row))
        .map((row: any, idx: number) => getRowKey(row, idx));
      setSelected(preSelectedKeys);
      initialSelectionLoaded.current = true;
    }
  }, [finalData, selectableRowSelected, controlledSelectedRows]);

  // Expandable Rows State
  const [expandedKeys, setExpandedKeys] = useState<any[]>([]);

  const toggleExpandRow = (rowKey: any, row: any) => {
    if (expandableRowDisabled && expandableRowDisabled(row)) return;

    const isExpanded = expandedKeys.includes(rowKey);
    const newExpandedKeys = isExpanded 
      ? expandedKeys.filter(k => k !== rowKey) 
      : [...expandedKeys, rowKey];

    setExpandedKeys(newExpandedKeys);

    if (onRowExpandToggled) {
      onRowExpandToggled(!isExpanded, row);
    }
  };

  // Sync expanded keys based on expandableRowExpanded
  const initialExpansionLoaded = useRef(false);
  useEffect(() => {
    if (expandableRowExpanded && !initialExpansionLoaded.current) {
      const preExpandedKeys = finalData
        .filter((row: any) => expandableRowExpanded(row))
        .map((row: any, idx: number) => getRowKey(row, idx));
      setExpandedKeys(preExpandedKeys);
      initialExpansionLoaded.current = true;
    }
  }, [finalData, expandableRowExpanded]);

  const [search, setSearch] = useState('');
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);
  const bookmarkStorageKey = `eg_bookmarks_${id || 'default'}`;
  const [bookmarkedKeys, setBookmarkedKeys] = useState<Set<string | number>>(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem(bookmarkStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return new Set(parsed);
        }
      } catch {
        // Ignore storage read errors
      }
    }
    return new Set();
  });

  useEffect(() => {
    if (!config?.bookmarks) return undefined;
    let active = true;
    const loadBookmarks = async () => {
      const keys = await safeFetchJson<any[]>('/api/bookmarks');
      if (active && Array.isArray(keys)) {
        setBookmarkedKeys(new Set(keys));
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(bookmarkStorageKey, JSON.stringify(keys));
          } catch {}
        }
      }
    };
    loadBookmarks();
    return () => { active = false; };
  }, [config?.bookmarks, bookmarkStorageKey]);

  const toggleBookmark = async (key: string | number) => {
    setBookmarkedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(bookmarkStorageKey, JSON.stringify(Array.from(next)));
        } catch {}
      }
      return next;
    });

    await safeFetchJson('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
  };
  const [viewMode, setViewMode] = useState<'table' | 'map' | 'calendar' | 'kanban' | 'gallery'>('table');

  // Swipe state & touch gesture handlers for Mobile Swipe Actions
  const [swipedRowKey, setSwipedRowKey] = useState<string | number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const swipeStartOffset = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent, rowKey: string | number) => {
    if (!config?.swipeActions || !mobileSwipeActions) return;

    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchCurrentX.current = touch.clientX;
    touchCurrentY.current = touch.clientY;
    setIsSwiping(true);

    swipeStartOffset.current = swipedRowKey === rowKey ? swipeOffset : 0;

    if (swipedRowKey !== null && swipedRowKey !== rowKey) {
      setSwipedRowKey(null);
      setSwipeOffset(0);
      swipeStartOffset.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent, rowKey: string | number) => {
    if (!isSwiping) return;

    const touch = e.touches[0];
    touchCurrentX.current = touch.clientX;
    touchCurrentY.current = touch.clientY;

    const diffX = touchCurrentX.current - touchStartX.current;
    const diffY = touchCurrentY.current - touchStartY.current;

    // If vertical scrolling is more prominent, ignore swipe gesture
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 12) {
      setIsSwiping(false);
      return;
    }

    if (Math.abs(diffX) > 8) {
      if (e.cancelable) {
        e.preventDefault();
      }
      
      const leftActionsWidth = mobileSwipeActions?.left ? mobileSwipeActions.left.length * 70 : 0;
      const rightActionsWidth = mobileSwipeActions?.right ? mobileSwipeActions.right.length * 70 : 0;

      let targetOffset = swipeStartOffset.current + diffX;

      if (targetOffset > 0 && !mobileSwipeActions?.left) {
        targetOffset = 0;
      } else if (targetOffset < 0 && !mobileSwipeActions?.right) {
        targetOffset = 0;
      } else {
        const maxLeft = leftActionsWidth;
        const maxRight = -rightActionsWidth;
        if (targetOffset > maxLeft) {
          targetOffset = maxLeft + (targetOffset - maxLeft) * 0.25;
        } else if (targetOffset < maxRight) {
          targetOffset = maxRight + (targetOffset - maxRight) * 0.25;
        }
      }

      setSwipeOffset(targetOffset);
      setSwipedRowKey(rowKey);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, rowKey: string | number) => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const leftActionsWidth = mobileSwipeActions?.left ? mobileSwipeActions.left.length * 70 : 0;
    const rightActionsWidth = mobileSwipeActions?.right ? mobileSwipeActions.right.length * 70 : 0;

    const threshold = 35;

    if (swipeOffset > threshold && mobileSwipeActions?.left) {
      setSwipeOffset(leftActionsWidth);
      setSwipedRowKey(rowKey);
    } else if (swipeOffset < -threshold && mobileSwipeActions?.right) {
      setSwipeOffset(-rightActionsWidth);
      setSwipedRowKey(rowKey);
    } else {
      setSwipeOffset(0);
      setSwipedRowKey(null);
    }
  };
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  
  const [internalPage, setInternalPage] = useState(paginationDefaultPage ?? 1);
  const currentPage = paginationPage !== undefined ? paginationPage : internalPage;

  const [internalRowsPerPage, setInternalRowsPerPage] = useState(() => persistedState?.rowsPerPage ?? paginationPerPage ?? 10);
  const rowsPerPage = internalRowsPerPage;

  // Track reset default page toggle
  const lastResetToggleRef = useRef(paginationResetDefaultPage);
  useEffect(() => {
    if (paginationResetDefaultPage !== undefined && paginationResetDefaultPage !== lastResetToggleRef.current) {
      lastResetToggleRef.current = paginationResetDefaultPage;
      if (paginationPage === undefined) {
        setInternalPage(1);
      }
    }
  }, [paginationResetDefaultPage, paginationPage]);

  // Sync rows per page if prop changes
  useEffect(() => {
    if (paginationPerPage !== undefined) {
      setInternalRowsPerPage(paginationPerPage);
    }
  }, [paginationPerPage]);

  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>(() => persistedState?.density || 'normal');
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showSavedViewsMenu, setShowSavedViewsMenu] = useState(false);
  const savedViewsStorageKey = `eg_saved_views_${id || 'default'}`;
  const [savedViewsList, setSavedViewsList] = useState<SavedView[]>(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem(savedViewsStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // Ignore storage read errors
      }
    }
    return [];
  });
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState('');

  const initializedPluginsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (plugins) {
      const currentNames = new Set(plugins.map((p, idx) => p.name || `plugin_${idx}`));
      // Clean up removed plugins so re-toggling a plugin calls onInit once
      initializedPluginsRef.current.forEach(name => {
        if (!currentNames.has(name)) {
          initializedPluginsRef.current.delete(name);
        }
      });
      plugins.forEach((p, idx) => {
        const key = p.name || `plugin_${idx}`;
        if (p.onInit && !initializedPluginsRef.current.has(key)) {
          initializedPluginsRef.current.add(key);
          p.onInit({
            data: finalData,
            columns: rawColumns,
            setViewMode,
            setDensity
          });
        }
      });
    }
  }, [plugins, finalData, rawColumns]);
  
  useEffect(() => {
    if (!config?.savedViews) return undefined;
    let active = true;
    const loadViews = async () => {
      const views = await safeFetchJson<SavedView[]>('/api/saved-views');
      if (active && Array.isArray(views)) {
        setSavedViewsList(views);
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(savedViewsStorageKey, JSON.stringify(views));
          } catch {}
        }
      }
    };
    loadViews();
    return () => { active = false; };
  }, [config?.savedViews, savedViewsStorageKey]);

  const saveCurrentView = async () => {
    if (!newViewName.trim()) return;
    
    const viewState = {
      search,
      viewMode,
      density,
      columnsOrder,
      visibleColumns,
      sortColumns,
      internalFilters,
      columnWidths,
    };

    const serverSavedView = await safeFetchJson<SavedView>('/api/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newViewName.trim(), state: viewState })
    });

    const resolvedView: SavedView = serverSavedView && serverSavedView.id
      ? serverSavedView
      : {
          id: Math.random().toString(36).slice(2, 11),
          name: newViewName.trim(),
          state: viewState
        };

    setSavedViewsList(prev => {
      const next = [...prev, resolvedView];
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(savedViewsStorageKey, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
    setActiveSavedViewId(resolvedView.id);
    setNewViewName('');
    setShowSavedViewsMenu(false);
  };

  const loadSavedView = (viewId: string) => {
    const view = savedViewsList.find(v => v.id === viewId);
    if (!view) return;
    
    setSearch(view.state.search);
    setViewMode(view.state.viewMode);
    setDensity(view.state.density);
    setColumnsOrder(view.state.columnsOrder);
    setVisibleColumns(view.state.visibleColumns);
    setSortColumns(view.state.sortColumns);
    setInternalFilters(view.state.internalFilters);
    setColumnWidths(view.state.columnWidths);
    
    setActiveSavedViewId(view.id);
    setShowSavedViewsMenu(false);
  };
  
  const [showShareToast, setShowShareToast] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);

  useEffect(() => {
    if (!showAuditModal || !config?.auditTrail) return undefined;
    let active = true;
    const fetchAuditLogs = async () => {
      const serverLogs = await safeFetchJson<any[]>('/api/audit-trail');
      if (active && Array.isArray(serverLogs)) {
        const parsedLogs = serverLogs.map((l: any) => ({
          id: l.id,
          timestamp: new Date(l.timestamp),
          rowId: l.details?.match?.(/ID: (\d+)/)?.[1] || "Server",
          columnId: "system",
          columnName: l.action,
          oldValue: "",
          newValue: l.details
        }));
        setAuditLogs(parsedLogs);
      }
    };
    fetchAuditLogs();
    return () => { active = false; };
  }, [showAuditModal, config?.auditTrail]);

  useEffect(() => {
    if (config?.shareableViews) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const shareParam = id ? `viewState_${id}` : 'viewState';
        const sharedStateBase64 = urlParams.get(shareParam);
        
        if (sharedStateBase64 && sharedStateBase64.length <= 16384) {
          const jsonStr = atob(sharedStateBase64);
          const state = JSON.parse(jsonStr);
          if (state && typeof state === 'object' && !Array.isArray(state)) {
            if (typeof state.search === 'string') {
              setSearch(state.search.slice(0, 500));
            }
            if (typeof state.viewMode === 'string' && ['table', 'map', 'calendar', 'kanban', 'gallery'].includes(state.viewMode)) {
              setViewMode(state.viewMode as any);
            }
            if (typeof state.density === 'string' && ['compact', 'normal', 'spacious'].includes(state.density)) {
              setDensity(state.density as any);
            }
            if (Array.isArray(state.columnsOrder) && state.columnsOrder.every((item: any) => typeof item === 'string' || typeof item === 'number')) {
              setColumnsOrder(state.columnsOrder.slice(0, 200));
            }
            if (state.visibleColumns && typeof state.visibleColumns === 'object' && !Array.isArray(state.visibleColumns)) {
              const safeVisible: Record<string, boolean> = {};
              for (const [k, v] of Object.entries(state.visibleColumns)) {
                if (!DANGEROUS_OBJECT_KEYS.has(k) && typeof v === 'boolean') {
                  safeVisible[k] = v;
                }
              }
              setVisibleColumns(safeVisible);
            }
            if (Array.isArray(state.sortColumns)) {
              const safeSort = state.sortColumns
                .filter((s: any) => s && typeof s === 'object' && (typeof s.id === 'string' || typeof s.id === 'number') && (s.direction === 'asc' || s.direction === 'desc'))
                .slice(0, 10);
              setSortColumns(safeSort);
            }
            if (state.internalFilters && typeof state.internalFilters === 'object' && !Array.isArray(state.internalFilters)) {
              const safeFilters: Record<string, any> = {};
              for (const [k, v] of Object.entries(state.internalFilters)) {
                if (!DANGEROUS_OBJECT_KEYS.has(k)) {
                  safeFilters[k] = v;
                }
              }
              setInternalFilters(safeFilters);
            }
            if (state.columnWidths && typeof state.columnWidths === 'object' && !Array.isArray(state.columnWidths)) {
              const safeWidths: Record<string, number> = {};
              for (const [k, v] of Object.entries(state.columnWidths)) {
                if (!DANGEROUS_OBJECT_KEYS.has(k) && typeof v === 'number' && Number.isFinite(v) && v >= 40 && v <= 2000) {
                  safeWidths[k] = v;
                }
              }
              setColumnWidths(safeWidths);
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse shared view state', e);
      }
    }
  }, [config?.shareableViews, id]);

  const copyShareLink = () => {
    try {
      const state = {
        search,
        viewMode,
        density,
        columnsOrder,
        visibleColumns,
        sortColumns,
        internalFilters,
        columnWidths,
      };
      
      const jsonStr = JSON.stringify(state);
      const base64Str = btoa(jsonStr);
      
      const url = new URL(window.location.href);
      const shareParam = id ? `viewState_${id}` : 'viewState';
      url.searchParams.set(shareParam, base64Str);
      
      navigator.clipboard.writeText(url.toString());
      
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch (e) {
      console.error('Failed to generate share link', e);
    }
  };
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    if (persistedState?.visibleColumns) return persistedState.visibleColumns;
    const initialVisibility: Record<string, boolean> = {};
    finalColumns.forEach(col => {
      const colId = String(col.id || col.name).toLowerCase();
      initialVisibility[colId] = true;
    });
    return initialVisibility;
  });

  // Persist grid state to localStorage when persistStateKey is configured
  useEffect(() => {
    if (typeof window === 'undefined' || !persistStateKey) return;
    try {
      localStorage.setItem(
        `eg_state_${persistStateKey}`,
        JSON.stringify({
          density,
          visibleColumns,
          columnsOrder,
          columnWidths,
          pinnedColumns,
          rowsPerPage,
          activeGroupBy,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [persistStateKey, density, visibleColumns, columnsOrder, columnWidths, pinnedColumns, rowsPerPage, activeGroupBy]);

  // Close context menu on outside click / escape, and exit fullscreen on Escape
  useEffect(() => {
    if (!contextMenuState && !isFullscreen) return;
    const handleDismiss = () => setContextMenuState(null);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenuState(null);
        setIsFullscreen(false);
      }
    };
    window.addEventListener('click', handleDismiss);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('click', handleDismiss);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenuState, isFullscreen]);

  const menuRef = useRef<HTMLDivElement>(null);
  const savedViewsMenuRef = useRef<HTMLDivElement>(null);
  const timeTravelMenuRef = useRef<HTMLDivElement>(null);

  const [historyStack, setHistoryStack] = useState<{
    timestamp: Date;
    label: string;
    state: {
      search: string;
      viewMode: 'table' | 'map' | 'calendar' | 'kanban' | 'gallery';
      density: 'compact' | 'normal' | 'spacious';
      columnsOrder: string[];
      visibleColumns: Record<string, boolean>;
      sortColumns: any[];
      internalFilters: Record<string, FilterState>;
      columnWidths: Record<string, number>;
    };
  }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showTimeTravel, setShowTimeTravel] = useState(false);
  const isApplyingHistory = useRef(false);

  const getActionLabel = (prev: any, next: any) => {
    if (!prev) return 'Initial State';
    if (prev.search !== next.search) return `Searched: "${next.search || '(cleared)'}"`;
    if (prev.viewMode !== next.viewMode) return `Switched View: ${next.viewMode}`;
    if (prev.density !== next.density) return `Changed Density: ${next.density}`;
    
    const prevVis = JSON.stringify(prev.visibleColumns || {});
    const nextVis = JSON.stringify(next.visibleColumns || {});
    if (prevVis !== nextVis) return 'Toggled Columns';
    
    const prevSort = JSON.stringify(prev.sortColumns || []);
    const nextSort = JSON.stringify(next.sortColumns || []);
    if (prevSort !== nextSort) return 'Updated Sorting';
    
    const prevFilters = JSON.stringify(prev.internalFilters || {});
    const nextFilters = JSON.stringify(next.internalFilters || {});
    if (prevFilters !== nextFilters) return 'Filtered Grid';
    
    const prevOrder = JSON.stringify(prev.columnsOrder || []);
    const nextOrder = JSON.stringify(next.columnsOrder || []);
    if (prevOrder !== nextOrder) return 'Reordered Columns';
    
    const prevWidths = JSON.stringify(prev.columnWidths || {});
    const nextWidths = JSON.stringify(next.columnWidths || {});
    if (prevWidths !== nextWidths) return 'Resized Columns';
    
    return 'Grid Updated';
  };

  const jumpToHistoryIndex = (idx: number) => {
    if (idx < 0 || idx >= historyStack.length) return;
    isApplyingHistory.current = true;
    const entry = historyStack[idx];
    
    setSearch(entry.state.search);
    setViewMode(entry.state.viewMode);
    setDensity(entry.state.density);
    setColumnsOrder(entry.state.columnsOrder);
    setVisibleColumns(entry.state.visibleColumns);
    setSortColumns(entry.state.sortColumns);
    setInternalFilters(entry.state.internalFilters);
    setColumnWidths(entry.state.columnWidths);
    
    setHistoryIndex(idx);
    
    setTimeout(() => {
      isApplyingHistory.current = false;
    }, 50);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      jumpToHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      jumpToHistoryIndex(historyIndex + 1);
    }
  };

  const lastHistoryJsonRef = useRef<string>('');
  useEffect(() => {
    if (!config?.timeTravel) return;
    if (isApplyingHistory.current) return;

    const serializableSort = sortColumns.map(s => ({ id: s.id, direction: s.direction }));
    const snapshotSignature = JSON.stringify({
      search,
      viewMode,
      density,
      columnsOrder,
      visibleColumns,
      sortColumns: serializableSort,
      internalFilters,
      columnWidths,
    });

    if (snapshotSignature === lastHistoryJsonRef.current) {
      return;
    }
    lastHistoryJsonRef.current = snapshotSignature;

    const currentSnapshot = {
      search,
      viewMode,
      density,
      columnsOrder,
      visibleColumns,
      sortColumns,
      internalFilters,
      columnWidths,
    };

    const prevSnapshot = historyIndex >= 0 ? historyStack[historyIndex]?.state : null;
    const label = getActionLabel(prevSnapshot, currentSnapshot);
    const newEntry = {
      timestamp: new Date(),
      label,
      state: currentSnapshot,
    };

    const activeStack = historyIndex >= 0 ? historyStack.slice(0, historyIndex + 1) : [];
    const updatedStack = [...activeStack, newEntry];
    setHistoryStack(updatedStack);
    setHistoryIndex(updatedStack.length - 1);
  }, [search, viewMode, density, columnsOrder, visibleColumns, sortColumns, internalFilters, columnWidths, config?.timeTravel]);

  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
    return undefined;
  }, []);

  const themeObj = themeRegistry[theme] || themeRegistry.default;

  const shouldAnimate = (animateRows || isAnimations) && !prefersReducedMotion;

  // Helper to evaluate conditionalRowStyles
  const getConditionalStyles = (row: T) => {
    let combinedStyle: React.CSSProperties = {};
    let combinedClasses: string[] = [];
    
    if (conditionalRowStyles && Array.isArray(conditionalRowStyles)) {
      conditionalRowStyles.forEach(rule => {
        if (rule.when(row)) {
          if (rule.style) {
            const ruleStyle = typeof rule.style === 'function' ? rule.style(row) : rule.style;
            combinedStyle = { ...combinedStyle, ...ruleStyle };
          }
          if (rule.classNames) {
            combinedClasses = [...combinedClasses, ...rule.classNames];
          }
        }
      });
    }
    
    return { style: combinedStyle, className: combinedClasses.join(' ') };
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowColumnsMenu(false);
      }
      if (savedViewsMenuRef.current && !savedViewsMenuRef.current.contains(event.target as Node)) {
        setShowSavedViewsMenu(false);
      }
      if (timeTravelMenuRef.current && !timeTravelMenuRef.current.contains(event.target as Node)) {
        setShowTimeTravel(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update visible columns if finalColumns list changes while preserving existing visibility state
  useEffect(() => {
    setVisibleColumns(prev => {
      const nextVisibility: Record<string, boolean> = {};
      let changed = false;
      let count = 0;
      finalColumns.forEach(col => {
        const colId = String(col.id || col.name).toLowerCase();
        if (!(colId in nextVisibility)) {
          count++;
        }
        const nextVal = prev[colId] !== undefined ? prev[colId] : true;
        nextVisibility[colId] = nextVal;
        if (prev[colId] !== nextVal) {
          changed = true;
        }
      });
      if (!changed && Object.keys(prev).length === count) {
        return prev;
      }
      return nextVisibility;
    });
  }, [finalColumns]);

  const sortDataWithColumns = (rowsToSort: T[], configCols: ActiveSort<T>[]) => {
    if (configCols.length === 0) return rowsToSort;
    
    return [...rowsToSort].sort((a, b) => {
      for (const s of configCols) {
        const activeCol = s.column;
        const isAsc = s.direction === 'asc';
        
        if (activeCol.sortFunction) {
          const res = activeCol.sortFunction(a, b);
          if (res !== 0) return isAsc ? res : -res;
          continue;
        }

        const valA = activeCol.selector ? activeCol.selector(a) : (a as any)[s.id];
        const valB = activeCol.selector ? activeCol.selector(b) : (b as any)[s.id];
        
        if (valA === valB) continue;
        
        if (valA === undefined || valA === null) return isAsc ? 1 : -1;
        if (valB === undefined || valB === null) return isAsc ? -1 : 1;
        
        if (typeof valA === 'string' && typeof valB === 'string') {
          const comp = valA.localeCompare(valB);
          if (comp !== 0) {
            return isAsc ? comp : -comp;
          }
          continue;
        }

        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
      }
      return 0;
    });
  };

  const handleSort = (col: TableColumn<T>, event?: React.MouseEvent) => {
    if (disabled) return;
    
    const colId = String(col.id || col.name).toLowerCase();
    const isCtrlClick = event && (event.ctrlKey || event.metaKey);
    const multiSortEnabled = sortMulti && isCtrlClick;

    let newSortColumns: ActiveSort<T>[] = [];

    if (multiSortEnabled) {
      const existingIndex = sortColumns.findIndex(c => c.id === colId);
      if (existingIndex > -1) {
        const existing = sortColumns[existingIndex];
        if (existing.direction === 'asc') {
          newSortColumns = sortColumns.map((c, idx) => 
            idx === existingIndex ? { ...c, direction: 'desc' as const } : c
          );
        } else {
          newSortColumns = sortColumns.filter((_, idx) => idx !== existingIndex);
        }
      } else {
        newSortColumns = [
          ...sortColumns,
          { column: col, id: colId, direction: 'asc' }
        ];
      }
    } else {
      const existing = sortColumns.find(c => c.id === colId);
      if (existing) {
        if (existing.direction === 'asc') {
          newSortColumns = [{ column: col, id: colId, direction: 'desc' }];
        } else {
          newSortColumns = [];
        }
      } else {
        newSortColumns = [{ column: col, id: colId, direction: 'asc' }];
      }
    }

    setSortColumns(newSortColumns);

    if (paginationServer && paginationServerOptions?.persistSelectedOnSort === false && selected.length > 0) {
      updateSelection([]);
    }

    if (onSort) {
      const updatedEntry = newSortColumns.find(c => c.id === colId);
      const directionStr = updatedEntry ? updatedEntry.direction : 'clear';
      
      const calculatedSortedRows = sortServer 
        ? filteredData 
        : sortDataWithColumns(filteredData, newSortColumns);

      onSort(col, directionStr, calculatedSortedRows, newSortColumns);
    }
  };

  const resetAllFilters = () => {
    setSearch('');
    setAiFilteredData(null);
    setActiveAiQueryLabel(null);
    setAiQueryText('');
    setActiveGroupBy('');
    setShowOnlyBookmarked(false);
    setInternalFilters({});
    setActiveQuickFilterIds([]);
  };

  const resetLayout = () => {
    setDensity('normal');
    setColumnsOrder([]);
    setColumnWidths({});
    const initialPins: Record<string, 'left' | 'right' | null> = {};
    finalColumns.forEach(col => {
      const colId = String(col.id || col.name).toLowerCase();
      if (col.pinned) initialPins[colId] = col.pinned;
    });
    setPinnedColumns(initialPins);
    const defaultVis: Record<string, boolean> = {};
    finalColumns.forEach(col => {
      const colId = String(col.id || col.name).toLowerCase();
      defaultVis[colId] = col.omit !== true;
    });
    setVisibleColumns(defaultVis);
    setActiveGroupBy(groupBy || '');
    setCollapsedGroups(new Set());
    if (paginationPerPage !== undefined) {
      setInternalRowsPerPage(paginationPerPage);
    }
    if (typeof window !== 'undefined' && persistStateKey) {
      try {
        localStorage.removeItem(`eg_state_${persistStateKey}`);
      } catch {
        // Ignore storage errors
      }
    }
    setExportToast('Layout reset to defaults');
    setTimeout(() => setExportToast(null), 2000);
  };

  const undoLastEdit = (): boolean => {
    if (cellEditHistory.length === 0) return false;
    const lastEntry = cellEditHistory[cellEditHistory.length - 1];
    setCellEditHistory(prev => prev.slice(0, -1));
    if (onCellEdit) {
      onCellEdit(lastEntry.row, lastEntry.oldValue, lastEntry.col);
    }
    if (config?.auditTrail) {
      const rowKey = lastEntry.row[keyField] !== undefined ? lastEntry.row[keyField] : (lastEntry.row.id !== undefined ? lastEntry.row.id : 'row');
      setAuditLogs(prev => [{
        id: Math.random().toString(36).slice(2, 11),
        timestamp: new Date(),
        rowId: rowKey,
        columnId: String(lastEntry.col.id || lastEntry.col.name).toLowerCase(),
        columnName: String(lastEntry.col.name),
        oldValue: lastEntry.newValue,
        newValue: lastEntry.oldValue,
      }, ...prev]);
    }
    setExportToast(`Undid edit on "${String(lastEntry.col.name)}"`);
    setTimeout(() => setExportToast(null), 2200);
    return true;
  };

  useEffect(() => {
    if (typeof window === 'undefined' || config?.timeTravel || cellEditHistory.length === 0) return undefined;
    const onUndoKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        const isTyping =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.tagName === 'SELECT' ||
          target?.isContentEditable;
        if (!isTyping) {
          e.preventDefault();
          undoLastEdit();
        }
      }
    };
    window.addEventListener('keydown', onUndoKeyDown);
    return () => window.removeEventListener('keydown', onUndoKeyDown);
  }, [cellEditHistory, config?.timeTravel]);

  const mapParsedCsvToRows = (rawRecords: Record<string, string>[]): Partial<T>[] => {
    if (rawRecords.length === 0) return [];
    const lookupByHeader = new Map<string, TableColumn<T>>();
    finalColumns.forEach(col => {
      if (col.button || col.sparkline || col.id === 'plugin-actions') return;
      const colId = String(col.id || col.name);
      lookupByHeader.set(colId.toLowerCase().trim(), col);
      if (typeof col.name === 'string' || typeof col.name === 'number') {
        lookupByHeader.set(String(col.name).toLowerCase().trim(), col);
      }
    });

    return rawRecords.map(rec => {
      const mapped: Record<string, any> = {};
      Object.entries(rec).forEach(([header, rawVal]) => {
        if (DANGEROUS_OBJECT_KEYS.has(header)) return;
        const matchedCol = lookupByHeader.get(header.toLowerCase().trim());
        const targetKey = matchedCol ? String(matchedCol.id || matchedCol.name) : header;
        if (DANGEROUS_OBJECT_KEYS.has(targetKey)) return;
        if (matchedCol?.filterType === 'number' && rawVal !== '' && !isNaN(Number(rawVal.replace(/[$,%]/g, '')))) {
          mapped[targetKey] = Number(rawVal.replace(/[$,%]/g, ''));
        } else {
          mapped[targetKey] = rawVal;
        }
      });
      return mapped as Partial<T>;
    });
  };

  const importCSVText = (csvText: string): Partial<T>[] => {
    const rawRecords = parseCSV(csvText);
    const mapped = mapParsedCsvToRows(rawRecords);
    if (mapped.length > 0 && onImportRows) {
      onImportRows(mapped);
      setExportToast(`Imported ${mapped.length} row(s)`);
      setTimeout(() => setExportToast(null), 2200);
    }
    return mapped;
  };

  const scrollToRow = (index: number) => {
    const container = tableScrollContainerRef.current;
    if (!container) return;
    const clampedIndex = Math.max(0, Math.min(index, Math.max(0, paginatedData.length - 1)));
    const rowHeight = virtualRowHeight || 48;
    const targetTop = clampedIndex * rowHeight;
    container.scrollTo({ top: targetTop, behavior: 'smooth' });
    if (virtualize) {
      setVirtualScrollTop(targetTop);
    }
  };

  useImperativeHandle(ref, () => ({
    clearSort: () => {
      if (defaultSortFieldId !== undefined) {
        const col = finalColumns.find(c => (String(c.id || c.name).toLowerCase() === String(defaultSortFieldId).toLowerCase()));
        if (col) {
          const defaultSort: ActiveSort<T>[] = [{
            column: col,
            id: defaultSortFieldId,
            direction: defaultSortAsc ? 'asc' : 'desc'
          }];
          setSortColumns(defaultSort);
          if (onSort) {
            const calculatedSortedRows = sortServer 
              ? filteredData 
              : sortDataWithColumns(filteredData, defaultSort);
            onSort(col, defaultSortAsc ? 'asc' : 'desc', calculatedSortedRows, defaultSort);
          }
          return;
        }
      }
      setSortColumns([]);
      if (onSort && finalColumns[0]) {
        onSort(finalColumns[0], 'clear', filteredData, []);
      }
    },
    clearSelectedRows: () => {
      updateSelection([]);
    },
    selectAll: () => {
      if (disabled || selectableRowsSingle) return;
      const allKeys = filteredData
        .filter((row) => !selectableRowDisabled || !selectableRowDisabled(row))
        .map((row, idx) => getRowKey(row, idx));
      updateSelection(allKeys);
    },
    expandAllRows: () => {
      if (disabled || !expandableRows) return;
      const allExpandableKeys = filteredData
        .filter((row) => !expandableRowDisabled || !expandableRowDisabled(row))
        .map((row, idx) => getRowKey(row, idx));
      setExpandedKeys(allExpandableKeys);
    },
    collapseAllRows: () => {
      setExpandedKeys([]);
    },
    resetFilters: resetAllFilters,
    resetLayout,
    setSearch: (query: string) => setSearch(query),
    setGroupBy: (columnId: string | null) => {
      setActiveGroupBy(columnId || '');
      setCollapsedGroups(new Set());
    },
    goToPage: (page: number) => handlePageChange(page),
    exportCSV: () => exportCSV(),
    exportJSON: () => exportJSON(),
    exportMarkdown: () => exportMarkdown(),
    exportHTML: () => exportHTML(),
    copyAsMarkdown: () => copyTableMarkdown(),
    undoLastEdit,
    importCSV: importCSVText,
    scrollToRow,
    getSelectedRows: () => finalData.filter((row: any, idx: number) => selected.includes(getRowKey(row, idx))),
    getFilteredData: () => sortedData,
    getSummaryData: () => {
      const selectedRowsList = finalData.filter((row: any, idx: number) =>
        selected.includes(getRowKey(row, idx))
      );
      return computeExternalSummary(sortedData, finalColumns, {
        selectedRows: selectedRowsList,
        totalRowCount: finalData.length,
        aiSummary: aiSummaryText,
        aiInsights: aiInsightsList || undefined,
      });
    },
    toggleFullscreen: () => setIsFullscreen(prev => !prev),
  }));

  const filteredData = useMemo(() => {
    let result = finalData;

    // 1. Global Search Filter
    if (search && isSearchable) {
      const searchLower = search.toLowerCase();
      result = result.filter((item: T) => {
        return finalColumns.some(col => {
          const val = col.selector(item);
          if (val === undefined || val === null) return false;
          return String(val).toLowerCase().includes(searchLower);
        });
      });
    }

    // 2. Column-Level Filters
    const filterKeys = Object.keys(activeFilters);
    if (filterKeys.length > 0) {
      const resolvedFilters = filterKeys.map(colId => {
        const filterState = activeFilters[colId];
        const col = finalColumns.find(c => String(c.id || c.name).toLowerCase() === String(colId).toLowerCase());
        const filterValStr = filterState?.value !== undefined ? String(filterState.value).toLowerCase() : '';
        const filterValNum = filterState?.value !== undefined ? Number(filterState.value) : NaN;
        return {
          colId,
          filterState,
          col,
          filterValStr,
          filterValNum
        };
      }).filter(f => f.filterState && f.col);

      result = result.filter((item: T) => {
        return resolvedFilters.every(({ filterState, col, filterValStr, filterValNum }) => {
          if (!filterState || !col) return true;
          
          if (col.filterFunction) {
            return col.filterFunction(item, filterState);
          }

          const hasVal = filterState.value !== undefined && filterState.value !== null && String(filterState.value).trim() !== '';
          if (!hasVal && filterState.operator !== 'isEmpty' && filterState.operator !== 'isNotEmpty') {
            return true;
          }

          const rawVal = col.selector(item);
          if (filterState.operator === 'isEmpty') {
            return rawVal === null || rawVal === undefined || String(rawVal).trim() === '';
          }
          if (filterState.operator === 'isNotEmpty') {
            return rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '';
          }

          if (rawVal === null || rawVal === undefined) return false;

          const valStr = String(rawVal).toLowerCase();

          switch (filterState.operator) {
            case 'contains':
              return valStr.includes(filterValStr);
            case 'equals':
              if (col.filterType === 'date') {
                const d1 = new Date(rawVal).toISOString().split('T')[0];
                const d2 = new Date(String(filterState.value)).toISOString().split('T')[0];
                return d1 === d2;
              }
              if (col.filterType === 'number') {
                return getNumericValue(rawVal) === filterValNum;
              }
              return valStr === filterValStr;
            case 'startsWith':
              return valStr.startsWith(filterValStr);
            case 'endsWith':
              return valStr.endsWith(filterValStr);
            case 'greaterThan':
              if (col.filterType === 'date') {
                return new Date(rawVal).getTime() > new Date(String(filterState.value)).getTime();
              }
              return getNumericValue(rawVal) > filterValNum;
            case 'lessThan':
              if (col.filterType === 'date') {
                return new Date(rawVal).getTime() < new Date(String(filterState.value)).getTime();
              }
              return getNumericValue(rawVal) < filterValNum;
            default:
              return true;
          }
        });
      });
    }

    // 3. Bookmarks Filter
    if (showOnlyBookmarked && config?.bookmarks) {
      result = result.filter((item: T, idx: number) => {
        const key = getRowKey(item, idx);
        return bookmarkedKeys.has(key);
      });
    }

    // 4. Quick Filters (segmented chips)
    if (quickFilters && activeQuickFilterIds.length > 0) {
      const activePredicates = quickFilters
        .filter(qf => activeQuickFilterIds.includes(qf.id))
        .map(qf => qf.predicate);
      if (activePredicates.length > 0) {
        result = result.filter(item => activePredicates.every(pred => pred(item)));
      }
    }

    return result;
  }, [finalData, search, isSearchable, finalColumns, activeFilters, showOnlyBookmarked, bookmarkedKeys, config?.bookmarks, quickFilters, activeQuickFilterIds]);

  const sortedData = useMemo(() => {
    if (!isSortable) return filteredData;
    if (sortServer) return filteredData;
    if (sortFunction) {
      const primarySort = sortColumns[0];
      if (!primarySort) return filteredData;
      return sortFunction(filteredData, primarySort.column, primarySort.direction);
    }
    return sortDataWithColumns(filteredData, sortColumns);
  }, [filteredData, sortColumns, isSortable, sortServer, sortFunction]);

  const paginatedData = useMemo(() => {
    if (!isPagination || paginationServer) return sortedData;
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage, isPagination, paginationServer]);

  useEffect(() => {
    if (!virtualize) return;
    const maxScroll = Math.max(0, paginatedData.length * Math.max(24, virtualRowHeight || 48) - (virtualContainerHeight || 520));
    if (virtualScrollTop > maxScroll) {
      setVirtualScrollTop(0);
      if (tableScrollContainerRef.current) {
        tableScrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [virtualize, paginatedData.length, currentPage, virtualRowHeight, virtualContainerHeight]);

  const totalRows = paginationServer && paginationTotalRows !== undefined ? paginationTotalRows : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (paginationServer && paginationServerOptions?.persistSelectedOnPageChange === false && selected.length > 0) {
      updateSelection([]);
    }
    if (onChangePage) {
      onChangePage(newPage, totalRows);
    }
    if (paginationPage === undefined) {
      setInternalPage(newPage);
    }
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setInternalRowsPerPage(newRowsPerPage);
    if (onChangeRowsPerPage) {
      onChangeRowsPerPage(newRowsPerPage, currentPage);
    }
    if (paginationPage === undefined) {
      setInternalPage(1);
    }
  };

  const renderPaginationControls = () => {
    if (!isPagination) return null;

    if (paginationComponent) {
      const PaginationComp = paginationComponent;
      return (
        <PaginationComp
          rowsPerPage={rowsPerPage}
          rowCount={totalRows}
          onChangePage={handlePageChange}
          onChangeRowsPerPage={handleRowsPerPageChange}
          currentPage={currentPage}
        />
      );
    }

    const defaultRowsPerPageOptions = [10, 15, 20, 25, 30];
    const options = paginationRowsPerPageOptions ?? defaultRowsPerPageOptions;

    const rowsPerPageText = localization?.pagination?.rowsPerPage ?? paginationComponentOptions?.rowsPerPageText ?? "Rows per page:";
    const rangeSeparatorText = paginationComponentOptions?.rangeSeparatorText ?? "of";
    const noRowsPerPage = paginationComponentOptions?.noRowsPerPage ?? false;
    const selectAllRowsItem = paginationComponentOptions?.selectAllRowsItem ?? false;
    const selectAllRowsItemText = paginationComponentOptions?.selectAllRowsItemText ?? "All";

    const firstPageTitle = localization?.pagination?.firstPage ?? "First Page";
    const prevPageTitle = localization?.pagination?.previousPage ?? "Previous Page";
    const nextPageTitle = localization?.pagination?.nextPage ?? "Next Page";
    const lastPageTitle = localization?.pagination?.lastPage ?? "Last Page";

    const prevAriaLabel = localization?.pagination?.previousPageAriaLabel ?? prevPageTitle;
    const nextAriaLabel = localization?.pagination?.nextPageAriaLabel ?? nextPageTitle;

    const prevIcon = paginationIcons?.previous ?? <ChevronLeft className="w-4 h-4" />;
    const nextIcon = paginationIcons?.next ?? <ChevronRight className="w-4 h-4" />;
    const firstIcon = paginationIcons?.first ?? <ChevronsLeft className="w-4 h-4" />;
    const lastIcon = paginationIcons?.last ?? <ChevronsRight className="w-4 h-4" />;

    const startIdx = totalRows > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
    const endIdx = Math.min(currentPage * rowsPerPage, totalRows);

    return (
      <div 
        className="px-3 py-2.5 flex flex-col sm:flex-row justify-between items-center gap-2.5 sm:gap-4 text-xs rounded-b-xl border-t"
        style={{
          backgroundColor: themeObj.background.default === '#ffffff' ? '#f8fafc' : themeObj.background.default,
          color: themeObj.text.secondary,
          borderColor: themeObj.divider.default,
          ...customStyles?.pagination?.style
        }}
      >
        {!noRowsPerPage ? (
          <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2">
            <span style={{ color: themeObj.text.secondary }}>{rowsPerPageText}</span>
            <select 
              className="ml-1 sm:ml-2 bg-transparent outline-none cursor-pointer border rounded px-2 py-1 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs"
              style={{ borderColor: themeObj.divider.default, color: themeObj.text.primary }}
              value={rowsPerPage}
              onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
              disabled={disabled || (progressPending && paginatedData.length === 0)}
            >
              {options.map((opt) => (
                <option key={opt} value={opt} style={{ backgroundColor: themeObj.background.default, color: themeObj.text.primary }}>
                  {opt}
                </option>
              ))}
              {selectAllRowsItem && totalRows > 0 && !options.includes(totalRows) && (
                <option value={totalRows} style={{ backgroundColor: themeObj.background.default, color: themeObj.text.primary }}>
                  {selectAllRowsItemText}
                </option>
              )}
            </select>
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
        
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto tabular-nums" style={{ color: themeObj.text.secondary }}>
          <div className="flex items-center gap-2">
            <span>
              {totalRows > 0 ? `${startIdx}-${endIdx} ${rangeSeparatorText} ${totalRows}` : `0-0 ${rangeSeparatorText} 0`}
            </span>
            <span className="text-[11px] opacity-70 font-mono hidden xs:inline">
              (Pg {currentPage}/{totalPages})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              type="button"
              className="min-w-[32px] min-h-[32px] p-1 inline-flex items-center justify-center hover:bg-slate-200/50 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors disabled:cursor-not-allowed" 
              style={{ color: themeObj.text.primary, ...customStyles?.pagination?.pageButtonsStyle }}
              disabled={disabled || currentPage === 1 || (progressPending && paginatedData.length === 0)}
              onClick={() => handlePageChange(1)}
              title={firstPageTitle}
              aria-label={firstPageTitle}
            >
              {firstIcon}
            </button>
            <button 
              type="button"
              className="min-w-[32px] min-h-[32px] p-1 inline-flex items-center justify-center hover:bg-slate-200/50 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors disabled:cursor-not-allowed" 
              style={{ color: themeObj.text.primary, ...customStyles?.pagination?.pageButtonsStyle }}
              disabled={disabled || currentPage === 1 || (progressPending && paginatedData.length === 0)}
              onClick={() => handlePageChange(currentPage - 1)}
              title={prevPageTitle}
              aria-label={prevAriaLabel}
            >
              {prevIcon}
            </button>
            <button 
              type="button"
              className="min-w-[32px] min-h-[32px] p-1 inline-flex items-center justify-center hover:bg-slate-200/50 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors disabled:cursor-not-allowed" 
              style={{ color: themeObj.text.primary, ...customStyles?.pagination?.pageButtonsStyle }}
              disabled={disabled || currentPage >= totalPages || (progressPending && paginatedData.length === 0)}
              onClick={() => handlePageChange(currentPage + 1)}
              title={nextPageTitle}
              aria-label={nextAriaLabel}
            >
              {nextIcon}
            </button>
            <button 
              type="button"
              className="min-w-[32px] min-h-[32px] p-1 inline-flex items-center justify-center hover:bg-slate-200/50 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors disabled:cursor-not-allowed" 
              style={{ color: themeObj.text.primary, ...customStyles?.pagination?.pageButtonsStyle }}
              disabled={disabled || currentPage >= totalPages || (progressPending && paginatedData.length === 0)}
              onClick={() => handlePageChange(totalPages)}
              title={lastPageTitle}
              aria-label={lastPageTitle}
            >
              {lastIcon}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const toggleSelectAll = () => {
    if (disabled || selectableRowsSingle) return;
    
    const rowsToTarget = selectableRowsVisibleOnly ? paginatedData : filteredData;
    const rowKeys = rowsToTarget
      .map((row, idx) => ({ row, key: getRowKey(row, idx) }))
      .filter(({ row }) => !selectableRowDisabled || !selectableRowDisabled(row))
      .map(({ key }) => key);
    const isAllSelected = rowKeys.length > 0 && rowKeys.every(k => selected.includes(k));
    
    if (isAllSelected) {
      updateSelection(selected.filter(k => !rowKeys.includes(k)));
    } else {
      const newSelected = [...selected];
      rowKeys.forEach(k => {
        if (!newSelected.includes(k)) newSelected.push(k);
      });
      updateSelection(newSelected);
    }
  };

  const toggleSelect = (k: any, row: any, index: number, event?: React.MouseEvent) => {
    if (disabled) return;
    if (selectableRowDisabled && selectableRowDisabled(row)) return;

    if (selectableRowsSingle) {
      if (selected.includes(k)) {
        updateSelection([]);
      } else {
        updateSelection([k]);
      }
      setLastClickedIndex(index);
      return;
    }

    if (selectableRowsRange && event && event.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      
      const rangeRows = paginatedData.slice(start, end + 1);
      const selectableRangeKeys = rangeRows
        .map((r, idx) => ({ r, key: getRowKey(r, start + idx) }))
        .filter(({ r }) => !selectableRowDisabled || !selectableRowDisabled(r))
        .map(({ key }) => key);
      
      const newSelected = [...selected];
      selectableRangeKeys.forEach(key => {
        if (!newSelected.includes(key)) {
          newSelected.push(key);
        }
      });
      updateSelection(newSelected);
      setLastClickedIndex(index);
      return;
    }

    if (selected.includes(k)) {
      updateSelection(selected.filter(s => s !== k));
    } else {
      updateSelection([...selected, k]);
    }
    setLastClickedIndex(index);
  };

  const renderCheckbox = ({ checked, onChange, disabled: cbDisabled, isHeader = false }: { checked: boolean; onChange: (e?: any) => void; disabled?: boolean; isHeader?: boolean }) => {
    const defaultClass = "rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4 disabled:opacity-50 disabled:cursor-not-allowed";
    
    if (selectableRowsComponent && selectableRowsComponent !== 'input') {
      const Component = selectableRowsComponent;
      return (
        <Component
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={cbDisabled}
          ref={isHeader ? headerCheckboxRef : undefined}
          {...(selectableRowsComponentProps || {})}
        />
      );
    }
    
    return (
      <input
        ref={isHeader ? headerCheckboxRef : undefined}
        type="checkbox"
        className={defaultClass}
        checked={checked}
        onChange={onChange}
        disabled={cbDisabled}
        {...(selectableRowsComponentProps || {})}
      />
    );
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCSV = (rowsOverride?: T[]) => {
    if (disabled) return;
    const sourceRows = rowsOverride || filteredData;
    const exportCols = visibleCols.filter(col => col.id !== 'plugin-actions');
    const headers = exportCols.map(col => sanitizeCsvCell(typeof col.name === 'string' || typeof col.name === 'number' ? String(col.name) : String(col.id)));
    const rows = sourceRows.map((row, rowIdx) => 
      exportCols.map(col => {
        const val = col.selector ? col.selector(row, rowIdx) : (row as any)[col.id];
        return sanitizeCsvCell(val);
      })
    );
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    triggerDownload(csvContent, rowsOverride ? 'selected-rows.csv' : 'export.csv', 'text/csv;charset=utf-8;');
    setShowExportMenu(false);
  };

  const exportJSON = (rowsOverride?: T[]) => {
    if (disabled) return;
    const sourceRows = rowsOverride || filteredData;
    const exportCols = visibleCols.filter(col => col.id !== 'plugin-actions');
    const jsonRows = sourceRows.map((row, rowIdx) => {
      const obj: Record<string, any> = {};
      exportCols.forEach(col => {
        const key = typeof col.name === 'string' || typeof col.name === 'number' ? String(col.name) : String(col.id);
        if (!DANGEROUS_OBJECT_KEYS.has(key)) {
          obj[key] = col.selector ? col.selector(row, rowIdx) : (row as any)[col.id];
        }
      });
      return obj;
    });
    triggerDownload(JSON.stringify(jsonRows, null, 2), rowsOverride ? 'selected-rows.json' : 'export.json', 'application/json;charset=utf-8;');
    setShowExportMenu(false);
  };

  const buildMarkdownTable = (): string => {
    const exportCols = visibleCols.filter(col => col.id !== 'plugin-actions');
    const headers = exportCols.map(col => typeof col.name === 'string' || typeof col.name === 'number' ? String(col.name) : String(col.id));
    const divider = headers.map(() => '---');
    const rows = filteredData.map((row, rowIdx) =>
      exportCols.map(col => {
        const val = col.selector ? col.selector(row, rowIdx) : (row as any)[col.id];
        return val === null || val === undefined ? '' : String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      })
    );
    return [
      `| ${headers.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...rows.map(r => `| ${r.join(' | ')} |`)
    ].join('\n');
  };

  const exportMarkdown = () => {
    if (disabled) return;
    triggerDownload(buildMarkdownTable(), 'export.md', 'text/markdown;charset=utf-8;');
    setShowExportMenu(false);
  };

  const exportHTML = (rowsOverride?: T[]) => {
    if (disabled) return;
    const sourceRows = rowsOverride || filteredData;
    const exportCols = visibleCols.filter(col => col.id !== 'plugin-actions');
    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const headers = exportCols.map(col =>
      escapeHtml(typeof col.name === 'string' || typeof col.name === 'number' ? String(col.name) : String(col.id))
    );
    const bodyRows = sourceRows
      .map((row, rowIdx) => {
        const cells = exportCols
          .map(col => {
            const val = col.selector ? col.selector(row, rowIdx) : (row as any)[col.id];
            return `<td>${escapeHtml(val === null || val === undefined ? '' : String(val))}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('\n      ');
    const docTitle = typeof title === 'string' && title ? escapeHtml(title) : 'EnterpriseGrid Export';
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }
    h1 { font-size: 18px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; font-size: 13px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>${docTitle} (${sourceRows.length} rows)</h1>
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</body>
</html>`;
    triggerDownload(htmlContent, rowsOverride ? 'selected-rows.html' : 'export.html', 'text/html;charset=utf-8;');
    setShowExportMenu(false);
  };

  const copyTableMarkdown = async (): Promise<boolean> => {
    if (disabled) return false;
    const md = buildMarkdownTable();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(md);
        setExportToast('Copied Markdown table!');
        setTimeout(() => setExportToast(null), 2200);
        setShowExportMenu(false);
        return true;
      } catch {
        setShowExportMenu(false);
        return false;
      }
    }
    setShowExportMenu(false);
    return false;
  };

  const copyTableTSV = async () => {
    if (disabled) return;
    const exportCols = visibleCols.filter(col => col.id !== 'plugin-actions');
    const headers = exportCols.map(col => typeof col.name === 'string' || typeof col.name === 'number' ? String(col.name) : String(col.id));
    const rows = filteredData.map((row, rowIdx) =>
      exportCols.map(col => {
        const val = col.selector ? col.selector(row, rowIdx) : (row as any)[col.id];
        return val === null || val === undefined ? '' : String(val);
      })
    );
    const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(tsv);
      setExportToast('Copied TSV to clipboard!');
      setTimeout(() => setExportToast(null), 2200);
    }
    setShowExportMenu(false);
  };

  // Built-in Universal LLM Execution Helpers
  const llmColumnDescriptors = useMemo(() => {
    return finalColumns.map(c => ({
      id: String(c.id || c.name),
      name: typeof c.name === 'string' || typeof c.name === 'number' ? String(c.name) : String(c.id),
      selector: c.selector,
      sampleType: c.filterType || 'string',
    }));
  }, [finalColumns]);

  const handleBuiltInAiQuery = async (queryStr: string) => {
    if (disabled) return;
    const trimmed = queryStr.trim();
    if (!trimmed) {
      setAiFilteredData(null);
      setActiveAiQueryLabel(null);
      return;
    }
    setIsAiSearching(true);
    try {
      const sourceRows = data || [];
      let matched: T[];
      if (onAiQuery) {
        matched = await onAiQuery(trimmed);
      } else {
        matched = await executeLLMTask(
          effectiveLlmConfig,
          {
            task: 'query',
            query: trimmed,
            schema: llmColumnDescriptors.map(({ id: cId, name, sampleType }) => ({ id: cId, name, sampleType })),
            rows: sourceRows,
            totalRowCount: sourceRows.length,
          },
          llmColumnDescriptors
        );
      }
      setAiFilteredData(Array.isArray(matched) ? matched : sourceRows);
      setActiveAiQueryLabel(trimmed);
      if (paginationPage === undefined) setInternalPage(1);
    } catch (err) {
      console.error('AI query error, falling back to local query engine:', err);
      const fallback = executeSmartLocalQuery(trimmed, data || [], llmColumnDescriptors);
      setAiFilteredData(fallback);
      setActiveAiQueryLabel(trimmed);
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleBuiltInAiInsights = async () => {
    if (disabled || isGeneratingAiInsights) return;
    setIsGeneratingAiInsights(true);
    try {
      const targetRows = filteredData.length > 0 ? filteredData : finalData;
      if (onAiInsights) {
        const res = await onAiInsights(targetRows);
        setAiInsightsList(res);
      } else {
        const res = await executeLLMTask(
          effectiveLlmConfig,
          {
            task: 'insights',
            schema: llmColumnDescriptors.map(({ id: cId, name, sampleType }) => ({ id: cId, name, sampleType })),
            rows: targetRows,
            totalRowCount: targetRows.length,
          },
          llmColumnDescriptors
        );
        setAiInsightsList(Array.isArray(res) ? res : generateSmartLocalInsights(targetRows, llmColumnDescriptors));
      }
    } catch (err) {
      console.error('AI insights error:', err);
      setAiInsightsList(generateSmartLocalInsights(filteredData.length > 0 ? filteredData : finalData, llmColumnDescriptors));
    } finally {
      setIsGeneratingAiInsights(false);
    }
  };

  const handleBuiltInAiSummary = async () => {
    if (disabled || isGeneratingAiSummary) return;
    setIsGeneratingAiSummary(true);
    try {
      const targetRows = filteredData.length > 0 ? filteredData : finalData;
      if (onAiSummary) {
        const res = await onAiSummary(targetRows);
        setAiSummaryText(res);
      } else {
        const res = await executeLLMTask(
          effectiveLlmConfig,
          {
            task: 'summary',
            schema: llmColumnDescriptors.map(({ id: cId, name, sampleType }) => ({ id: cId, name, sampleType })),
            rows: targetRows,
            totalRowCount: targetRows.length,
          },
          llmColumnDescriptors
        );
        setAiSummaryText(typeof res === 'string' ? res : generateSmartLocalSummary(targetRows, llmColumnDescriptors));
      }
    } catch (err) {
      console.error('AI summary error:', err);
      setAiSummaryText(generateSmartLocalSummary(filteredData.length > 0 ? filteredData : finalData, llmColumnDescriptors));
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  const handleAskCopilot = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!aiCopilotQuestion.trim() || isAskingCopilot) return;
    setIsAskingCopilot(true);
    try {
      const targetRows = filteredData.length > 0 ? filteredData : finalData;
      const answer = await executeLLMTask(
        effectiveLlmConfig,
        {
          task: 'chat',
          query: aiCopilotQuestion.trim(),
          schema: llmColumnDescriptors.map(({ id: cId, name, sampleType }) => ({ id: cId, name, sampleType })),
          rows: targetRows,
          totalRowCount: targetRows.length,
        },
        llmColumnDescriptors
      );
      setAiCopilotAnswer(String(answer));
    } catch (err: any) {
      setAiCopilotAnswer(generateSmartLocalSummary(filteredData, llmColumnDescriptors));
    } finally {
      setIsAskingCopilot(false);
    }
  };

  const pageRowKeys = useMemo(() => {
    return paginatedData
      .map((row, idx) => ({ row, key: getRowKey(row, idx) }))
      .filter(({ row }) => !selectableRowDisabled || !selectableRowDisabled(row))
      .map(({ key }) => key);
  }, [paginatedData, selectableRowDisabled, keyField]);

  const isAllSelectedOnPage = useMemo(() => {
    return pageRowKeys.length > 0 && pageRowKeys.every(k => selected.includes(k));
  }, [pageRowKeys, selected]);

  const isSomeSelectedOnPage = useMemo(() => {
    return pageRowKeys.length > 0 && pageRowKeys.some(k => selected.includes(k)) && !isAllSelectedOnPage;
  }, [pageRowKeys, selected, isAllSelectedOnPage]);

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelectedOnPage;
    }
  }, [isSomeSelectedOnPage]);

  // Reset pagination if search changes
  React.useEffect(() => {
    if (paginationPage === undefined) {
      setInternalPage(1);
    }
  }, [search, paginationPage]);

  // If the prop dense is set to true, it overrides the density selector to compact.
  const actualDensity = dense ? 'compact' : density;
  const cellPadding = actualDensity === 'compact' ? 'p-2' : actualDensity === 'spacious' ? 'p-6' : 'p-4';

  const visibleColumnsCount = finalColumns.filter(col => {
    const colId = String(col.id || col.name).toLowerCase();
    return visibleColumns[colId] !== false && !isColHiddenByBreakpoint(col);
  }).length + (isSelectableRows ? 1 : 0);

  // Check if header bar should be displayed
  const hasHeader = !noHeader && (
    title !== undefined || 
    actions !== undefined || 
    isSearchable || 
    isColumnVisibility || 
    isDensityToggle || 
    isExportable ||
    isAiQueryEnabled ||
    isAiInsightsEnabled ||
    isAiSummaryEnabled ||
    isFullscreenEnabled ||
    !!onAddRow ||
    !!onImportRows ||
    !!llmConfig ||
    !!config?.mapView ||
    !!config?.calendarView ||
    !!config?.kanbanView ||
    !!config?.galleryView ||
    !!config?.savedViews ||
    !!config?.shareableViews ||
    !!config?.auditTrail ||
    !!config?.timeTravel ||
    !!config?.bookmarks ||
    !!config?.offlineEditing ||
    !!plugins?.some(p => p.renderToolbarLeft || p.renderToolbarRight)
  );

  // Condition for displaying the table head row
  const showHeaderRow = !noTableHead && (sortedData.length > 0 || persistTableHead || progressPending);

  const rootStyle: React.CSSProperties = {
    backgroundColor: themeObj.background.default,
    color: themeObj.text.primary,
    borderColor: themeObj.divider.default,
    colorScheme: themeObj.colorScheme,
    ...style,
    ...customStyles?.tableWrapper?.style
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: themeObj.background.default === '#ffffff' ? '#f8fafc' : themeObj.background.default,
    color: themeObj.text.primary,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: themeObj.divider.default,
    ...(customStyles?.header?.fontColor ? { color: customStyles.header.fontColor } : {}),
    ...(customStyles?.header?.fontSize ? { fontSize: customStyles.header.fontSize } : {}),
    ...customStyles?.header?.style
  };

  const subHeaderStyle: React.CSSProperties = {
    backgroundColor: themeObj.background.default === '#ffffff' ? 'rgba(248, 250, 252, 0.5)' : themeObj.background.default,
    color: themeObj.text.secondary,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: themeObj.divider.default,
    ...customStyles?.subHeader?.style
  };

  const paginationStyle: React.CSSProperties = {
    backgroundColor: themeObj.background.default === '#ffffff' ? '#f8fafc' : themeObj.background.default,
    color: themeObj.text.secondary,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: themeObj.divider.default,
    ...customStyles?.pagination?.style
  };

  const visibleCols = useMemo(() => {
    return finalColumns.filter(col => {
      const colId = String(col.id || col.name).toLowerCase();
      return visibleColumns[colId] !== false && !isColHiddenByBreakpoint(col);
    });
  }, [finalColumns, visibleColumns, effectiveWidth]);

  const isNarrowViewport = effectiveWidth < mobileBreakpoint;
  const isMobileCardView =
    viewMode === 'table' &&
    (responsiveLayout === 'cards' ||
      (responsiveLayout === 'auto' &&
        (mobileViewOverride === 'cards' || (mobileViewOverride === null && isNarrowViewport))));

  const isExpanderVisible = expandableRows && !expandableRowsHideExpander;
  const isCommentsVisible = !!config?.rowComments;
  const isBookmarksVisible = !!config?.bookmarks;
  const isRowNumbersVisible = !!showRowNumbers;
  const totalColsCount = visibleCols.length + (isSelectableRows ? 1 : 0) + (isExpanderVisible ? 1 : 0) + (isCommentsVisible ? 1 : 0) + (isBookmarksVisible ? 1 : 0) + (isRowNumbersVisible ? 1 : 0);
  const showHeaderSep = headerSeparator !== false && headerSeparator !== undefined;
  const showColSep = columnSeparator !== false && columnSeparator !== undefined;

  const highlightCellContent = (node: React.ReactNode): React.ReactNode => {
    if (!highlightSearch || !search.trim()) return node;
    if (typeof node !== 'string' && typeof node !== 'number') return node;
    const text = String(node);
    const q = search.trim();
    const lowerText = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    const matchIdx = lowerText.indexOf(lowerQ);
    if (matchIdx === -1) return node;
    const before = text.slice(0, matchIdx);
    const match = text.slice(matchIdx, matchIdx + q.length);
    const after = text.slice(matchIdx + q.length);
    return (
      <>
        {before}
        <mark className="bg-amber-200/85 text-slate-900 rounded-xs px-0.5 font-semibold">{match}</mark>
        {after}
      </>
    );
  };

  const shouldShowFooter = showFooter !== false && (
    showFooter === true ||
    footerComponent !== undefined ||
    visibleCols.some(col => col.footer !== undefined || col.aggregation !== undefined)
  );

  const isCommandPaletteEnabled = config?.commandPalette !== false;

  const commands = useMemo(() => {
    if (!isCommandPaletteEnabled) return [];

    const list: Array<{
      id: string;
      label: string;
      category: string;
      icon: React.ReactNode;
      action: () => void;
      shortcut?: string;
    }> = [];

    // Category: Navigation & Views
    list.push({
      id: 'view-table',
      label: 'Switch to Table View',
      category: 'Views',
      icon: <LayoutGrid className="w-4 h-4 text-slate-500" />,
      action: () => setViewMode('table'),
    });

    if (config?.mapView) {
      list.push({
        id: 'view-map',
        label: 'Switch to Map View',
        category: 'Views',
        icon: <MapIcon className="w-4 h-4 text-slate-500" />,
        action: () => setViewMode('map'),
      });
    }

    if (config?.calendarView) {
      list.push({
        id: 'view-calendar',
        label: 'Switch to Calendar View',
        category: 'Views',
        icon: <CalendarIcon className="w-4 h-4 text-slate-500" />,
        action: () => setViewMode('calendar'),
      });
    }

    if (config?.kanbanView) {
      list.push({
        id: 'view-kanban',
        label: 'Switch to Kanban View',
        category: 'Views',
        icon: <Trello className="w-4 h-4 text-slate-500" />,
        action: () => setViewMode('kanban'),
      });
    }

    if (config?.galleryView) {
      list.push({
        id: 'view-gallery',
        label: 'Switch to Gallery View',
        category: 'Views',
        icon: <LayoutGrid className="w-4 h-4 text-slate-500" />,
        action: () => setViewMode('gallery'),
      });
    }

    // Category: Layout & Style
    list.push(
      {
        id: 'density-compact',
        label: 'Set Density to Compact',
        category: 'Layout & Style',
        icon: <Settings2 className="w-4 h-4 text-slate-500" />,
        action: () => setDensity('compact'),
      },
      {
        id: 'density-normal',
        label: 'Set Density to Standard',
        category: 'Layout & Style',
        icon: <Settings2 className="w-4 h-4 text-slate-500" />,
        action: () => setDensity('normal'),
      },
      {
        id: 'density-spacious',
        label: 'Set Density to Relaxed (Spacious)',
        category: 'Layout & Style',
        icon: <Settings2 className="w-4 h-4 text-slate-500" />,
        action: () => setDensity('spacious'),
      }
    );

    // Category: Favorites & Bookmarks
    if (config?.bookmarks) {
      list.push(
        {
          id: 'bookmarks-only',
          label: 'Show Bookmarked Rows Only',
          category: 'Filters',
          icon: <Star className="w-4 h-4 text-amber-500 fill-amber-400" />,
          action: () => setShowOnlyBookmarked(true),
        },
        {
          id: 'bookmarks-all',
          label: 'Show All Rows (Turn Off Bookmarks Filter)',
          category: 'Filters',
          icon: <Star className="w-4 h-4 text-slate-400" />,
          action: () => setShowOnlyBookmarked(false),
        }
      );
    }

    // Category: Export & Actions
    if (isExportable) {
      list.push(
        {
          id: 'export-csv',
          label: 'Export current view to CSV',
          category: 'Actions',
          icon: <Download className="w-4 h-4 text-emerald-500" />,
          action: () => exportCSV(),
        },
        {
          id: 'copy-markdown',
          label: 'Copy Current Table as Markdown',
          category: 'Actions',
          icon: <Copy className="w-4 h-4 text-indigo-500" />,
          action: () => { void copyTableMarkdown(); },
        },
        {
          id: 'print-table',
          label: 'Print Current Table View',
          category: 'Actions',
          icon: <Printer className="w-4 h-4 text-slate-500" />,
          action: () => {
            if (typeof window !== 'undefined' && typeof window.print === 'function') {
              window.print();
            }
          },
        }
      );
    }

    if (onImportRows) {
      list.push({
        id: 'import-csv',
        label: 'Import CSV / TSV Data',
        category: 'Actions',
        icon: <Upload className="w-4 h-4 text-indigo-600" />,
        action: () => {
          setImportRawText('');
          setImportError(null);
          setShowImportModal(true);
        },
      });
    }

    if (cellEditHistory.length > 0) {
      list.push({
        id: 'undo-last-cell-edit',
        label: `Undo Last Cell Edit (${cellEditHistory.length})`,
        category: 'History',
        icon: <Undo2 className="w-4 h-4 text-amber-600" />,
        action: () => { undoLastEdit(); },
        shortcut: 'Ctrl+Z',
      });
    }

    if (isSelectableRows && !selectableRowsSingle) {
      list.push({
        id: 'select-all-rows',
        label: 'Select All Filtered Rows',
        category: 'Actions',
        icon: <Check className="w-4 h-4 text-indigo-500" />,
        action: () => {
          const allKeys = filteredData
            .filter((row) => !selectableRowDisabled || !selectableRowDisabled(row))
            .map((row, idx) => getRowKey(row, idx));
          updateSelection(allKeys);
        },
      });
    }

    if (isFullscreenEnabled) {
      list.push({
        id: 'toggle-fullscreen',
        label: isFullscreen ? 'Exit Fullscreen Mode' : 'Enter Fullscreen Mode',
        category: 'Layout & Style',
        icon: isFullscreen ? <Minimize2 className="w-4 h-4 text-indigo-500" /> : <Maximize2 className="w-4 h-4 text-slate-500" />,
        action: () => setIsFullscreen(prev => !prev),
      });
    }

    if (responsiveLayout === 'auto') {
      list.push({
        id: 'toggle-mobile-cards',
        label: isMobileCardView ? 'Switch to Scrollable Table Layout' : 'Switch to Stacked Card Layout',
        category: 'Views',
        icon: isMobileCardView ? <TableIcon className="w-4 h-4 text-indigo-500" /> : <LayoutGrid className="w-4 h-4 text-indigo-500" />,
        action: () => setMobileViewOverride(isMobileCardView ? 'scroll' : 'cards'),
      });
    }

    // Reset Layout
    list.push({
      id: 'reset-layout',
      label: 'Reset Table Layout (Columns, Pinning, Widths)',
      category: 'Layout & Style',
      icon: <RotateCcw className="w-4 h-4 text-slate-600" />,
      action: () => resetLayout(),
    });

    // Reset Table
    list.push({
      id: 'reset-grid',
      label: 'Reset All Grid Settings & Filters',
      category: 'Actions',
      icon: <X className="w-4 h-4 text-red-500" />,
      action: () => {
        resetAllFilters();
        setSortColumns([]);
        resetLayout();
      },
    });

    // Time Travel
    if (config?.timeTravel) {
      list.push(
        {
          id: 'time-undo',
          label: 'Time Travel: Undo Last Action',
          category: 'History',
          icon: <Undo2 className="w-4 h-4 text-indigo-500" />,
          action: () => handleUndo(),
          shortcut: 'Ctrl+Z'
        },
        {
          id: 'time-redo',
          label: 'Time Travel: Redo Action',
          category: 'History',
          icon: <Redo2 className="w-4 h-4 text-indigo-500" />,
          action: () => handleRedo(),
          shortcut: 'Ctrl+Y'
        }
      );
    }

    // Category: Toggle Column Visibility
    finalColumns.forEach(col => {
      const colId = String(col.id || col.name).toLowerCase();
      const isVisible = visibleColumns[colId] !== false;
      list.push({
        id: `toggle-col-${colId}`,
        label: `${isVisible ? 'Hide' : 'Show'} Column: ${col.name}`,
        category: 'Toggle Columns',
        icon: isVisible ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-indigo-500" />,
        action: () => {
          setVisibleColumns(prev => ({
            ...prev,
            [colId]: !isVisible
          }));
        },
      });
    });

    return list;
  }, [
    isCommandPaletteEnabled,
    config,
    visibleColumns,
    finalColumns,
    showOnlyBookmarked,
    isExportable,
    isSelectableRows,
    selectableRowsSingle,
    isFullscreenEnabled,
    isFullscreen,
    filteredData,
    exportCSV,
    handleUndo,
    handleRedo,
    onImportRows,
    cellEditHistory.length
  ]);

  const filteredCommands = useMemo(() => {
    if (!commandSearch) return commands;
    const s = commandSearch.toLowerCase();
    return commands.filter(c => 
      c.label.toLowerCase().includes(s) || 
      c.category.toLowerCase().includes(s)
    );
  }, [commands, commandSearch]);

  // Adjust selected index on filtered results change
  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [commandSearch]);

  // Command Palette global keyboard shortcut
  useEffect(() => {
    if (!isCommandPaletteEnabled || typeof window === 'undefined') return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCommandPaletteEnabled]);

  // Handle keyboard events when Command Palette is open
  const handlePaletteKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCommandIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCommandIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedCommandIndex]) {
        filteredCommands[selectedCommandIndex].action();
        setIsCommandPaletteOpen(false);
        setCommandSearch('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsCommandPaletteOpen(false);
      setCommandSearch('');
    }
  };

  const liveExternalSummary = useMemo(() => {
    const selectedRowsList = finalData.filter((row: any, idx: number) =>
      selected.includes(getRowKey(row, idx))
    );
    return computeExternalSummary(sortedData, visibleCols, {
      selectedRows: selectedRowsList,
      totalRowCount: finalData.length,
      aiSummary: aiSummaryText,
      aiInsights: aiInsightsList || undefined,
    });
  }, [sortedData, visibleCols, selected, finalData, aiSummaryText, aiInsightsList, keyField]);

  const onSummaryChangeRef = useRef(onSummaryChange);
  onSummaryChangeRef.current = onSummaryChange;
  const lastSummarySignatureRef = useRef<string>('');

  useEffect(() => {
    if (!onSummaryChangeRef.current) return;
    const signature = JSON.stringify({
      activeRowCount: liveExternalSummary.activeRowCount,
      totalRowCount: liveExternalSummary.totalRowCount,
      selectedRowCount: liveExternalSummary.selectedRowCount,
      executiveSummary: liveExternalSummary.executiveSummary,
      aiSummary: liveExternalSummary.aiSummary,
      stats: liveExternalSummary.columnStats.map((s) => `${s.columnId}:${s.formattedAvg || s.topValue || ''}`),
    });
    if (signature !== lastSummarySignatureRef.current) {
      lastSummarySignatureRef.current = signature;
      onSummaryChangeRef.current(liveExternalSummary);
    }
  }, [liveExternalSummary]);

  const showExternalTop =
    externalSummary === true || externalSummary === 'top' || externalSummary === 'both';
  const showExternalBottom =
    externalSummary === 'bottom' || externalSummary === 'both';

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[9990] bg-white dark:bg-slate-950 p-4 sm:p-6 overflow-y-auto space-y-4' : 'w-full space-y-4'}>
      {showExternalTop && (
        <SafeFeatureBoundary>
          <TableSummary
            summaryData={liveExternalSummary}
            title={externalSummaryTitle || 'External Table Data Summary'}
            variant={externalSummaryVariant}
            llmConfig={effectiveLlmConfig}
            theme={themeObj.colorScheme === 'dark' ? 'dark' : 'light'}
          />
        </SafeFeatureBoundary>
      )}
    <div 
      ref={rootContainerRef}
      dir={direction}
      className={`w-full flex flex-col font-sans relative rounded-xl border ${disabled ? 'opacity-60 select-none' : ''} ${className}`}
      style={rootStyle}
      aria-label={ariaLabel}
    >
      {/* Header bar */}
      {hasHeader && (
        <div 
          className="p-3 sm:p-4 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4 bg-slate-50"
          style={headerStyle}
        >
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
            {plugins?.map((p, idx) => p.renderToolbarLeft && (
              <React.Fragment key={`p-tb-left-${idx}`}>
                {p.renderToolbarLeft()}
              </React.Fragment>
            ))}
            {selected.length > 0 && isSelectableRows ? (() => {
              const selectedRowsList = finalData.filter((row: any, idx: number) =>
                selected.includes(getRowKey(row, idx))
              );
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 tabular-nums">
                    <span>{selected.length} selected</span>
                    <button
                      type="button"
                      onClick={() => !disabled && updateSelection([])}
                      disabled={disabled}
                      className="ml-1 text-indigo-500 hover:text-indigo-800 font-medium disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                  {isExportable && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => exportCSV(selectedRowsList)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Export Selected</span>
                    </button>
                  )}
                  {bulkActions?.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => action.onClick(selectedRowsList, () => updateSelection([]))}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border ${
                        action.variant === 'danger'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : action.variant === 'primary'
                          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  ))}
                  {onDeleteRows && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onDeleteRows(selectedRowsList);
                        updateSelection([]);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete ({selected.length})</span>
                    </button>
                  )}
                </div>
              );
            })() : (
              title !== undefined ? (
                typeof title === 'string' ? (
                  <h3 className="font-bold text-base sm:text-lg truncate" style={{ color: themeObj.text.primary }}>{title}</h3>
                ) : (
                  title
                )
              ) : (
                <h3 className="font-semibold" style={{ color: themeObj.text.primary }}>Movies</h3>
              )
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto min-w-0">
            {plugins?.map((p, idx) => p.renderToolbarRight && (
              <React.Fragment key={`p-tb-right-${idx}`}>
                {p.renderToolbarRight()}
              </React.Fragment>
            ))}
            {/* Custom actions rendered on the right side of the header */}
            {actions !== undefined && (
              <div className="flex items-center gap-2 mr-1">
                {React.Children.map(actions, (action, idx) => (
                  <div key={idx}>{action}</div>
                ))}
              </div>
            )}

            {onAddRow && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (onAddRow.length === 0) {
                    onAddRow();
                  } else {
                    const initial: Record<string, string> = {};
                    finalColumns.forEach(col => {
                      if (!col.button && !col.sparkline && col.id !== 'plugin-actions') {
                        initial[String(col.id || col.name)] = '';
                      }
                    });
                    setNewRowDraft(initial);
                    setShowAddRowModal(true);
                  }
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{addRowLabel}</span>
              </button>
            )}

            {onImportRows && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  notifyProFeatureUsed('CSV / TSV Import');
                  setImportRawText('');
                  setImportError(null);
                  setShowImportModal(true);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                title="Import rows from CSV or TSV"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Import CSV</span>
                {renderProBadge('light')}
              </button>
            )}

            {isAiQueryEnabled && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  notifyProFeatureUsed('AI Query Assistant');
                  await handleBuiltInAiQuery(aiQueryText);
                }}
                className="flex items-center gap-1.5 w-full sm:w-auto min-w-0"
              >
                <div className="relative flex items-center flex-1 sm:flex-none min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ask AI to filter (e.g. rating > 4.7)..."
                    value={aiQueryText}
                    onChange={(e) => setAiQueryText(e.target.value)}
                    disabled={disabled || isAiSearching}
                    style={{
                      backgroundColor: themeObj.background.default === '#ffffff' ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                      color: themeObj.text.primary,
                      borderColor: themeObj.divider.default
                    }}
                    className="pl-8 pr-6 py-1.5 text-xs border rounded-md outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-52 min-w-0 transition-all"
                  />
                  {aiQueryText && (
                    <button
                      type="button"
                      onClick={() => {
                        setAiQueryText('');
                        setAiFilteredData(null);
                        setActiveAiQueryLabel(null);
                      }}
                      className="absolute right-1.5 text-slate-400 hover:text-slate-600 p-0.5"
                      title="Clear AI query"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={disabled || isAiSearching}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>{isAiSearching ? 'Thinking...' : 'Ask AI'}</span>
                  {renderProBadge('solid')}
                </button>
              </form>
            )}

            {isAiInsightsEnabled && (
              <button
                type="button"
                disabled={disabled || isGeneratingAiInsights}
                onClick={() => {
                  notifyProFeatureUsed('AI KPI Insights');
                  handleBuiltInAiInsights();
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingAiInsights ? 'Analyzing...' : 'AI Insights'}</span>
                {renderProBadge('solid')}
              </button>
            )}

            {isAiSummaryEnabled && (
              <button
                type="button"
                disabled={disabled || isGeneratingAiSummary}
                onClick={() => {
                  notifyProFeatureUsed('AI Executive Summary');
                  handleBuiltInAiSummary();
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-md hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{isGeneratingAiSummary ? 'Summarizing...' : 'AI Summary'}</span>
                {renderProBadge('solid')}
              </button>
            )}

            {(isAiQueryEnabled || isAiInsightsEnabled || isAiSummaryEnabled || !!llmConfig) && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  notifyProFeatureUsed('Universal Multi-LLM Config');
                  setShowLlmModal(true);
                }}
                className="p-1.5 text-xs font-medium border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 rounded-md transition-colors flex items-center gap-1 shrink-0"
                title="Configure Universal LLM Provider (OpenAI, Claude, Gemini, Ollama, Custom)"
              >
                <Bot className="w-4 h-4" />
                <span className="hidden xl:inline text-[11px] font-semibold uppercase tracking-wide">
                  {effectiveLlmConfig.provider || 'LLM'}
                </span>
                {renderProBadge('mini')}
              </button>
            )}

            {isSearchable && (
              <div className="relative flex-1 min-w-[150px] sm:flex-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search records..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={disabled}
                  style={{ 
                    backgroundColor: themeObj.background.default === '#ffffff' ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                    color: themeObj.text.primary,
                    borderColor: themeObj.divider.default
                  }}
                  className={`pl-9 ${isCommandPaletteEnabled ? 'pr-12' : 'pr-4'} py-1.5 text-sm border rounded-md outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full sm:w-48 transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {isCommandPaletteEnabled && (
                  <kbd 
                    onClick={() => !disabled && setIsCommandPaletteOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 hover:bg-slate-200 cursor-pointer border border-slate-200 rounded select-none transition-all active:scale-95"
                    title="Open Command Palette (Ctrl + K)"
                  >
                    <span>⌘</span><span>K</span>
                  </kbd>
                )}
              </div>
            )}

            {(isColumnVisibility || isDensityToggle || isExportable || config?.mapView || config?.calendarView || config?.kanbanView || config?.galleryView || config?.savedViews || config?.shareableViews || config?.auditTrail || config?.timeTravel || config?.bookmarks || config?.offlineEditing || isCommandPaletteEnabled || isNarrowViewport || mobileViewOverride !== null) && (
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 sm:border-l sm:pl-3" style={{ borderColor: themeObj.divider.default }}>
                {config?.timeTravel && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => !disabled && handleUndo()}
                      disabled={disabled || historyIndex <= 0}
                      style={{ color: themeObj.text.secondary }}
                      className="p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Undo State Change (Time Travel Back)"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => !disabled && handleRedo()}
                      disabled={disabled || historyIndex >= historyStack.length - 1}
                      style={{ color: themeObj.text.secondary }}
                      className="p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Redo State Change (Time Travel Forward)"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                    <div className="relative" ref={timeTravelMenuRef}>
                      <button
                        onClick={() => {
                          if (disabled) return;
                          notifyProFeatureUsed('Time Travel Replay');
                          setShowTimeTravel(!showTimeTravel);
                        }}
                        disabled={disabled}
                        style={{ color: showTimeTravel ? themeObj.context.text : themeObj.text.secondary }}
                        className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${showTimeTravel ? 'bg-indigo-50/80' : ''}`}
                        title="Timeline Replay (Time Travel Panel)"
                      >
                        <Clock className="w-4 h-4" />
                        {renderProBadge('mini')}
                      </button>
                      
                      {showTimeTravel && !disabled && (
                        <div
                          style={{ backgroundColor: themeObj.background.default, borderColor: themeObj.divider.default }}
                          className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-64 max-w-[92vw] border shadow-lg rounded-lg py-2 z-30 text-sm flex flex-col"
                        >
                          <div className="px-3 pb-2 mb-2 border-b" style={{ borderColor: themeObj.divider.default }}>
                            <div className="font-semibold text-xs uppercase tracking-wider mb-1 flex items-center justify-between" style={{ color: themeObj.text.secondary }}>
                              <span>Time Travel Replay</span>
                              {renderProBadge('light')}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Replay or restore previous layout, filter, and search states.
                            </div>
                          </div>
                          
                          <div className="max-h-60 overflow-y-auto px-1 space-y-1">
                            {historyStack.length === 0 ? (
                              <div className="px-3 py-2 text-xs italic text-center" style={{ color: themeObj.text.disabled }}>
                                No history recorded yet.
                              </div>
                            ) : (
                              historyStack.map((item, idx) => {
                                const isActive = idx === historyIndex;
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => jumpToHistoryIndex(idx)}
                                    className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-start gap-2 ${isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                  >
                                    <div className="flex-grow min-w-0">
                                      <div className={`text-xs font-medium truncate ${isActive ? 'text-indigo-600' : 'text-slate-800'}`}>
                                        {item.label}
                                      </div>
                                      <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
                                        {item.timestamp.toLocaleTimeString()}
                                      </div>
                                    </div>
                                    {isActive && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                          
                          {historyStack.length > 0 && (
                            <div className="px-3 pt-2 mt-2 border-t text-center" style={{ borderColor: themeObj.divider.default }}>
                              <button
                                onClick={() => {
                                  setHistoryStack([]);
                                  setHistoryIndex(-1);
                                  setShowTimeTravel(false);
                                }}
                                className="text-[10px] text-red-500 hover:text-red-700 font-medium transition-colors"
                              >
                                Clear History
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {config?.auditTrail && (
                  <button 
                    onClick={() => {
                      if (disabled) return;
                      notifyProFeatureUsed('Audit Trail');
                      setShowAuditModal(true);
                    }}
                    disabled={disabled}
                    style={{ color: themeObj.text.secondary }}
                    className="p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                    title="Audit Trail"
                  >
                    <History className="w-4 h-4" />
                    {renderProBadge('mini')}
                  </button>
                )}
                {config?.shareableViews && (
                  <div className="relative">
                    <button 
                      onClick={() => {
                        if (disabled) return;
                        notifyProFeatureUsed('Shareable Views');
                        copyShareLink();
                      }}
                      disabled={disabled}
                      style={{ color: showShareToast ? themeObj.context.text : themeObj.text.secondary }}
                      className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${showShareToast ? 'bg-green-50 text-green-600' : ''}`}
                      title={showShareToast ? "Link Copied!" : "Share View"}
                    >
                      <Share2 className="w-4 h-4" />
                      {renderProBadge('mini')}
                    </button>
                    {showShareToast && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-xs font-medium rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                        Link copied!
                      </div>
                    )}
                  </div>
                )}
                {config?.bookmarks && (
                  <button 
                    onClick={() => {
                      if (disabled) return;
                      notifyProFeatureUsed('Row Bookmarks');
                      setShowOnlyBookmarked(!showOnlyBookmarked);
                    }}
                    disabled={disabled}
                    style={{ color: showOnlyBookmarked ? '#f59e0b' : themeObj.text.secondary }}
                    className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${showOnlyBookmarked ? 'bg-amber-50/80 text-amber-600' : ''}`}
                    title={showOnlyBookmarked ? "Show All Rows" : "Show Bookmarks Only"}
                  >
                    <Star className={`w-4 h-4 ${showOnlyBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
                    {renderProBadge('mini')}
                  </button>
                )}
                {config?.offlineEditing && (
                  <div className="relative" ref={offlineMenuRef}>
                    <button 
                      onClick={() => !disabled && setShowOfflineMenu(!showOfflineMenu)}
                      disabled={disabled}
                      style={{ 
                        color: !actualOnline 
                          ? '#f97316' 
                          : offlineChanges.filter(c => c.status === 'pending').length > 0 
                          ? '#3b82f6' 
                          : themeObj.text.secondary 
                      }}
                      className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${
                        !actualOnline ? 'bg-orange-50/80 text-orange-600' :
                        offlineChanges.filter(c => c.status === 'pending').length > 0 ? 'bg-blue-50/80 text-blue-600' : ''
                      }`}
                      title="Offline Sync Center"
                    >
                      {!actualOnline ? (
                        <CloudOff className="w-4 h-4" />
                      ) : (
                        <Cloud className="w-4 h-4" />
                      )}
                      {offlineChanges.filter(c => c.status === 'pending').length > 0 && (
                        <span className="text-[10px] font-bold font-mono bg-indigo-600 text-white rounded-full px-1.5 min-w-[16px] h-4 flex items-center justify-center">
                          {offlineChanges.filter(c => c.status === 'pending').length}
                        </span>
                      )}
                    </button>
                    
                    {showOfflineMenu && !disabled && (
                      <div 
                        style={{ backgroundColor: themeObj.background.default, borderColor: themeObj.divider.default }}
                        className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-[92vw] border shadow-lg rounded-lg py-3 px-3 z-50 text-sm overflow-hidden flex flex-col max-h-[400px]"
                      >
                        <div className="flex items-center justify-between border-b pb-2 mb-2" style={{ borderColor: themeObj.divider.default }}>
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            Offline Sync Center
                          </span>
                          <button 
                            type="button"
                            onClick={() => setShowOfflineMenu(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Online/Offline Toggle */}
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg mb-3 border border-slate-100">
                          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                            Network: {actualOnline ? (
                              <span className="text-emerald-600 font-bold">Online</span>
                            ) : (
                              <span className="text-orange-500 font-bold">Offline (Simulated)</span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSimulatedOffline(!simulatedOffline)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                              simulatedOffline 
                                ? 'bg-orange-500 text-white border-orange-500' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {simulatedOffline ? 'Go Online' : 'Go Offline'}
                          </button>
                        </div>

                        {/* Sync Controls */}
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Pending edits in queue:</span>
                            <span className="font-bold font-mono text-slate-700">{offlineChanges.filter(c => c.status === 'pending').length}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={offlineChanges.filter(c => c.status === 'pending').length === 0 || !actualOnline || isSyncing}
                              onClick={syncOfflineChanges}
                              className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded font-semibold text-xs hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
                            >
                              {isSyncing ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Syncing...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Sync to Server</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={offlineChanges.filter(c => c.status === 'pending').length === 0 || isSyncing}
                              onClick={clearOfflineChanges}
                              className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded font-semibold text-xs hover:bg-slate-200 disabled:opacity-40 transition-colors"
                            >
                              Discard
                            </button>
                          </div>
                        </div>

                        {/* Changes List */}
                        <div className="border-t pt-2 max-h-48 overflow-y-auto" style={{ borderColor: themeObj.divider.default }}>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Pending Changes</span>
                          {offlineChanges.filter(c => c.status === 'pending').length === 0 ? (
                            <div className="text-xs text-slate-400 italic text-center py-4">No pending offline changes. Try editing a cell while offline!</div>
                          ) : (
                            <div className="space-y-2 pr-1">
                              {offlineChanges.filter(c => c.status === 'pending').map(change => (
                                <div key={change.id} className="text-xs border border-slate-100 p-2 rounded-lg bg-slate-50/50 flex flex-col">
                                  <div className="flex justify-between font-semibold text-slate-700 mb-0.5">
                                    <span>Row ID: {String(change.rowId)}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">{new Date(change.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <div className="text-slate-500 text-[11px] truncate">
                                    Field: <strong className="text-indigo-600">{change.columnName}</strong>
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-1">
                                    <span className="line-through text-slate-400">{String(change.oldValue || 'empty')}</span>
                                    <span>→</span>
                                    <span className="text-emerald-600 font-semibold">{String(change.newValue)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {isCommandPaletteEnabled && (
                  <button 
                    onClick={() => {
                      if (disabled) return;
                      notifyProFeatureUsed('Command Palette');
                      setIsCommandPaletteOpen(true);
                    }}
                    disabled={disabled}
                    style={{ color: themeObj.text.secondary }}
                    className="p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                    title="Command Palette (Ctrl + K)"
                  >
                    <Command className="w-4 h-4" />
                    {renderProBadge('mini')}
                  </button>
                )}
                {config?.savedViews && (
                  <div className="relative" ref={savedViewsMenuRef}>
                    <button 
                      onClick={() => {
                        if (disabled) return;
                        notifyProFeatureUsed('Saved Views');
                        setShowSavedViewsMenu(!showSavedViewsMenu);
                      }}
                      disabled={disabled}
                      style={{ color: showSavedViewsMenu ? themeObj.context.text : themeObj.text.secondary }}
                      className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${showSavedViewsMenu ? 'bg-indigo-50/80' : ''}`}
                      title="Saved Views"
                    >
                      <Bookmark className="w-4 h-4" />
                      {renderProBadge('mini')}
                    </button>
                    {showSavedViewsMenu && !disabled && (
                      <div 
                        style={{ backgroundColor: themeObj.background.default, borderColor: themeObj.divider.default }}
                        className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-64 max-w-[92vw] border shadow-lg rounded-lg py-2 z-30 text-sm overflow-hidden flex flex-col"
                      >
                        <div className="px-3 pb-2 mb-2 border-b" style={{ borderColor: themeObj.divider.default }}>
                          <div className="font-semibold text-xs uppercase tracking-wider mb-2 flex items-center justify-between" style={{ color: themeObj.text.secondary }}>
                            <span>Save Current View</span>
                            {renderProBadge('light')}
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newViewName}
                              onChange={(e) => setNewViewName(e.target.value)}
                              placeholder="View name..."
                              className="flex-1 text-xs px-2 py-1.5 border rounded outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCurrentView();
                              }}
                            />
                            <button
                              onClick={saveCurrentView}
                              disabled={!newViewName.trim()}
                              className="px-2 py-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 disabled:opacity-50 transition-colors flex items-center justify-center"
                              title="Save View"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="font-semibold text-xs uppercase tracking-wider px-3 pb-1 pt-1" style={{ color: themeObj.text.secondary }}>
                          Saved Views
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {savedViewsList.length === 0 ? (
                            <div className="px-4 py-3 text-xs italic text-center" style={{ color: themeObj.text.disabled }}>
                              No saved views yet.
                            </div>
                          ) : (
                            savedViewsList.map(view => (
                              <button
                                key={view.id}
                                onClick={() => loadSavedView(view.id)}
                                className={`w-full text-left px-4 py-2 hover:bg-slate-100/50 transition-colors flex items-center justify-between group ${activeSavedViewId === view.id ? 'bg-indigo-50/50' : ''}`}
                              >
                                <span className={`text-sm truncate pr-2 ${activeSavedViewId === view.id ? 'font-medium text-indigo-600' : 'text-slate-700'}`}>
                                  {view.name}
                                </span>
                                {activeSavedViewId === view.id && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {config?.mapView && (
                  <button 
                    onClick={() => {
                      if (disabled) return;
                      notifyProFeatureUsed('Geospatial Map View');
                      setViewMode(viewMode === 'map' ? 'table' : 'map');
                    }}
                    disabled={disabled}
                    style={{ color: viewMode === 'map' ? themeObj.context.text : themeObj.text.secondary }}
                    className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${viewMode === 'map' ? 'bg-indigo-50/80' : ''}`}
                    title="Map View"
                  >
                    <MapIcon className="w-4 h-4" />
                    {renderProBadge('mini')}
                  </button>
                )}
                {config?.calendarView && (
                  <button 
                    onClick={() => {
                      if (disabled) return;
                      notifyProFeatureUsed('Calendar View');
                      setViewMode(viewMode === 'calendar' ? 'table' : 'calendar');
                    }}
                    disabled={disabled}
                    style={{ color: viewMode === 'calendar' ? themeObj.context.text : themeObj.text.secondary }}
                    className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${viewMode === 'calendar' ? 'bg-indigo-50/80' : ''}`}
                    title="Calendar View"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    {renderProBadge('mini')}
                  </button>
                )}
                {config?.kanbanView && (
                  <button 
                    onClick={() => {
                      if (disabled) return;
                      notifyProFeatureUsed('Kanban Board View');
                      setViewMode(viewMode === 'kanban' ? 'table' : 'kanban');
                    }}
                    disabled={disabled}
                    style={{ color: viewMode === 'kanban' ? themeObj.context.text : themeObj.text.secondary }}
                    className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${viewMode === 'kanban' ? 'bg-indigo-50/80' : ''}`}
                    title="Kanban View"
                  >
                    <Trello className="w-4 h-4" />
                    {renderProBadge('mini')}
                  </button>
                )}
                {config?.galleryView && (
                  <button 
                    onClick={() => {
                      if (disabled) return;
                      notifyProFeatureUsed('Gallery Card View');
                      setViewMode(viewMode === 'gallery' ? 'table' : 'gallery');
                    }}
                    disabled={disabled}
                    style={{ color: viewMode === 'gallery' ? themeObj.context.text : themeObj.text.secondary }}
                    className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1 ${viewMode === 'gallery' ? 'bg-indigo-50/80' : ''}`}
                    title="Gallery View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    {renderProBadge('mini')}
                  </button>
                )}
                {viewMode === 'table' && responsiveLayout === 'auto' && (isNarrowViewport || mobileViewOverride !== null) && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setMobileViewOverride(isMobileCardView ? 'scroll' : 'cards')}
                    className="px-2 py-1 text-[11px] font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-md transition-colors flex items-center gap-1 shrink-0"
                    title={isMobileCardView ? 'Switch to Scrollable Table' : 'Switch to Mobile Cards'}
                  >
                    {isMobileCardView ? <TableIcon className="w-3.5 h-3.5 text-indigo-600" /> : <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />}
                    <span>{isMobileCardView ? 'Table' : 'Cards'}</span>
                  </button>
                )}
                <div className="w-px h-4 bg-slate-200/60 mx-1"></div>
                {(isColumnVisibility || isDensityToggle) && (
                  <div className="relative" ref={menuRef}>
                    <button 
                      onClick={() => !disabled && setShowColumnsMenu(!showColumnsMenu)}
                      disabled={disabled}
                      style={{ color: themeObj.text.secondary }}
                      className="p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50"
                      title="Columns, Pinning, Grouping & Density"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                    
                    {showColumnsMenu && !disabled && (
                      <div 
                        style={{ backgroundColor: themeObj.background.default, borderColor: themeObj.divider.default }}
                        className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-64 max-w-[92vw] border shadow-lg rounded-lg py-2 z-30 text-sm"
                      >
                        {isColumnVisibility && (
                          <>
                            <div 
                              style={{ color: themeObj.text.secondary, borderColor: themeObj.divider.default }}
                              className="px-3 pb-2 mb-1 border-b font-semibold text-xs uppercase tracking-wider flex items-center justify-between"
                            >
                              <span className="flex items-center gap-1.5">
                                <Pin className="w-3 h-3 opacity-60" />
                                <span>Columns & Pinning</span>
                                {renderProBadge('light')}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  resetLayout();
                                  setShowColumnsMenu(false);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold normal-case tracking-normal text-indigo-600 hover:text-indigo-700 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition-colors"
                                title="Reset column order, visibility, widths, pinning & grouping"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reset</span>
                              </button>
                            </div>
                            <div className="max-h-52 overflow-y-auto">
                              {finalColumns.map(col => {
                                const colId = String(col.id || col.name).toLowerCase();
                                const currentPin = pinnedColumns[colId] ?? col.pinned ?? null;
                                return (
                                  <div key={colId} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-100/40 gap-2">
                                    <span className="capitalize truncate text-xs font-medium" style={{ color: themeObj.text.primary }}>{col.name}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          notifyProFeatureUsed('Column Pinning');
                                          setPinnedColumns(prev => ({
                                            ...prev,
                                            [colId]: currentPin === 'left' ? 'right' : currentPin === 'right' ? null : 'left',
                                          }));
                                        }}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                                          currentPin
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                                            : 'text-slate-400 border-transparent hover:border-slate-200'
                                        }`}
                                        title="Cycle Pin: Left → Right → Unpinned"
                                      >
                                        {currentPin === 'left' ? 'Pin:L' : currentPin === 'right' ? 'Pin:R' : 'Pin'}
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setVisibleColumns(prev => ({...prev, [colId]: !prev[colId]}))}
                                        className={`p-0.5 rounded transition-colors ${visibleColumns[colId] !== false ? 'text-indigo-600' : 'text-slate-300'}`}
                                        title="Toggle Visibility"
                                      >
                                        {visibleColumns[colId] !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}

                        {/* Row Grouping Selector */}
                        <div className="px-3 pt-2 mt-2 border-t" style={{ borderColor: themeObj.divider.default }}>
                          <div className="font-semibold text-xs uppercase tracking-wider mb-1.5 flex items-center justify-between" style={{ color: themeObj.text.secondary }}>
                            <span className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5" />
                              <span>Group Rows By</span>
                            </span>
                            {renderProBadge('light')}
                          </div>
                          <select
                            value={activeGroupBy}
                            onChange={(e) => {
                              if (e.target.value) notifyProFeatureUsed('Row Grouping');
                              setActiveGroupBy(e.target.value);
                              setCollapsedGroups(new Set());
                            }}
                            className="w-full text-xs border rounded px-2 py-1.5 bg-transparent outline-none focus:ring-1 focus:ring-indigo-500"
                            style={{ borderColor: themeObj.divider.default, color: themeObj.text.primary }}
                          >
                            <option value="" style={{ backgroundColor: themeObj.background.default }}>None (Flat Table)</option>
                            {finalColumns.filter(c => c.id !== 'plugin-actions' && !c.sparkline).map(col => {
                              const colId = String(col.id || col.name);
                              return (
                                <option key={colId} value={colId} style={{ backgroundColor: themeObj.background.default }}>
                                  {typeof col.name === 'string' || typeof col.name === 'number' ? col.name : colId}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        
                        {isDensityToggle && (
                          <>
                            <div className="px-3 pt-2 mt-2 border-t" style={{ borderColor: themeObj.divider.default }}></div>
                            <div 
                              style={{ color: themeObj.text.secondary, borderColor: themeObj.divider.default }}
                              className="px-3 pb-1 font-semibold text-xs uppercase tracking-wider"
                            >
                              Density
                            </div>
                            <div className="px-3 py-1.5 flex gap-1">
                              {(['compact', 'normal', 'spacious'] as const).map(d => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setDensity(d)}
                                  className={`flex-1 py-1 text-xs rounded transition-colors capitalize ${density === d ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-100/50'}`}
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isExportable && (
                  <div className="relative" ref={exportMenuRef}>
                    <button 
                      type="button"
                      onClick={() => !disabled && setShowExportMenu(prev => !prev)}
                      disabled={disabled}
                      style={{ color: themeObj.text.secondary }}
                      className="p-1.5 hover:bg-slate-200/50 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Export Data (CSV, JSON, Markdown, Clipboard)"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {exportToast && (
                      <div className="absolute right-0 top-full mt-2 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                        {exportToast}
                      </div>
                    )}
                    {showExportMenu && !disabled && (
                      <div
                        style={{ backgroundColor: themeObj.background.default, borderColor: themeObj.divider.default }}
                        className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-56 max-w-[92vw] border shadow-lg rounded-lg py-1.5 z-30 text-xs"
                      >
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Export Format
                        </div>
                        <button
                          type="button"
                          onClick={() => exportCSV()}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100/60 flex items-center justify-between font-medium"
                          style={{ color: themeObj.text.primary }}
                        >
                          <span>CSV Spreadsheet</span>
                          <span className="font-mono text-[10px] text-slate-400">.csv</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportJSON()}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100/60 flex items-center justify-between font-medium"
                          style={{ color: themeObj.text.primary }}
                        >
                          <span>JSON Records</span>
                          <span className="font-mono text-[10px] text-slate-400">.json</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            notifyProFeatureUsed('Markdown Table Export');
                            exportMarkdown();
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100/60 flex items-center justify-between font-medium"
                          style={{ color: themeObj.text.primary }}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>Markdown Table</span>
                            {renderProBadge('light')}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">.md</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            notifyProFeatureUsed('HTML Report Export');
                            exportHTML();
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100/60 flex items-center justify-between font-medium"
                          style={{ color: themeObj.text.primary }}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>HTML Report</span>
                            {renderProBadge('light')}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">.html</span>
                        </button>
                        <div className="my-1 border-t" style={{ borderColor: themeObj.divider.default }} />
                        <button
                          type="button"
                          onClick={copyTableTSV}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100/60 flex items-center justify-between font-medium text-indigo-600"
                        >
                          <span>Copy TSV (Excel/Sheets)</span>
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            notifyProFeatureUsed('Copy as Markdown');
                            void copyTableMarkdown();
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100/60 flex items-center justify-between font-medium text-indigo-600"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>Copy as Markdown</span>
                            {renderProBadge('light')}
                          </span>
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowExportMenu(false);
                            if (typeof window !== 'undefined' && window.print) {
                              window.print();
                            }
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100/60 flex items-center justify-between font-medium"
                          style={{ color: themeObj.text.primary }}
                        >
                          <span>Print View</span>
                          <Printer className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isFullscreenEnabled && (
                  <button
                    type="button"
                    onClick={() => !disabled && setIsFullscreen(prev => !prev)}
                    disabled={disabled}
                    style={{ color: isFullscreen ? themeObj.context.text : themeObj.text.secondary }}
                    className={`p-1.5 hover:bg-slate-200/50 rounded-md transition-colors disabled:opacity-50 ${isFullscreen ? 'bg-indigo-50/80' : ''}`}
                    title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen Table'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Filters Bar */}
      {quickFilters && quickFilters.length > 0 && (
        <div
          className="px-4 py-2 border-b flex flex-wrap items-center gap-2 text-xs"
          style={{
            backgroundColor: themeObj.background.default,
            borderColor: themeObj.divider.default,
          }}
        >
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Quick Filters:
          </span>
          <button
            type="button"
            onClick={() => setActiveQuickFilterIds([])}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeQuickFilterIds.length === 0
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({finalData.length})
          </button>
          {quickFilters.map((qf) => {
            const isActive = activeQuickFilterIds.includes(qf.id);
            const matchCount = finalData.filter(qf.predicate).length;
            return (
              <button
                key={qf.id}
                type="button"
                onClick={() =>
                  setActiveQuickFilterIds((prev) =>
                    prev.includes(qf.id) ? prev.filter((x) => x !== qf.id) : [...prev, qf.id]
                  )
                }
                className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums border ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {qf.label} ({matchCount})
              </button>
            );
          })}
        </div>
      )}

      {/* Active Filter & View State Bar */}
      {(() => {
        const activeFilterEntries = Object.entries(activeFilters).filter(
          ([, f]) => f && ((f.value !== undefined && String(f.value).trim() !== '') || f.operator === 'isEmpty' || f.operator === 'isNotEmpty')
        );
        const activePinEntries = Object.entries(pinnedColumns).filter(([, dir]) => !!dir);
        const hasAnyActiveState =
          Boolean(search.trim()) ||
          activeFilterEntries.length > 0 ||
          activeAiQueryLabel !== null ||
          Boolean(activeGroupBy) ||
          showOnlyBookmarked ||
          activePinEntries.length > 0;

        if (!hasAnyActiveState) return null;

        return (
          <div
            className="px-4 py-2 border-b flex flex-wrap items-center gap-2 text-xs"
            style={{
              backgroundColor: themeObj.background.default === '#ffffff' ? '#f8fafc' : themeObj.background.default,
              borderColor: themeObj.divider.default,
            }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Active:
            </span>

            {search.trim() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium">
                <span>Search: &ldquo;{search}&rdquo;</span>
                <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {activeAiQueryLabel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium">
                <Sparkles className="w-3 h-3" />
                <span>AI Query: &ldquo;{activeAiQueryLabel}&rdquo; ({aiFilteredData?.length ?? 0} matches)</span>
                <button
                  type="button"
                  onClick={() => {
                    setAiFilteredData(null);
                    setActiveAiQueryLabel(null);
                    setAiQueryText('');
                  }}
                  className="text-indigo-400 hover:text-indigo-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {activeGroupBy && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 font-medium">
                <Layers className="w-3 h-3" />
                <span>Grouped by: {activeGroupBy}</span>
                <button type="button" onClick={() => setActiveGroupBy('')} className="text-purple-400 hover:text-purple-700">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {showOnlyBookmarked && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                <Star className="w-3 h-3 fill-amber-400" />
                <span>Bookmarked Only</span>
                <button type="button" onClick={() => setShowOnlyBookmarked(false)} className="text-amber-500 hover:text-amber-800">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {activeFilterEntries.map(([colId, fState]) => (
              <span key={colId} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium">
                <span className="capitalize">{colId}</span>
                <span className="text-slate-400 font-mono text-[10px]">{fState.operator}</span>
                {fState.value !== undefined && String(fState.value) !== '' && (
                  <span className="font-mono font-semibold">{String(fState.value)}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (onFilterChange) {
                      onFilterChange(colId, { value: '', operator: 'contains' });
                    } else {
                      setInternalFilters(prev => {
                        const next = { ...prev };
                        delete next[colId];
                        return next;
                      });
                    }
                  }}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {activePinEntries.map(([colId, dir]) => (
              <span key={`pin-${colId}`} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                <Pin className="w-3 h-3" />
                <span className="capitalize">{colId} ({dir})</span>
                <button
                  type="button"
                  onClick={() => setPinnedColumns(prev => ({ ...prev, [colId]: null }))}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            <button
              type="button"
              onClick={() => {
                setSearch('');
                setAiFilteredData(null);
                setActiveAiQueryLabel(null);
                setAiQueryText('');
                setActiveGroupBy('');
                setShowOnlyBookmarked(false);
                setInternalFilters({});
                setPinnedColumns({});
              }}
              className="ml-auto text-[11px] font-semibold text-rose-600 hover:text-rose-700 px-2 py-0.5 rounded hover:bg-rose-50 transition-colors"
            >
              Reset All
            </button>
          </div>
        );
      })()}

      {/* Sub Header bar */}
      {subHeader !== undefined && (
        <div 
          className={`p-3 border-b flex gap-3 items-center ${
            subHeaderAlign === 'left' ? 'justify-start' : 
            subHeaderAlign === 'center' ? 'justify-center' : 'justify-end'
          } ${subHeaderWrap ? 'flex-wrap' : 'flex-nowrap overflow-x-auto'}`}
          style={subHeaderStyle}
        >
          {subHeader}
        </div>
      )}

      {/* Pro Feature Donation Notification Banner (shown when Pro features are active/used and user has not yet donated) */}
      {!effectiveDonated && !proNotificationDismissed && (
        Boolean(
          proNotificationFeature ||
          isAiQueryEnabled ||
          isAiInsightsEnabled ||
          isAiSummaryEnabled ||
          llmConfig ||
          onImportRows ||
          groupBy ||
          activeGroupBy ||
          virtualize ||
          externalSummary ||
          config?.mapView ||
          config?.calendarView ||
          config?.kanbanView ||
          config?.galleryView ||
          config?.timeTravel ||
          config?.auditTrail ||
          config?.shareableViews ||
          config?.savedViews ||
          config?.offlineEditing ||
          config?.bookmarks ||
          config?.commandPalette ||
          config?.sidePreview ||
          rawColumns.some(c => c.sparkline || c.heatmap || c.pinned || c.aggregation)
        )
      ) && (
        <div
          className="px-4 py-2.5 border-b bg-amber-50/90 flex flex-wrap items-center justify-between gap-3 text-xs"
          style={{ borderColor: themeObj.divider.default }}
        >
          <div className="flex items-center gap-2 text-amber-950 min-w-0">
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-extrabold uppercase tracking-wider rounded bg-amber-400 text-slate-950 shrink-0">
              PRO
            </span>
            <span className="font-medium leading-snug">
              {proNotificationFeature ? (
                <>
                  <strong>{proNotificationFeature}</strong> is unlocked and active. All Pro features are open to use — support the project with a donation to remove all PRO badges and notifications.
                </>
              ) : (
                <>
                  <strong>Pro Features Active</strong> — All Pro features are unlocked for you to use. Donate to support EnterpriseGrid and remove all PRO badges &amp; notifications.
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowDonationModal(true)}
              className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap"
            >
              Donate &amp; Remove Badges
            </button>
            <button
              type="button"
              onClick={() => setProNotificationDismissed(true)}
              className="p-1 text-amber-700 hover:text-amber-950 rounded transition-colors"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Built-in AI Smart Summary Panel */}
      {aiSummaryText && (
        <div className="p-4 border-b bg-indigo-50/50 flex items-start justify-between gap-4" style={{ borderColor: themeObj.divider.default }}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">AI Executive Summary</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  {effectiveLlmConfig.provider || 'auto'}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{aiSummaryText}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAiSummaryText(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
            title="Dismiss Summary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Built-in AI Insights Panel */}
      {aiInsightsList && aiInsightsList.length > 0 && (
        <div className="p-4 border-b bg-slate-50/60 relative" style={{ borderColor: themeObj.divider.default }}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              AI Generated KPI Insights ({effectiveLlmConfig.provider || 'auto'})
            </span>
            <button
              type="button"
              onClick={() => setAiInsightsList(null)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {aiInsightsList.map((insight, idx) => (
              <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{insight.title}</span>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-xl font-bold font-mono tabular-nums text-slate-800">{insight.value}</span>
                  {insight.trend === 'up' && <span className="text-emerald-600 text-xs font-semibold">▲ Up</span>}
                  {insight.trend === 'down' && <span className="text-rose-600 text-xs font-semibold">▼ Down</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{insight.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(paginationPosition === 'top' || paginationPosition === 'both') && renderPaginationControls()}

      {/* Table container supporting responsive wrapping, scroll event handling, and fixedHeader height config */}
      {viewMode === 'calendar' ? (
        <div className="w-full relative bg-white z-0 p-4" style={{ height: fixedHeader ? fixedHeaderScrollHeight : '600px', minHeight: '420px' }}>
          {progressPending && paginatedData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 z-10" style={customStyles?.progress?.style}>
              {progressComponent !== undefined ? progressComponent : <DefaultSpinner />}
            </div>
          ) : (
            <SafeFeatureBoundary>
              <NativeCalendarView
                theme={themeObj.colorScheme === 'dark' ? 'dark' : 'light'}
                onSelectEvent={(row) => {
                  if (config?.sidePreview) setPreviewRow(row);
                }}
                events={paginatedData.map((row, idx) => {
                  const dateFieldVal = calendarConfig?.dateField ? row[calendarConfig.dateField] : (row['date'] || row['createdAt']);
                  const endDateFieldVal = calendarConfig?.endDateField ? row[calendarConfig.endDateField] : undefined;
                  const titleVal = calendarConfig?.titleField ? row[calendarConfig.titleField] : (row['title'] || row['name'] || `Event ${idx + 1}`);
                  
                  let start = new Date();
                  if (dateFieldVal) {
                    const parsed = new Date(dateFieldVal);
                    if (!isNaN(parsed.getTime())) start = parsed;
                  }
                  
                  let end = start;
                  if (endDateFieldVal) {
                    const parsedEnd = new Date(endDateFieldVal);
                    if (!isNaN(parsedEnd.getTime())) end = parsedEnd;
                  }
                  
                  return {
                    id: row[keyField] ?? idx,
                    title: String(titleVal),
                    start,
                    end,
                    resource: row
                  };
                })}
              />
            </SafeFeatureBoundary>
          )}
          {progressPending && paginatedData.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[0.5px] z-[1000] transition-all" style={customStyles?.progress?.style}>
              {progressComponent !== undefined ? progressComponent : <DefaultSpinner />}
            </div>
          )}
        </div>
      ) : viewMode === 'map' ? (
        <div className="w-full relative bg-slate-100 z-0" style={{ height: fixedHeader ? fixedHeaderScrollHeight : '420px', minHeight: '320px' }}>
          {progressPending && paginatedData.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 z-10" style={customStyles?.progress?.style}>
              {progressComponent !== undefined ? progressComponent : <DefaultSpinner />}
            </div>
          ) : (
            <SafeFeatureBoundary>
              <NativeMapView
                theme={themeObj.colorScheme === 'dark' ? 'dark' : 'light'}
                onSelectMarker={(row: any) => {
                  if (config?.sidePreview) setPreviewRow(row as T);
                }}
                markers={paginatedData
                  .map((row, idx) => {
                    const latStr = mapConfig?.latField ? row[mapConfig.latField] : row['lat'];
                    const lngStr = mapConfig?.lngField ? row[mapConfig.lngField] : row['lng'];
                    const titleVal = mapConfig?.titleField ? row[mapConfig.titleField] : (row['title'] || row['name'] || `Item ${idx + 1}`);
                    const lat = Number(latStr);
                    const lng = Number(lngStr);
                    if (latStr !== undefined && lngStr !== undefined && !isNaN(lat) && !isNaN(lng)) {
                      return {
                        id: row[keyField] ?? idx,
                        lat,
                        lng,
                        title: String(titleVal),
                        row,
                      };
                    }
                    return null;
                  })
                  .filter(Boolean) as any}
              />
            </SafeFeatureBoundary>
          )}
          {progressPending && paginatedData.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[0.5px] z-[1000] transition-all" style={customStyles?.progress?.style}>
              {progressComponent !== undefined ? progressComponent : <DefaultSpinner />}
            </div>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="w-full bg-slate-50/50 p-4 border-t border-slate-100 min-h-[400px] overflow-x-auto" style={{ ...(fixedHeader ? { maxHeight: fixedHeaderScrollHeight, overflowY: 'auto' } : {}) }}>
          {progressPending && paginatedData.length === 0 ? (
            <div className="flex items-center justify-center p-6 min-h-[300px]">
              {progressComponent !== undefined ? progressComponent : <DefaultSpinner />}
            </div>
          ) : (() => {
            const groupField = kanbanConfig?.columnField || 'status';
            
            // Get unique column values from config, or from data status values
            let columnValues = kanbanConfig?.columns;
            if (!columnValues) {
              const valuesSet = new Set<string>();
              paginatedData.forEach(row => {
                const val = row[groupField];
                if (val !== undefined && val !== null) {
                  valuesSet.add(String(val));
                }
              });
              columnValues = Array.from(valuesSet);
              if (columnValues.length === 0) {
                columnValues = ['To Do', 'In Progress', 'Completed'];
              }
            }

            // Group data by column value
            const groupedData: Record<string, T[]> = {};
            columnValues.forEach(colVal => {
              groupedData[colVal] = paginatedData.filter(row => String(row[groupField] || '') === colVal);
            });

            return (
              <div className="flex gap-4 items-start min-w-[800px] h-full pb-2">
                {columnValues.map(colVal => (
                  <div 
                    key={colVal} 
                    className="flex-1 min-w-[250px] bg-slate-100/70 border border-slate-200/50 rounded-xl p-3 flex flex-col max-h-[600px]"
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="font-bold text-slate-700 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                        {colVal}
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                          {groupedData[colVal]?.length || 0}
                        </span>
                      </span>
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-0.5 flex-1 min-h-[200px]">
                      {groupedData[colVal]?.length === 0 ? (
                        <div className="text-center py-8 text-xs italic text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white/50">
                          No items in this column
                        </div>
                      ) : (
                        groupedData[colVal]?.map((row, rIdx) => {
                          const rowKey = row[keyField] !== undefined ? row[keyField] : rIdx;
                          const title = kanbanConfig?.titleField ? row[kanbanConfig.titleField] : (row['title'] || row['name'] || `Item ${rowKey}`);
                          const description = kanbanConfig?.descriptionField ? row[kanbanConfig.descriptionField] : (row['description'] || row['category'] || '');

                          return (
                            <div 
                              key={rowKey}
                              onClick={(e) => {
                                if (onRowClicked) onRowClicked(row, e as any);
                                if (config?.sidePreview && renderSidePreview) {
                                  setPreviewRow(row);
                                }
                              }}
                              className="bg-white border border-slate-200/60 p-4 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-indigo-200 flex flex-col gap-2.5 relative"
                            >
                              <div className="flex justify-between items-start gap-1.5">
                                <h5 className="font-semibold text-slate-800 text-sm leading-tight group-hover:text-indigo-600 transition-colors">
                                  {title}
                                </h5>
                                {config?.bookmarks && (() => {
                                  const rowKeyField = row[keyField] !== undefined ? row[keyField] : (row.id !== undefined ? row.id : rIdx);
                                  const isBookmarked = bookmarkedKeys.has(rowKeyField);
                                  return (
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleBookmark(rowKeyField);
                                      }}
                                      className={`p-0.5 rounded hover:bg-slate-100 transition-colors ${isBookmarked ? 'text-amber-500' : 'text-slate-300'}`}
                                    >
                                      <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400' : ''}`} />
                                    </button>
                                  );
                                })()}
                              </div>

                              {description && (
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                  {description}
                                </p>
                              )}

                              {/* Card Metadata / Values */}
                              <div className="flex flex-wrap gap-1.5 mt-1 border-t pt-2 border-slate-100">
                                {columns?.slice(0, 4).map(col => {
                                  if (col.id === kanbanConfig?.titleField || col.id === kanbanConfig?.descriptionField || col.id === groupField) return null;
                                  const cellVal = col.selector ? col.selector(row, rIdx) : row[col.id];
                                  if (cellVal === undefined || cellVal === null || cellVal === '') return null;
                                  return (
                                    <div key={String(col.id)} className="text-[10px] bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded font-medium truncate max-w-[120px]" title={`${col.name}: ${cellVal}`}>
                                      <span className="font-semibold text-slate-400">{col.name}:</span> {String(cellVal)}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Move Status Dropdown Option */}
                              <div className="flex justify-end border-t pt-2 border-slate-100/60 mt-1">
                                <select
                                  value={String(row[groupField] || '')}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const col = columns?.find(c => String(c.id) === groupField);
                                    if (col && onCellEdit) {
                                      onCellEdit(row, e.target.value, col);
                                    } else {
                                      if (onCellEdit) {
                                        onCellEdit(row, e.target.value, { id: groupField, name: groupField } as any);
                                      }
                                    }
                                  }}
                                  className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-semibold text-slate-600 hover:bg-slate-100 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                  {columnValues?.map(opt => (
                                    <option key={opt} value={opt}>Move to {opt}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ) : viewMode === 'gallery' ? (
        <div className="w-full bg-slate-50/50 p-4 border-t border-slate-100 min-h-[400px]" style={{ ...(fixedHeader ? { maxHeight: fixedHeaderScrollHeight, overflowY: 'auto' } : {}) }}>
          {progressPending && paginatedData.length === 0 ? (
            <div className="flex items-center justify-center p-6 min-h-[300px]">
              {progressComponent !== undefined ? progressComponent : <DefaultSpinner />}
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {paginatedData.length === 0 ? (
                <div className="w-full text-center py-16 text-sm text-slate-400">
                  {noDataComponent !== undefined ? noDataComponent : 'No items found'}
                </div>
              ) : (
                paginatedData.map((row, rIdx) => {
                  const rowKey = row[keyField] !== undefined ? row[keyField] : rIdx;
                  const title = galleryConfig?.titleField ? row[galleryConfig.titleField] : (row['title'] || row['name'] || `Item ${rowKey}`);
                  const description = galleryConfig?.descriptionField ? row[galleryConfig.descriptionField] : (row['description'] || row['category'] || '');
                  const imageUrl = galleryConfig?.imageField ? row[galleryConfig.imageField] : (row['image'] || row['imageUrl'] || row['avatar'] || row['photo'] || '');

                  const gradientIdx = (Number(rowKey) || rIdx) % 5;
                  const gradients = [
                    'from-indigo-400 to-purple-500',
                    'from-sky-400 to-blue-500',
                    'from-emerald-400 to-teal-500',
                    'from-amber-400 to-orange-500',
                    'from-rose-400 to-pink-500'
                  ];

                  return (
                    <div 
                      key={rowKey}
                      onClick={(e) => {
                        if (onRowClicked) onRowClicked(row, e as any);
                        if (config?.sidePreview && renderSidePreview) {
                          setPreviewRow(row);
                        }
                      }}
                      className="bg-white border border-slate-200/70 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex flex-col group h-full w-full sm:w-[calc(50%-8px)] md:w-[calc(33.333%-11px)] lg:w-[calc(25%-12px)] flex-shrink-0"
                    >
                      <div className="relative w-full h-32 flex-shrink-0 bg-slate-100 overflow-hidden">
                        {imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${gradients[gradientIdx]} opacity-80 flex items-center justify-center relative`}>
                            <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
                            <span className="font-bold text-white text-3xl font-sans tracking-wide drop-shadow-sm select-none uppercase">
                              {String(title).substring(0, 2)}
                            </span>
                          </div>
                        )}
                        {config?.bookmarks && (() => {
                          const rowKeyField = row[keyField] !== undefined ? row[keyField] : (row.id !== undefined ? row.id : rIdx);
                          const isBookmarked = bookmarkedKeys.has(rowKeyField);
                          return (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(rowKeyField);
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 shadow backdrop-blur-sm hover:bg-white text-amber-500 hover:scale-110 transition-all"
                            >
                              <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400' : 'text-slate-300'}`} />
                            </button>
                          );
                        })()}
                      </div>

                      <div className="p-4 flex-grow flex flex-col gap-2">
                        <h5 className="font-semibold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">
                          {title}
                        </h5>
                        {description && (
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed flex-grow">
                            {description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-slate-100">
                          {columns?.slice(0, 4).map(col => {
                            if (col.id === galleryConfig?.titleField || col.id === galleryConfig?.descriptionField) return null;
                            const cellVal = col.selector ? col.selector(row, rIdx) : row[col.id];
                            if (cellVal === undefined || cellVal === null || cellVal === '') return null;
                            return (
                              <div key={String(col.id)} className="text-[10px] bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded font-medium max-w-full truncate" title={`${col.name}: ${cellVal}`}>
                                <span className="font-semibold text-slate-400">{col.name}:</span> {String(cellVal)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex flex-row relative w-full items-stretch min-h-[290px] overflow-hidden border-t border-slate-100 outline-none"
          tabIndex={isKeyboardNavActive ? 0 : undefined}
          onKeyDown={(e) => {
            if (!isKeyboardNavActive || editingCell || paginatedData.length === 0 || visibleCols.length === 0) return;
            const currentRow = focusedCell?.rowIndex ?? 0;
            const currentCol = focusedCell?.colIndex ?? 0;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setFocusedCell({ rowIndex: Math.min(paginatedData.length - 1, currentRow + 1), colIndex: currentCol });
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setFocusedCell({ rowIndex: Math.max(0, currentRow - 1), colIndex: currentCol });
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              setFocusedCell({ rowIndex: currentRow, colIndex: Math.min(visibleCols.length - 1, currentCol + 1) });
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setFocusedCell({ rowIndex: currentRow, colIndex: Math.max(0, currentCol - 1) });
            } else if (e.key === ' ' && isSelectableRows && focusedCell) {
              e.preventDefault();
              const row = paginatedData[focusedCell.rowIndex];
              if (row) {
                const rKey = getRowKey(row, focusedCell.rowIndex);
                toggleSelect(rKey, row, focusedCell.rowIndex);
              }
            } else if (e.key === 'Enter' && focusedCell) {
              const row = paginatedData[focusedCell.rowIndex];
              const col = visibleCols[focusedCell.colIndex];
              if (row && col) {
                if (col.editable || col.editor) {
                  e.preventDefault();
                  const colId = String(col.id || col.name).toLowerCase();
                  setEditingCell({
                    rowIndex: focusedCell.rowIndex,
                    colId,
                    value: String(col.selector ? col.selector(row, focusedCell.rowIndex) : ''),
                    error: null,
                  });
                } else if (config?.sidePreview) {
                  e.preventDefault();
                  setPreviewRow(row);
                }
              }
            } else if (e.key === 'Escape') {
              setFocusedCell(null);
            }
          }}
        >
          <div 
            ref={tableScrollContainerRef}
            className={`flex-1 ${responsive ? 'overflow-x-auto' : 'overflow-hidden'} relative min-w-0`}
            onScroll={(e) => {
              if (virtualize) {
                setVirtualScrollTop(e.currentTarget.scrollTop);
              }
              if (onScroll) {
                onScroll(e);
              }
            }}
            style={{
              ...((fixedHeader || virtualize)
                ? {
                    maxHeight: fixedHeader ? fixedHeaderScrollHeight : (fixedHeaderScrollHeight !== '100vh' ? fixedHeaderScrollHeight : '520px'),
                    overflowY: 'auto',
                  }
                : {}),
              ...(responsive ? customStyles?.responsiveWrapper?.style : {})
            }}
          >
        {isMobileCardView ? (
          <div className="p-3 space-y-3" role="list" aria-label={typeof title === 'string' ? title : 'Data cards'}>
            {progressPending && paginatedData.length === 0 ? (
              progressComponent !== undefined ? (
                <div style={customStyles?.progress?.style}>{progressComponent}</div>
              ) : (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`card-skeleton-${idx}`}
                    className="rounded-xl border p-3.5 animate-pulse space-y-2.5"
                    style={{ backgroundColor: themeObj.background.default, borderColor: themeObj.divider.default }}
                  >
                    <div className="h-4 w-1/2 bg-slate-200/70 rounded" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-3 bg-slate-200/50 rounded" />
                      <div className="h-3 bg-slate-200/50 rounded" />
                      <div className="h-3 bg-slate-200/50 rounded" />
                      <div className="h-3 bg-slate-200/50 rounded" />
                    </div>
                  </div>
                ))
              )
            ) : paginatedData.length === 0 ? (
              noDataComponent !== undefined ? (
                noDataComponent
              ) : (data && data.length > 0) ? (
                <div className="flex flex-col items-center justify-center py-10 px-4">
                  <div className="text-slate-300 mb-2">
                    <Filter className="w-9 h-9 stroke-1" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">No matching records</h4>
                  <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
                    No rows match your current search or active filters.
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="mt-3 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    Clear Active Filters
                  </button>
                </div>
              ) : (
                <DefaultNoDataComponent />
              )
            ) : (() => {
              let lastGroupValue: string | null = null;
              const groupCol = activeGroupBy
                ? finalColumns.find(c => String(c.id || c.name).toLowerCase() === activeGroupBy.toLowerCase())
                : null;
              const orderedRowsForCards = activeGroupBy
                ? [...paginatedData].sort((a, b) => {
                    const va = String(groupCol?.selector ? groupCol.selector(a) : a[activeGroupBy] ?? '');
                    const vb = String(groupCol?.selector ? groupCol.selector(b) : b[activeGroupBy] ?? '');
                    return va.localeCompare(vb);
                  })
                : paginatedData;

              const primaryCol =
                visibleCols.find(c => ['title', 'name', 'account'].includes(String(c.id || c.name).toLowerCase())) ||
                visibleCols[0];

              return (
                <>
                  {orderedRowsForCards.map((row, rowIndex) => {
                    const currentGroupVal = activeGroupBy
                      ? String((groupCol?.selector ? groupCol.selector(row, rowIndex) : row[activeGroupBy]) ?? 'Uncategorized')
                      : null;
                    const isNewGroup = activeGroupBy && currentGroupVal !== lastGroupValue;
                    if (activeGroupBy) {
                      lastGroupValue = currentGroupVal;
                    }
                    const isGroupCollapsed = currentGroupVal ? collapsedGroups.has(currentGroupVal) : false;
                    const groupRowsCount = isNewGroup
                      ? orderedRowsForCards.filter(
                          r => String((groupCol?.selector ? groupCol.selector(r) : r[activeGroupBy]) ?? 'Uncategorized') === currentGroupVal
                        ).length
                      : 0;

                    const groupBanner = isNewGroup && currentGroupVal !== null ? (
                      <button
                        type="button"
                        key={`card-group-${currentGroupVal}-${rowIndex}`}
                        onClick={() => {
                          setCollapsedGroups(prev => {
                            const next = new Set(prev);
                            if (next.has(currentGroupVal)) next.delete(currentGroupVal);
                            else next.add(currentGroupVal);
                            return next;
                          });
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-between gap-2 transition-colors"
                        style={{
                          backgroundColor: themeObj.colorScheme === 'dark' ? '#1e293b' : '#f1f5f9',
                          borderColor: themeObj.divider.default,
                          color: themeObj.text.primary,
                        }}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <ChevronDown className={`w-4 h-4 text-indigo-600 transition-transform ${isGroupCollapsed ? '-rotate-90' : ''}`} />
                          <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{currentGroupVal}</span>
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-indigo-100 text-indigo-700 shrink-0">
                          {groupRowsCount}
                        </span>
                      </button>
                    ) : null;

                    if (isGroupCollapsed) {
                      return groupBanner;
                    }

                    const rowKey = getRowKey(row, rowIndex);
                    const isRowSelected = selected.includes(rowKey);
                    const isRowDisabled = selectableRowDisabled ? selectableRowDisabled(row) : false;
                    const highlightSelected = selectableRowsHighlight === true;
                    const cond = getConditionalStyles(row);
                    const isExpanded = expandedKeys.includes(rowKey);
                    const isExpDisabled = expandableRowDisabled ? expandableRowDisabled(row) : false;
                    const commentsCount = (rowCommentsData[String(rowKey)] || []).length;

                    const primaryColId = primaryCol ? String(primaryCol.id || primaryCol.name).toLowerCase() : '';
                    const primaryVal = primaryCol
                      ? primaryCol.cell
                        ? primaryCol.cell(row, rowIndex, primaryCol, primaryColId)
                        : primaryCol.format
                        ? primaryCol.format(row, rowIndex)
                        : primaryCol.selector(row, rowIndex)
                      : `Row ${rowIndex + 1}`;

                    const detailCols = visibleCols.filter(c => c !== primaryCol);

                    return (
                      <React.Fragment key={`card-wrap-${rowKey}`}>
                        {groupBanner}
                        <div
                          role="listitem"
                          onTouchStart={(e) => handleTouchStart(e, rowKey)}
                          onTouchMove={(e) => handleTouchMove(e, rowKey)}
                          onTouchEnd={(e) => handleTouchEnd(e, rowKey)}
                          onClick={(e) => {
                            if (disabled) return;
                            if (onRowClicked) onRowClicked(row, e as any);
                            if (config?.sidePreview) setPreviewRow(row);
                            if (expandOnRowClicked && !isExpDisabled) toggleExpandRow(rowKey, row);
                            if (!isRowDisabled && isSelectableRows) toggleSelect(rowKey, row, rowIndex, e as any);
                          }}
                          style={{
                            backgroundColor: isRowSelected && isSelectableRows && highlightSelected
                              ? themeObj.selected.default
                              : themeObj.background.default,
                            color: isRowSelected && isSelectableRows && highlightSelected
                              ? themeObj.selected.text
                              : themeObj.text.primary,
                            borderColor: isRowSelected ? themeObj.context.text : themeObj.divider.default,
                            opacity: isRowDisabled ? 0.6 : 1,
                            transform: swipedRowKey === rowKey ? `translateX(${swipeOffset}px)` : undefined,
                            transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                            ...cond.style,
                          }}
                          className={`rounded-xl border p-3.5 shadow-2xs transition-colors space-y-3 ${cond.className}`}
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 pb-2 border-b" style={{ borderColor: themeObj.divider.default }}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isSelectableRows && (
                                <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center">
                                  {renderCheckbox({
                                    checked: isRowSelected,
                                    onChange: (e: any) => {
                                      if (!disabled && !isRowDisabled) toggleSelect(rowKey, row, rowIndex, e);
                                    },
                                    disabled: disabled || isRowDisabled,
                                  })}
                                </div>
                              )}
                              {isRowNumbersVisible && (
                                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-slate-100 text-slate-500 shrink-0 tabular-nums">
                                  #{isPagination && !paginationServer ? (currentPage - 1) * rowsPerPage + rowIndex + 1 : rowIndex + 1}
                                </span>
                              )}
                              <div className="font-semibold text-sm truncate min-w-0">
                                {highlightCellContent(primaryVal)}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {config?.bookmarks && (
                                <button
                                  type="button"
                                  onClick={() => toggleBookmark(rowKey)}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    bookmarkedKeys.has(rowKey) ? 'text-amber-500' : 'text-slate-300 hover:text-slate-500'
                                  }`}
                                  aria-label="Toggle bookmark"
                                >
                                  <Star className={`w-4 h-4 ${bookmarkedKeys.has(rowKey) ? 'fill-amber-400' : ''}`} />
                                </button>
                              )}
                              {config?.rowComments && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCommentRowKey(rowKey);
                                    setNewCommentText('');
                                    setShowCommentsDrawer(true);
                                  }}
                                  className={`p-1.5 rounded-md relative transition-colors ${
                                    commentsCount > 0 ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                                  }`}
                                  aria-label="Row comments"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  {commentsCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                      {commentsCount}
                                    </span>
                                  )}
                                </button>
                              )}
                              {isExpanderVisible && (
                                <button
                                  type="button"
                                  disabled={disabled || isExpDisabled}
                                  onClick={() => !disabled && !isExpDisabled && toggleExpandRow(rowKey, row)}
                                  className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                                  aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                                >
                                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card Fields Grid */}
                          {detailCols.length > 0 && (
                            <div className="grid grid-cols-1 min-[320px]:grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                              {detailCols.map((col) => {
                                const cId = String(col.id || col.name).toLowerCase();
                                let cVal: React.ReactNode;
                                if (col.sparkline) {
                                  const rawSpark = col.selector(row, rowIndex);
                                  cVal = <Sparkline data={Array.isArray(rawSpark) ? rawSpark : []} config={col.sparklineConfig} label={`${cId}-${rowIndex}`} />;
                                } else if (col.cell) {
                                  cVal = col.cell(row, rowIndex, col, cId);
                                } else if (col.format) {
                                  cVal = col.format(row, rowIndex);
                                } else {
                                  cVal = col.selector(row, rowIndex);
                                }

                                const cHeatmap = col.heatmap
                                  ? getHeatmapStyles(
                                      getNumericValue(col.selector(row, rowIndex)),
                                      heatmapRanges[cId]?.min ?? 0,
                                      heatmapRanges[cId]?.max ?? 100,
                                      col.heatmapConfig
                                    )
                                  : undefined;

                                const isCardEditing = editingCell?.rowIndex === rowIndex && editingCell?.colId === cId;
                                const isCardEditable = col.editable || col.editor !== undefined;
                                const cardCopyKey = `card::${String(rowKey)}::${cId}`;
                                const isCardCopied = copiedCellKey === cardCopyKey;

                                return (
                                  <div
                                    key={cId}
                                    className="flex flex-col gap-0.5 min-w-0"
                                    onClick={(e) => {
                                      if (col.button || col.ignoreRowClick) {
                                        e.stopPropagation();
                                      } else if (isCardEditable && !isCardEditing) {
                                        e.stopPropagation();
                                        setEditingCell({
                                          rowIndex,
                                          colId: cId,
                                          value: String(col.selector ? col.selector(row, rowIndex) : ''),
                                          error: null,
                                        });
                                      }
                                    }}
                                  >
                                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 truncate">
                                      {col.name}
                                    </span>
                                    {isCardEditing ? (
                                      <input
                                        autoFocus
                                        type={col.editor?.type === 'number' ? 'number' : col.editor?.type === 'date' ? 'date' : 'text'}
                                        value={editingCell.value}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value, error: null })}
                                        onBlur={() => {
                                          if (onCellEdit) onCellEdit(row, editingCell.value, col);
                                          setEditingCell(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            if (onCellEdit) onCellEdit(row, editingCell.value, col);
                                            setEditingCell(null);
                                          } else if (e.key === 'Escape') {
                                            setEditingCell(null);
                                          }
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-indigo-400 rounded bg-white text-slate-900 outline-none"
                                      />
                                    ) : (
                                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                                        <div
                                          className={`font-medium min-w-0 break-words ${cHeatmap ? 'px-1.5 py-0.5 rounded' : ''}`}
                                          style={cHeatmap}
                                        >
                                          {highlightCellContent(cVal)}
                                        </div>
                                        {col.copyable && (
                                          <button
                                            type="button"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const raw = col.selector ? col.selector(row, rowIndex) : (row as any)[col.id];
                                              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                                                try {
                                                  await navigator.clipboard.writeText(raw === null || raw === undefined ? '' : String(raw));
                                                  setCopiedCellKey(cardCopyKey);
                                                  setTimeout(() => setCopiedCellKey(prev => (prev === cardCopyKey ? null : prev)), 1400);
                                                } catch {}
                                              }
                                            }}
                                            className="p-1 rounded text-slate-400 hover:text-indigo-600 shrink-0"
                                            aria-label={`Copy ${String(col.name)}`}
                                          >
                                            {isCardCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Expanded Row Component Inside Card */}
                          {expandableRows && isExpanded && expandableRowsComponent && (
                            <div className="pt-3 border-t" style={{ borderColor: themeObj.divider.default }} onClick={(e) => e.stopPropagation()}>
                              <SafeFeatureBoundary>
                                {React.createElement(expandableRowsComponent, {
                                  data: row,
                                  ...expandableRowsComponentProps,
                                })}
                              </SafeFeatureBoundary>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {/* Compact Footer Aggregations Strip for Mobile Cards */}
                  {shouldShowFooter && !footerComponent && (
                    <div
                      className="rounded-xl border p-3 flex flex-wrap gap-3 text-xs tabular-nums"
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                        borderColor: themeObj.divider.default,
                        color: themeObj.text.primary,
                      }}
                    >
                      {visibleCols.map((col) => {
                        if (col.footer === undefined && col.aggregation === undefined) return null;
                        const colId = String(col.id || col.name).toLowerCase();
                        let val: React.ReactNode = '';
                        if (col.footer !== undefined) {
                          val = typeof col.footer === 'function' ? col.footer(sortedData) : col.footer;
                        } else if (typeof col.aggregation === 'function') {
                          val = col.aggregation(sortedData);
                        } else if (sortedData.length > 0) {
                          const rawVals = sortedData.map((r, i) => (col.selector ? col.selector(r, i) : (r as any)[colId])).filter(v => v !== undefined && v !== null && v !== '');
                          const nums = rawVals.map(v => getNumericValue(v)).filter(n => !isNaN(n));
                          const prefix = col.aggregationLabel ? `${col.aggregationLabel}: ` : '';
                          if (col.aggregation === 'count') val = `${prefix || 'Count: '}${rawVals.length}`;
                          else if (col.aggregation === 'unique') val = `${prefix || 'Unique: '}${new Set(rawVals.map(String)).size}`;
                          else if (col.aggregation === 'sum') val = `${prefix || 'Sum: '}${nums.reduce((a, b) => a + b, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                          else if (col.aggregation === 'avg') val = `${prefix || 'Avg: '}${(nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                          else if (col.aggregation === 'min') val = `${prefix || 'Min: '}${(nums.length ? Math.min(...nums) : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                          else if (col.aggregation === 'max') val = `${prefix || 'Max: '}${(nums.length ? Math.max(...nums) : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                        }
                        if (!val) return null;
                        return (
                          <div key={`card-agg-${colId}`} className="flex items-center gap-1.5 font-semibold">
                            <span className="text-[10px] uppercase tracking-wider opacity-60">{col.name}:</span>
                            <span>{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
        <table className="w-full text-left border-collapse" style={customStyles?.table?.style}>
          {showHeaderRow && (() => {
            const getColGroup = (colId: string) => {
              if (!columnGroups) return null;
              return columnGroups.find(g => g.columnIds.map(String).includes(String(colId))) || null;
            };

            const firstRowItems: FirstRowItem[] = [];
            if (columnGroups) {
              let i = 0;
              while (i < visibleCols.length) {
                const col = visibleCols[i];
                const colId = String(col.id || col.name).toLowerCase();
                const group = getColGroup(colId);
                if (group) {
                  const groupColIds = [colId];
                  let j = i + 1;
                  while (j < visibleCols.length) {
                    const nextCol = visibleCols[j];
                    const nextColId = String(nextCol.id || nextCol.name).toLowerCase();
                    const nextGroup = getColGroup(nextColId);
                    if (nextGroup && (nextGroup === group || (nextGroup.id && nextGroup.id === group.id))) {
                      groupColIds.push(nextColId);
                      j++;
                    } else {
                      break;
                    }
                  }
                  firstRowItems.push({
                    type: 'group',
                    group,
                    colSpan: groupColIds.length,
                    colIds: groupColIds
                  });
                  i = j;
                } else {
                  firstRowItems.push({
                    type: 'column',
                    column: col,
                    rowSpan: 2
                  });
                  i++;
                }
              }
            }

            const renderHeaderCell = (col: TableColumn<T>, hasRowSpan = false) => {
              const colId = String(col.id || col.name).toLowerCase();
              const colIndex = visibleCols.findIndex(c => (String(c.id || c.name).toLowerCase()) === colId);
              const actualThIndex = colIndex + (isSelectableRows ? 1 : 0) + (isExpanderVisible ? 1 : 0);
              const widthStyle = getColStyle(colId);

              return (
                <th 
                  key={colId} 
                  rowSpan={hasRowSpan ? 2 : undefined}
                  style={{
                    backgroundColor: themeObj.background.default,
                    color: themeObj.text.secondary,
                    borderBottomWidth: '1px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: themeObj.divider.default,
                    position: fixedHeader ? 'sticky' : 'relative',
                    top: fixedHeader ? 0 : undefined,
                    zIndex: fixedHeader ? (activeFilterPopover === colId ? 30 : 10) : (activeFilterPopover === colId ? 30 : undefined),
                    boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                    ...customStyles?.headCells?.style,
                    ...(colId === draggedColId ? customStyles?.headCells?.draggingStyle : {}),
                    ...widthStyle
                  }}
                  className={`${cellPadding} ${!disabled && isSortable && col.sortable !== false ? 'cursor-pointer hover:bg-slate-100/5 select-none' : 'cursor-default'} ${col.right ? 'text-right' : col.center ? 'text-center' : 'text-left'} transition-all duration-200 relative`} 
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, [data-resize-handle]')) return;
                    if (!disabled && isSortable && col.sortable !== false) {
                      handleSort(col, e);
                    }
                  }}
                  draggable={!disabled && col.reorder !== false}
                  onDragStart={(e) => (!disabled && col.reorder !== false) ? handleDragStart(colId, e) : undefined}
                  onDragOver={(!disabled && col.reorder !== false) ? handleDragOver : undefined}
                  onDrop={(e) => (!disabled && col.reorder !== false) ? handleDrop(colId, e) : undefined}
                >
                  <div className={`flex items-center gap-1.5 ${col.right ? 'justify-end' : col.center ? 'justify-center' : 'justify-start'}`}>
                    <span className="font-semibold">{col.name}</span>
                    
                    {isSortable && col.sortable !== false && (() => {
                      const sortIndex = sortColumns.findIndex(c => c.id === colId);
                      const isSorted = sortIndex > -1;
                      if (!isSorted) return null;
                      
                      const activeDir = sortColumns[sortIndex].direction;
                      const iconToRender = sortIcon !== undefined ? sortIcon : (
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDir === 'asc' ? 'rotate-180' : ''}`} />
                      );
                      
                      return (
                        <div className="flex items-center gap-0.5">
                          {iconToRender}
                          {sortMulti && sortColumns.length > 1 && (
                            <span className="text-[8px] bg-indigo-100 text-indigo-700 font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center scale-90">
                              {sortIndex + 1}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {col.filterable && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFilterPopover(activeFilterPopover === colId ? null : colId);
                        }}
                        className={`p-1 rounded hover:bg-slate-100 transition-colors ml-auto ${activeFilters[colId] ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'}`}
                      >
                        <Search className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {activeFilterPopover === colId && col.filterable && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-full mt-1.5 right-1 w-56 max-w-[calc(100vw-2rem)] p-3 bg-white border border-slate-200 rounded-lg shadow-xl text-slate-800 font-normal cursor-default z-[100]"
                      style={{ 
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        lineHeight: '1.2'
                      }}
                    >
                      <div className="flex flex-col gap-2 text-left">
                        <span className="text-xs font-semibold text-slate-500">Filter {col.name}</span>
                        
                        <select
                          value={activeFilters[colId]?.operator || 'contains'}
                          onChange={(e) => {
                            const op = e.target.value as any;
                            const currentVal = activeFilters[colId]?.value ?? '';
                            const newFilter = { value: currentVal, operator: op };
                            
                            if (onFilterChange) {
                              onFilterChange(colId, newFilter);
                            } else {
                              setInternalFilters(prev => ({ ...prev, [colId]: newFilter }));
                            }
                          }}
                          className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {col.filterType !== 'number' && col.filterType !== 'date' && (
                            <>
                              <option value="contains">Contains</option>
                              <option value="equals">Equals</option>
                              <option value="startsWith">Starts With</option>
                              <option value="endsWith">Ends With</option>
                            </>
                          )}
                          {(col.filterType === 'number' || col.filterType === 'date') && (
                            <>
                              <option value="equals">Equals</option>
                              <option value="greaterThan">Greater Than</option>
                              <option value="lessThan">Less Than</option>
                            </>
                          )}
                          <option value="isEmpty">Is Empty</option>
                          <option value="isNotEmpty">Is Not Empty</option>
                        </select>

                        {activeFilters[colId]?.operator !== 'isEmpty' && activeFilters[colId]?.operator !== 'isNotEmpty' && (
                          <input
                            type={col.filterType === 'number' ? 'number' : col.filterType === 'date' ? 'date' : 'text'}
                            placeholder="Filter value..."
                            value={activeFilters[colId]?.value ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const op = activeFilters[colId]?.operator || (col.filterType === 'number' || col.filterType === 'date' ? 'equals' : 'contains');
                              const newFilter = { value: val, operator: op };
                              
                              if (onFilterChange) {
                                onFilterChange(colId, newFilter);
                              } else {
                                setInternalFilters(prev => ({ ...prev, [colId]: newFilter }));
                              }
                            }}
                            className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        )}

                        {(() => {
                          const facetCounts = new Map<string, number>();
                          finalData.forEach((r, rIdx) => {
                            const raw = col.selector ? col.selector(r, rIdx) : (r as any)[colId];
                            if (raw === null || raw === undefined || String(raw).trim() === '') return;
                            const s = String(raw).trim();
                            facetCounts.set(s, (facetCounts.get(s) || 0) + 1);
                          });
                          const topFacets = Array.from(facetCounts.entries())
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 6);
                          if (topFacets.length === 0) return null;
                          const currentValStr = String(activeFilters[colId]?.value ?? '');
                          return (
                            <div className="pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                Quick Values
                              </span>
                              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                {topFacets.map(([fVal, count]) => {
                                  const isSelectedFacet = currentValStr.toLowerCase() === fVal.toLowerCase();
                                  return (
                                    <button
                                      key={fVal}
                                      type="button"
                                      onClick={() => {
                                        const nextFilter: FilterState = {
                                          value: isSelectedFacet ? '' : fVal,
                                          operator: col.filterType === 'number' || col.filterType === 'date' ? 'equals' : 'contains',
                                        };
                                        if (onFilterChange) {
                                          onFilterChange(colId, nextFilter);
                                        } else {
                                          setInternalFilters(prev => {
                                            if (isSelectedFacet) {
                                              const next = { ...prev };
                                              delete next[colId];
                                              return next;
                                            }
                                            return { ...prev, [colId]: nextFilter };
                                          });
                                        }
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[140px] border transition-colors ${
                                        isSelectedFacet
                                          ? 'bg-indigo-600 text-white border-indigo-600'
                                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                      }`}
                                      title={`${fVal} (${count})`}
                                    >
                                      {fVal} <span className="opacity-70 font-mono">({count})</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex justify-end gap-1.5 mt-1 border-t pt-2 border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              if (onFilterChange) {
                                onFilterChange(colId, { value: '', operator: 'contains' });
                              } else {
                                setInternalFilters(prev => {
                                  const next = { ...prev };
                                  delete next[colId];
                                  return next;
                                });
                              }
                              setActiveFilterPopover(null);
                            }}
                            className="text-[10px] text-slate-500 hover:text-slate-800 px-2 py-1 rounded transition-colors font-medium"
                          >
                            {localization?.filter?.clear ?? columnFilterOptions?.clearText ?? "Clear"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveFilterPopover(null)}
                            className="text-[10px] bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 rounded shadow transition-colors font-medium"
                          >
                            {localization?.filter?.apply ?? columnFilterOptions?.applyText ?? "Done"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {resizable && (
                    <div 
                      data-resize-handle="true"
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-600 transition-colors z-20"
                      onMouseDown={(e) => handleResizeStart(colId, e)}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setColumnWidths(prev => {
                          const next = { ...prev };
                          delete next[colId];
                          return next;
                        });
                      }}
                      title="Drag to resize column · Double-click to reset width"
                    />
                  )}

                  {showHeaderSep && actualThIndex < totalColsCount - 1 && (
                    <div 
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                      style={{ 
                        height: headerSeparator === 'full' ? '100%' : '60%', 
                        backgroundColor: themeObj.divider.default 
                      }} 
                    />
                  )}
                </th>
              );
            };

            interface FirstRowItem {
              type: 'group' | 'column';
              group?: any;
              column?: any;
              colSpan?: number;
              rowSpan?: number;
              colIds?: string[];
            }

            return (
              <thead style={customStyles?.head?.style}>
                {columnGroups ? (
                  <>
                    <tr 
                      className="border-b text-sm font-semibold text-slate-600 bg-white"
                      style={{ borderBottomColor: themeObj.divider.default, ...customStyles?.headRow?.style, ...(actualDensity === 'compact' ? customStyles?.headRow?.denseStyle : {}) }}
                    >
                      {isRowNumbersVisible && (
                        <th
                          rowSpan={2}
                          style={{
                            backgroundColor: themeObj.background.default,
                            color: themeObj.text.secondary,
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: themeObj.divider.default,
                            position: fixedHeader ? 'sticky' : 'relative',
                            top: fixedHeader ? 0 : undefined,
                            zIndex: fixedHeader ? 10 : undefined,
                            boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                            ...customStyles?.headCells?.style
                          }}
                          className={`${cellPadding} w-12 text-center font-mono text-xs text-slate-400 select-none`}
                        >
                          #
                        </th>
                      )}
                      {isExpanderVisible && (
                        <th 
                          rowSpan={2}
                          style={{
                            backgroundColor: themeObj.background.default,
                            color: themeObj.text.secondary,
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: themeObj.divider.default,
                            position: fixedHeader ? 'sticky' : 'relative',
                            top: fixedHeader ? 0 : undefined,
                            zIndex: fixedHeader ? 10 : undefined,
                            boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                            ...customStyles?.headCells?.style
                          }}
                          className={`${cellPadding} w-12 text-center transition-all duration-200`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (disabled) return;
                              if (expandedKeys.length > 0) {
                                setExpandedKeys([]);
                              } else {
                                const allKeys = paginatedData
                                  .filter((r) => !expandableRowDisabled || !expandableRowDisabled(r))
                                  .map((r, i) => getRowKey(r, i));
                                setExpandedKeys(allKeys);
                              }
                            }}
                            title={expandedKeys.length > 0 ? 'Collapse all rows' : 'Expand all rows'}
                            aria-label={expandedKeys.length > 0 ? 'Collapse all rows' : 'Expand all rows'}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors mx-auto flex items-center justify-center"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedKeys.length > 0 ? 'rotate-180 text-indigo-600' : ''}`} />
                          </button>
                        </th>
                      )}
                      {isSelectableRows && (
                        <th 
                          rowSpan={2}
                          style={{
                            backgroundColor: themeObj.background.default,
                            color: themeObj.text.secondary,
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: themeObj.divider.default,
                            position: fixedHeader ? 'sticky' : 'relative',
                            top: fixedHeader ? 0 : undefined,
                            zIndex: fixedHeader ? 10 : undefined,
                            boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                            ...customStyles?.headCells?.style
                          }}
                          className={`${cellPadding} w-12 text-center transition-all duration-200`}
                        >
                          {!selectableRowsNoSelectAll && !selectableRowsSingle && renderCheckbox({
                            checked: isAllSelectedOnPage,
                            onChange: toggleSelectAll,
                            disabled: disabled || (progressPending && paginatedData.length === 0),
                            isHeader: true
                          })}
                        </th>
                      )}
                      {config?.bookmarks && (
                        <th 
                          rowSpan={2}
                          style={{
                            backgroundColor: themeObj.background.default,
                            color: themeObj.text.secondary,
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: themeObj.divider.default,
                            position: fixedHeader ? 'sticky' : 'relative',
                            top: fixedHeader ? 0 : undefined,
                            zIndex: fixedHeader ? 10 : undefined,
                            boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                            ...customStyles?.headCells?.style
                          }}
                          className={`${cellPadding} w-12 text-center transition-all duration-200`}
                        >
                          <button
                            type="button"
                            onClick={() => setShowOnlyBookmarked(!showOnlyBookmarked)}
                            className={`p-1.5 rounded-full transition-colors ${
                              showOnlyBookmarked ? 'bg-amber-50 text-amber-500' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                            }`}
                            title={showOnlyBookmarked ? "Show All Rows" : "Show Bookmarks Only"}
                          >
                            <Star className={`w-4 h-4 ${showOnlyBookmarked ? 'fill-amber-400' : ''}`} />
                          </button>
                        </th>
                      )}
                      {firstRowItems.map((item, idx) => {
                        if (item.type === 'column') {
                          return renderHeaderCell(item.column, true);
                        } else {
                          const groupId = item.group.id || (typeof item.group.name === 'string' ? item.group.name : `group-index-${idx}`);
                          const groupAlign = item.group.align || 'center';
                          const isReorder = !!item.group.reorder;

                          return (
                            <th
                              key={`group-header-${groupId}-${idx}`}
                              colSpan={item.colSpan}
                              draggable={isReorder}
                              onDragStart={(e) => isReorder ? handleGroupDragStart(groupId, e) : undefined}
                              onDragOver={isReorder ? handleDragOver : undefined}
                              onDrop={(e) => isReorder ? handleGroupDrop(groupId, e) : undefined}
                              style={{
                                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                                color: themeObj.text.primary,
                                borderBottomWidth: '1px',
                                borderBottomStyle: 'solid',
                                borderBottomColor: themeObj.divider.default,
                                textAlign: groupAlign,
                                position: fixedHeader ? 'sticky' : 'relative',
                                top: fixedHeader ? 0 : undefined,
                                zIndex: fixedHeader ? 10 : undefined,
                                boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                              }}
                              className={`${cellPadding} font-bold text-xs uppercase tracking-wider select-none border-r border-slate-100/50 ${
                                groupAlign === 'left' ? 'text-left' : groupAlign === 'right' ? 'text-right' : 'text-center'
                              } ${isReorder ? 'cursor-move' : 'cursor-default'}`}
                            >
                              <div className={`flex items-center gap-1.5 ${
                                groupAlign === 'left' ? 'justify-start' : groupAlign === 'right' ? 'justify-end' : 'justify-center'
                              }`}>
                                {isReorder && <GripVertical className="w-3.5 h-3.5 text-slate-400 cursor-move flex-shrink-0" />}
                                <span className="truncate">{item.group.name}</span>
                              </div>
                            </th>
                          );
                        }
                      })}
                      {config?.rowComments && (
                        <th
                          rowSpan={2}
                          style={{
                            backgroundColor: themeObj.background.default,
                            color: themeObj.text.secondary,
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: themeObj.divider.default,
                            position: fixedHeader ? 'sticky' : 'relative',
                            top: fixedHeader ? 0 : undefined,
                            zIndex: fixedHeader ? 10 : undefined,
                            boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                            textAlign: 'center',
                            ...customStyles?.headCells?.style
                          }}
                          className={`${cellPadding} w-24 font-bold text-xs uppercase tracking-wider select-none text-center transition-all duration-200`}
                        >
                          Comments
                        </th>
                      )}
                    </tr>
                    <tr 
                      className="border-b text-sm font-semibold text-slate-600 bg-white"
                      style={{ borderBottomColor: themeObj.divider.default, ...customStyles?.headRow?.style, ...(actualDensity === 'compact' ? customStyles?.headRow?.denseStyle : {}) }}
                    >
                      {visibleCols.filter(col => {
                        const colId = String(col.id || col.name).toLowerCase();
                        return getColGroup(colId) !== null;
                      }).map(col => renderHeaderCell(col, false))}
                    </tr>
                  </>
                ) : (
                  <tr 
                    className="border-b text-sm font-semibold text-slate-600 bg-white"
                    style={{ borderBottomColor: themeObj.divider.default, ...customStyles?.headRow?.style, ...(actualDensity === 'compact' ? customStyles?.headRow?.denseStyle : {}) }}
                  >
                    {isRowNumbersVisible && (
                      <th
                        style={{
                          backgroundColor: themeObj.background.default,
                          color: themeObj.text.secondary,
                          borderBottomWidth: '1px',
                          borderBottomStyle: 'solid',
                          borderBottomColor: themeObj.divider.default,
                          position: fixedHeader ? 'sticky' : 'relative',
                          top: fixedHeader ? 0 : undefined,
                          zIndex: fixedHeader ? 10 : undefined,
                          boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                          ...customStyles?.headCells?.style
                        }}
                        className={`${cellPadding} w-12 text-center font-mono text-xs text-slate-400 select-none relative`}
                      >
                        #
                      </th>
                    )}
                    {isExpanderVisible && (
                      <th 
                        style={{
                          backgroundColor: themeObj.background.default,
                          color: themeObj.text.secondary,
                          borderBottomWidth: '1px',
                          borderBottomStyle: 'solid',
                          borderBottomColor: themeObj.divider.default,
                          position: fixedHeader ? 'sticky' : 'relative',
                          top: fixedHeader ? 0 : undefined,
                          zIndex: fixedHeader ? 10 : undefined,
                          boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                          ...customStyles?.headCells?.style
                        }}
                        className={`${cellPadding} w-12 text-center transition-all duration-200`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (disabled) return;
                            if (expandedKeys.length > 0) {
                              setExpandedKeys([]);
                            } else {
                              const allKeys = paginatedData
                                .filter((r) => !expandableRowDisabled || !expandableRowDisabled(r))
                                .map((r, i) => getRowKey(r, i));
                              setExpandedKeys(allKeys);
                            }
                          }}
                          title={expandedKeys.length > 0 ? 'Collapse all rows' : 'Expand all rows'}
                          aria-label={expandedKeys.length > 0 ? 'Collapse all rows' : 'Expand all rows'}
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors mx-auto flex items-center justify-center"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedKeys.length > 0 ? 'rotate-180 text-indigo-600' : ''}`} />
                        </button>
                        {showHeaderSep && 0 < totalColsCount - 1 && (
                          <div 
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                            style={{ 
                              height: headerSeparator === 'full' ? '100%' : '60%', 
                              backgroundColor: themeObj.divider.default 
                            }} 
                          />
                        )}
                      </th>
                    )}
                    {isSelectableRows && (() => {
                      const checkboxThIndex = isExpanderVisible ? 1 : 0;
                      return (
                        <th 
                          style={{
                            backgroundColor: themeObj.background.default,
                            color: themeObj.text.secondary,
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: themeObj.divider.default,
                            position: fixedHeader ? 'sticky' : 'relative',
                            top: fixedHeader ? 0 : undefined,
                            zIndex: fixedHeader ? 10 : undefined,
                            boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                            ...customStyles?.headCells?.style
                          }}
                          className={`${cellPadding} w-12 text-center transition-all duration-200`}
                        >
                          {!selectableRowsNoSelectAll && !selectableRowsSingle && renderCheckbox({
                            checked: isAllSelectedOnPage,
                            onChange: toggleSelectAll,
                            disabled: disabled || (progressPending && paginatedData.length === 0),
                            isHeader: true
                          })}
                          {showHeaderSep && checkboxThIndex < totalColsCount - 1 && (
                            <div 
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                              style={{ 
                                height: headerSeparator === 'full' ? '100%' : '60%', 
                                backgroundColor: themeObj.divider.default 
                              }} 
                            />
                          )}
                        </th>
                      );
                    })()}
                    {config?.bookmarks && (() => {
                      const bookmarkThIndex = (isExpanderVisible ? 1 : 0) + (isSelectableRows ? 1 : 0);
                      return (
                        <th 
                          style={{
                            backgroundColor: themeObj.background.default,
                            color: themeObj.text.secondary,
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: themeObj.divider.default,
                            position: fixedHeader ? 'sticky' : 'relative',
                            top: fixedHeader ? 0 : undefined,
                            zIndex: fixedHeader ? 10 : undefined,
                            boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                            ...customStyles?.headCells?.style
                          }}
                          className={`${cellPadding} w-12 text-center transition-all duration-200`}
                        >
                          <button
                            type="button"
                            onClick={() => setShowOnlyBookmarked(!showOnlyBookmarked)}
                            className={`p-1.5 rounded-full transition-colors ${
                              showOnlyBookmarked ? 'bg-amber-50 text-amber-500' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                            }`}
                            title={showOnlyBookmarked ? "Show All Rows" : "Show Bookmarks Only"}
                          >
                            <Star className={`w-4 h-4 ${showOnlyBookmarked ? 'fill-amber-400' : ''}`} />
                          </button>
                          {showHeaderSep && bookmarkThIndex < totalColsCount - 1 && (
                            <div 
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                              style={{ 
                                height: headerSeparator === 'full' ? '100%' : '60%', 
                                backgroundColor: themeObj.divider.default 
                              }} 
                            />
                          )}
                        </th>
                      );
                    })()}
                    {visibleCols.map((col) => renderHeaderCell(col, false))}
                    {config?.rowComments && (
                      <th
                        style={{
                          backgroundColor: themeObj.background.default,
                          color: themeObj.text.secondary,
                          borderBottomWidth: '1px',
                          borderBottomStyle: 'solid',
                          borderBottomColor: themeObj.divider.default,
                          position: fixedHeader ? 'sticky' : 'relative',
                          top: fixedHeader ? 0 : undefined,
                          zIndex: fixedHeader ? 10 : undefined,
                          boxShadow: fixedHeader ? `0 1px 0 0 ${themeObj.divider.default}` : undefined,
                          textAlign: 'center',
                          ...customStyles?.headCells?.style
                        }}
                        className={`${cellPadding} w-24 font-bold text-xs uppercase tracking-wider select-none text-center transition-all duration-200`}
                      >
                        Comments
                      </th>
                    )}
                  </tr>
                )}
              </thead>
            );
          })()}
          <tbody className={`text-sm relative ${progressPending && paginatedData.length > 0 ? 'opacity-40 pointer-events-none transition-opacity duration-200' : ''}`}>
            <AnimatePresenceWrapper enabled={!expandableRows && !virtualize}>
              {progressPending && paginatedData.length === 0 ? (
                progressComponent !== undefined ? (
                  <tr>
                    <td colSpan={totalColsCount} className="p-0" style={customStyles?.progress?.style}>
                      {progressComponent}
                    </td>
                  </tr>
                ) : (
                  // Shimmer skeleton loader for initial load
                  Array.from({ length: 5 }).map((_, rowIndex) => (
                    <tr key={`skeleton-${rowIndex}`} className="border-b animate-pulse" style={{ backgroundColor: themeObj.background.default, borderColor: themeObj.divider.default }}>
                      {isRowNumbersVisible && (
                        <td className={`${cellPadding} text-center`}>
                          <div className="w-4 h-3 bg-slate-200 rounded mx-auto"></div>
                        </td>
                      )}
                      {isExpanderVisible && (
                        <td className={`${cellPadding} text-center`}>
                          <div className="w-4 h-4 bg-slate-200 rounded mx-auto"></div>
                        </td>
                      )}
                      {isSelectableRows && (
                        <td className={`${cellPadding} text-center`}>
                          <div className="w-4 h-4 bg-slate-200 rounded mx-auto"></div>
                        </td>
                      )}
                      {config?.bookmarks && (
                        <td className={`${cellPadding} text-center`}>
                          <div className="w-4 h-4 bg-slate-200 rounded-full mx-auto"></div>
                        </td>
                      )}
                      {finalColumns.map((col) => {
                        const colId = String(col.id || col.name).toLowerCase();
                        if (visibleColumns[colId] === false || isColHiddenByBreakpoint(col)) return null;
                        const widthStyle = getColStyle(colId);
                        return (
                          <td key={`skeleton-cell-${colId}`} className={cellPadding} style={widthStyle}>
                            <div className="h-4 bg-slate-200/50 rounded w-5/6"></div>
                          </td>
                        );
                      })}
                      {config?.rowComments && (
                        <td className={`${cellPadding} text-center`}>
                          <div className="w-4 h-4 bg-slate-200 rounded-full mx-auto"></div>
                        </td>
                      )}
                    </tr>
                  ))
                )
              ) : paginatedData.length > 0 ? (() => {
                let lastGroupValue: string | null = null;
                const groupCol = activeGroupBy
                  ? finalColumns.find(c => String(c.id || c.name).toLowerCase() === activeGroupBy.toLowerCase())
                  : null;

                const orderedRowsForRender = activeGroupBy
                  ? [...paginatedData].sort((a, b) => {
                      const va = String(groupCol?.selector ? groupCol.selector(a) : a[activeGroupBy] ?? '');
                      const vb = String(groupCol?.selector ? groupCol.selector(b) : b[activeGroupBy] ?? '');
                      return va.localeCompare(vb);
                    })
                  : paginatedData;

                const rowHeightPx = Math.max(24, virtualRowHeight || 48);
                const isVirtualized = Boolean(
                  virtualize &&
                  !activeGroupBy &&
                  !expandableRows &&
                  orderedRowsForRender.length > virtualOverscan * 2 + 10
                );
                const virtualStart = isVirtualized
                  ? Math.max(0, Math.floor(virtualScrollTop / rowHeightPx) - virtualOverscan)
                  : 0;
                const virtualVisibleCount = isVirtualized
                  ? Math.ceil((virtualContainerHeight || 520) / rowHeightPx) + virtualOverscan * 2
                  : orderedRowsForRender.length;
                const virtualEnd = isVirtualized
                  ? Math.min(orderedRowsForRender.length, virtualStart + virtualVisibleCount)
                  : orderedRowsForRender.length;
                const topSpacerHeight = isVirtualized ? virtualStart * rowHeightPx : 0;
                const bottomSpacerHeight = isVirtualized
                  ? Math.max(0, (orderedRowsForRender.length - virtualEnd) * rowHeightPx)
                  : 0;

                const rowsToMap = isVirtualized
                  ? orderedRowsForRender.slice(virtualStart, virtualEnd)
                  : orderedRowsForRender;

                return (
                  <>
                    {topSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: topSpacerHeight }}>
                        <td colSpan={totalColsCount} style={{ padding: 0, border: 0, height: topSpacerHeight }} />
                      </tr>
                    )}
                    {rowsToMap.map((row, sliceIdx) => {
                  const rowIndex = virtualStart + sliceIdx;
                  const currentGroupVal = activeGroupBy
                    ? String((groupCol?.selector ? groupCol.selector(row, rowIndex) : row[activeGroupBy]) ?? 'Uncategorized')
                    : null;
                  const isNewGroup = activeGroupBy && currentGroupVal !== lastGroupValue;
                  if (activeGroupBy) {
                    lastGroupValue = currentGroupVal;
                  }
                  const isGroupCollapsed = currentGroupVal ? collapsedGroups.has(currentGroupVal) : false;

                  const groupRowsCount = isNewGroup
                    ? orderedRowsForRender.filter(
                        r => String((groupCol?.selector ? groupCol.selector(r) : r[activeGroupBy]) ?? 'Uncategorized') === currentGroupVal
                      ).length
                    : 0;

                  const groupHeaderRow = isNewGroup && currentGroupVal !== null ? (
                    <tr
                      key={`group-banner-${currentGroupVal}-${rowIndex}`}
                      onClick={() => {
                        setCollapsedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(currentGroupVal)) next.delete(currentGroupVal);
                          else next.add(currentGroupVal);
                          return next;
                        });
                      }}
                      className="cursor-pointer select-none border-b transition-colors hover:bg-indigo-50/40"
                      style={{
                        backgroundColor: themeObj.colorScheme === 'dark' ? '#1e293b' : '#f1f5f9',
                        borderColor: themeObj.divider.default,
                      }}
                    >
                      <td colSpan={totalColsCount} className="px-4 py-2 text-xs font-bold">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={`w-4 h-4 text-indigo-600 transition-transform ${
                                isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                              }`}
                            />
                            <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="uppercase tracking-wider text-slate-500 text-[10px]">
                              {groupCol?.name || activeGroupBy}:
                            </span>
                            <span style={{ color: themeObj.text.primary }}>{currentGroupVal}</span>
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-indigo-100 text-indigo-700">
                              {groupRowsCount} {groupRowsCount === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <span className="text-[10px] font-normal text-slate-400">
                            {isGroupCollapsed ? 'Click to expand group' : 'Click to collapse group'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null;

                  if (isGroupCollapsed) {
                    return groupHeaderRow;
                  }

                  const RowWrapper = shouldAnimate && !isVirtualized ? motion.tr : 'tr';
                  const animProps = shouldAnimate && !isVirtualized ? {
                    layout: true,
                    initial: { opacity: 0, y: 10 },
                    animate: { opacity: 1, y: 0 },
                    exit: { opacity: 0, scale: 0.95 },
                    transition: { 
                      duration: 0.2,
                      delay: animateRows ? Math.min(rowIndex * 0.03, 0.3) : 0
                    }
                  } : {};
                  
                  const rowKey = getRowKey(row, rowIndex);
                  const isRowSelected = selected.includes(rowKey);
                  const isStripedRow = striped && rowIndex % 2 === 1;
                  const isHovered = hoveredRowIndex === rowIndex;
                  const isRowDisabled = selectableRowDisabled ? selectableRowDisabled(row) : false;
                  const highlightSelected = selectableRowsHighlight === true;

                  // Evaluate conditional styles for this row
                  const cond = getConditionalStyles(row);

                  let computedRowStyle: React.CSSProperties = {
                    color: themeObj.text.primary,
                    borderBottomWidth: '1px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: themeObj.divider.default,
                    cursor: pointerOnHover ? 'pointer' : (isSelectableRows && !disabled && !isRowDisabled ? 'pointer' : (isRowDisabled ? 'not-allowed' : 'default')),
                    transition: 'background-color 150ms ease, color 150ms ease',
                    opacity: isRowDisabled ? 0.6 : 1,
                    ...customStyles?.rows?.style
                  };

                  if (isRowSelected && isSelectableRows && highlightSelected) {
                    computedRowStyle = {
                      ...computedRowStyle,
                      backgroundColor: themeObj.selected.default,
                      color: themeObj.selected.text,
                      ...customStyles?.rows?.selectedHighlightStyle
                    };
                  } else if (isHovered && highlightOnHover && !isRowDisabled) {
                    computedRowStyle = {
                      ...computedRowStyle,
                      backgroundColor: themeObj.highlightOnHover.default, color: themeObj.highlightOnHover.text,
                      ...customStyles?.rows?.highlightOnHoverStyle
                    };
                  } else if (isStripedRow) {
                    computedRowStyle = {
                      ...computedRowStyle,
                      backgroundColor: themeObj.striped.default,
                      color: themeObj.striped.text,
                      ...customStyles?.rows?.stripedStyle
                    };
                  } else {
                    computedRowStyle.backgroundColor = themeObj.background.default;
                  }

                  // Merge in any conditional row styles
                  computedRowStyle = {
                    ...computedRowStyle,
                    ...cond.style
                  };                  const isExpanded = expandedKeys.includes(rowKey);
                  const expandedRowStyle: React.CSSProperties = expandableInheritConditionalStyles 
                    ? { ...computedRowStyle, cursor: 'default' } 
                    : { backgroundColor: themeObj.background.default, color: themeObj.text.primary };

                  const rowSwipeStyle: React.CSSProperties = swipedRowKey === rowKey ? {
                    transform: `translateX(${swipeOffset}px)`,
                    transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    zIndex: 10,
                  } : {
                    transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  };

                  computedRowStyle = {
                    ...computedRowStyle,
                    ...rowSwipeStyle
                  };

                  const rowElement = (
                    <RowWrapper 
                      key={`row-${rowKey}`} 
                      {...(animProps as any)}
                      className={`border-b transition-colors ${cond.className}`}
                      style={computedRowStyle}
                      onTouchStart={(e) => handleTouchStart(e, rowKey)}
                      onTouchMove={(e) => handleTouchMove(e, rowKey)}
                      onTouchEnd={(e) => handleTouchEnd(e, rowKey)}
                      onClick={(e) => {
                        if (disabled) return;
                        if (swipedRowKey === rowKey && Math.abs(swipeOffset) > 10) {
                          setSwipedRowKey(null);
                          setSwipeOffset(0);
                          return;
                        }
                        if (onRowClicked) {
                          onRowClicked(row, e);
                        }
                        if (plugins) {
                          plugins.forEach(p => {
                            if (p.onRowClick) {
                              p.onRowClick(row, rowIndex);
                            }
                          });
                        }
                        if (config?.sidePreview) {
                          setPreviewRow(row);
                        }
                        if (expandOnRowClicked) {
                          const isExpDisabled = expandableRowDisabled ? expandableRowDisabled(row) : false;
                          if (!isExpDisabled) {
                            toggleExpandRow(rowKey, row);
                          }
                        }
                        if (!isRowDisabled && isSelectableRows) {
                          toggleSelect(rowKey, row, rowIndex, e);
                        }
                      }}
                      onDoubleClick={(e) => {
                        if (disabled) return;
                        if (onRowDoubleClicked) {
                          onRowDoubleClicked(row, e);
                        }
                        if (expandOnRowDoubleClicked) {
                          const isExpDisabled = expandableRowDisabled ? expandableRowDisabled(row) : false;
                          if (!isExpDisabled) {
                            toggleExpandRow(rowKey, row);
                          }
                        }
                      }}
                      onAuxClick={(e) => {
                        if (disabled) return;
                        if (e.button === 1 && onRowMiddleClicked) {
                          onRowMiddleClicked(row, e);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (!isContextMenuActive || disabled) return;
                        e.preventDefault();
                        setContextMenuState({
                          x: e.clientX,
                          y: e.clientY,
                          row,
                          rowIndex,
                        });
                      }}
                      onMouseEnter={(e) => {
                        setHoveredRowIndex(rowIndex);
                        if (onRowMouseEnter) {
                          onRowMouseEnter(row, e);
                        }
                      }}
                      onMouseLeave={(e) => {
                        setHoveredRowIndex(null);
                        if (onRowMouseLeave) {
                          onRowMouseLeave(row, e);
                        }
                      }}
                    >
                      {config?.swipeActions && swipedRowKey === rowKey && (
                        <td 
                          className="absolute inset-y-0 left-0 right-0 p-0 border-0 pointer-events-none"
                          style={{
                            height: '100%',
                            width: '100%',
                            zIndex: 0,
                          }}
                        >
                          {/* Left Swipe Actions */}
                          {mobileSwipeActions?.left && swipeOffset > 0 && (
                            <div 
                              className="absolute left-0 top-0 bottom-0 h-full flex items-stretch z-0 pointer-events-auto"
                              style={{
                                transform: `translateX(${-swipeOffset}px)`,
                                width: `${mobileSwipeActions.left.length * 70}px`,
                              }}
                            >
                              {mobileSwipeActions.left.map((action) => (
                                <button
                                  key={action.key}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick(row, rowIndex);
                                    setSwipedRowKey(null);
                                    setSwipeOffset(0);
                                  }}
                                  className={`h-full flex flex-col items-center justify-center text-center px-3 gap-1 text-white text-xs font-semibold ${action.className || 'bg-indigo-600'} transition-all active:brightness-90`}
                                  style={{ width: '70px' }}
                                >
                                  {action.icon}
                                  <span className="text-[10px] truncate max-w-full">{action.label}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Right Swipe Actions */}
                          {mobileSwipeActions?.right && swipeOffset < 0 && (
                            <div 
                              className="absolute right-0 top-0 bottom-0 h-full flex items-stretch z-0 pointer-events-auto"
                              style={{
                                transform: `translateX(${-swipeOffset}px)`,
                                width: `${mobileSwipeActions.right.length * 70}px`,
                              }}
                            >
                              {mobileSwipeActions.right.map((action) => (
                                <button
                                  key={action.key}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    action.onClick(row, rowIndex);
                                    setSwipedRowKey(null);
                                    setSwipeOffset(0);
                                  }}
                                  className={`h-full flex flex-col items-center justify-center text-center px-3 gap-1 text-white text-xs font-semibold ${action.className || 'bg-red-600'} transition-all active:brightness-90`}
                                  style={{ width: '70px' }}
                                >
                                  {action.icon}
                                  <span className="text-[10px] truncate max-w-full">{action.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      )}
                      {isRowNumbersVisible && (
                        <td
                          className={`${cellPadding} text-center font-mono text-xs tabular-nums select-none w-12 relative`}
                          style={{
                            color: themeObj.text.secondary,
                            borderBottomWidth: '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: themeObj.divider.default,
                          }}
                        >
                          {isPagination && !paginationServer ? (currentPage - 1) * rowsPerPage + rowIndex + 1 : rowIndex + 1}
                        </td>
                      )}
                      {isExpanderVisible && (() => {
                        const isRowExpanded = expandedKeys.includes(rowKey);
                        const isExpDisabled = expandableRowDisabled ? expandableRowDisabled(row) : false;
                        
                        let iconEl: React.ReactNode;
                        if (expandableIcon) {
                          iconEl = isRowExpanded ? expandableIcon.expanded : expandableIcon.collapsed;
                        } else {
                          iconEl = (
                            <ChevronDown 
                              className={`w-4 h-4 transition-transform duration-200 ${
                                isRowExpanded ? 'rotate-180 text-indigo-600' : 'text-slate-400'
                              } ${isExpDisabled ? 'opacity-30' : ''}`} 
                            />
                          );
                        }

                        const expandText = localization?.expandable?.expand ?? expandableRowsOptions?.expandText ?? "Expand";
                        const collapseText = localization?.expandable?.collapse ?? expandableRowsOptions?.collapseText ?? "Collapse";
                        const titleText = isRowExpanded ? collapseText : expandText;

                        return (
                          <td className={`${cellPadding} text-center transition-all duration-200 relative w-12`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!disabled && !isExpDisabled) {
                                  toggleExpandRow(rowKey, row);
                                }
                              }}
                              disabled={disabled || isExpDisabled}
                              style={customStyles?.expanderButton?.style}
                              className={`p-1 rounded-md hover:bg-slate-100 transition-colors flex items-center justify-center mx-auto ${
                                isExpDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                              }`}
                              title={titleText}
                              aria-label={titleText}
                            >
                              {iconEl}
                            </button>
                            {showColSep && 0 < totalColsCount - 1 && (
                              <div 
                                className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                                style={{ 
                                  height: columnSeparator === 'full' ? '100%' : '60%', 
                                  backgroundColor: themeObj.divider.default 
                                }} 
                              />
                            )}
                          </td>
                        );
                      })()}
                      {isSelectableRows && (
                        <td className={`${cellPadding} text-center transition-all duration-200 relative`}>
                          <div onClick={(e) => e.stopPropagation()}>
                            {renderCheckbox({
                              checked: isRowSelected,
                              onChange: (e: any) => {
                                if (!disabled && !isRowDisabled) {
                                  toggleSelect(rowKey, row, rowIndex, e);
                                }
                              },
                              disabled: disabled || isRowDisabled
                            })}
                          </div>
                          {showColSep && (isExpanderVisible ? 1 : 0) < totalColsCount - 1 && (
                            <div 
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                              style={{ 
                                height: columnSeparator === 'full' ? '100%' : '60%', 
                                backgroundColor: themeObj.divider.default 
                              }} 
                            />
                          )}
                        </td>
                      )}
                      {config?.bookmarks && (() => {
                        const bookmarkCellIndex = (isExpanderVisible ? 1 : 0) + (isSelectableRows ? 1 : 0);
                        return (
                          <td className={`${cellPadding} text-center transition-all duration-200 relative w-12`}>
                            <div onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleBookmark(rowKey)}
                                className={`p-1 rounded-full transition-colors ${
                                  bookmarkedKeys.has(rowKey) 
                                    ? 'text-amber-500 hover:text-amber-600' 
                                    : 'text-slate-300 hover:text-slate-500'
                                }`}
                                title={bookmarkedKeys.has(rowKey) ? "Remove from bookmarks" : "Add to bookmarks"}
                              >
                                <Star className={`w-4 h-4 ${bookmarkedKeys.has(rowKey) ? 'fill-amber-400' : ''}`} />
                              </button>
                            </div>
                            {showColSep && bookmarkCellIndex < totalColsCount - 1 && (
                              <div 
                                className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                                style={{ 
                                  height: columnSeparator === 'full' ? '100%' : '60%', 
                                  backgroundColor: themeObj.divider.default 
                                }} 
                              />
                            )}
                          </td>
                        );
                      })()}
                      {finalColumns.map((col) => {
                        const colId = String(col.id || col.name).toLowerCase();
                        if (visibleColumns[colId] === false || isColHiddenByBreakpoint(col)) return null;
                        
                        let cellVal;
                        if (col.sparkline) {
                          const rawData = col.selector(row, rowIndex);
                          cellVal = <Sparkline data={Array.isArray(rawData) ? rawData : []} config={col.sparklineConfig} label={`${colId}-${rowIndex}`} />;
                        } else if (col.cell) {
                          cellVal = col.cell(row, rowIndex, col, colId);
                        } else if (col.format) {
                          cellVal = col.format(row, rowIndex);
                        } else {
                          cellVal = col.selector(row, rowIndex);
                        }
                        
                        const isTitle = colId === 'title';
                        const alignmentClass = col.right ? 'text-right' : (col.center || col.button) ? 'text-center' : 'text-left';
                        const actualPadding = col.compact ? 'p-1' : cellPadding;
                        const wrapClass = col.wrap ? 'whitespace-normal break-words' : 'truncate whitespace-nowrap';
                        
                        const colIndex = visibleCols.findIndex(c => String(c.id || c.name).toLowerCase() === String(colId).toLowerCase());
                        const actualThIndex = colIndex + (isSelectableRows ? 1 : 0) + (isExpanderVisible ? 1 : 0);
                        const widthStyle = getColStyle(colId);

                        const { condStyles, condClasses } = (() => {
                          let combinedStyle: React.CSSProperties = {};
                          let combinedClasses: string[] = [];
                          if (!col.conditionalCellStyles) return { condStyles: combinedStyle, condClasses: combinedClasses };
                          
                          for (const cond of col.conditionalCellStyles) {
                            if (cond.when(row)) {
                              if (cond.style) {
                                const ruleStyle = typeof cond.style === 'function' ? cond.style(row) : cond.style;
                                combinedStyle = { ...combinedStyle, ...ruleStyle };
                              }
                              if (cond.classNames) {
                                combinedClasses = [...combinedClasses, ...cond.classNames];
                              }
                            }
                          }
                          return { condStyles: combinedStyle, condClasses: combinedClasses };
                        })();

                        const heatmapStyle = (() => {
                          if (col.heatmap) {
                            const val = col.selector(row, rowIndex);
                            const numericVal = getNumericValue(val);
                            const range = heatmapRanges[colId] || { min: 0, max: 100 };
                            return getHeatmapStyles(numericVal, range.min, range.max, col.heatmapConfig);
                          }
                          return {};
                        })();

                        const cellStyle: React.CSSProperties = {
                          color: (isRowSelected && highlightSelected) ? themeObj.context.text : (isTitle ? themeObj.text.primary : themeObj.text.secondary),
                          borderBottomWidth: '1px',
                          borderBottomStyle: 'solid',
                          borderBottomColor: themeObj.divider.default,
                          overflow: col.allowOverflow ? 'visible' : undefined,
                          ...customStyles?.cells?.style,
                          ...(colId === draggedColId ? customStyles?.cells?.draggingStyle : {}),
                          ...widthStyle,
                          ...col.style,
                          ...condStyles,
                          ...heatmapStyle,
                        };

                        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colId === colId;
                        const isEditable = col.editable || col.editor !== undefined;

                        const handleEditCommit = (overrideValue?: string) => {
                          if (!editingCell) return;
                          const finalValue = overrideValue !== undefined ? overrideValue : editingCell.value;
                          
                          let isValid: boolean | string = true;
                          if (col.validate) {
                            isValid = col.validate(finalValue, row, col);
                          }

                          if (isValid === true) {
                            const oldValue = col.selector ? col.selector(row, rowIndex) : undefined;
                            const rowKey = row[keyField] !== undefined ? row[keyField] : (row.id !== undefined ? row.id : rowIndex);

                            if (oldValue !== finalValue) {
                              if (config?.auditTrail) {
                                const newLog = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  timestamp: new Date(),
                                  rowId: rowKey,
                                  columnId: colId,
                                  columnName: String(col.name),
                                  oldValue,
                                  newValue: finalValue
                                };
                                setAuditLogs(prev => [newLog, ...prev]);

                                if (actualOnline) {
                                  void safeFetchJson('/api/audit-trail', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      action: "Cell Updated",
                                      details: `Cell on Row ID ${rowKey}, Column "${col.name}" changed from "${oldValue || 'empty'}" to "${finalValue}".`
                                    })
                                  });
                                }
                              }

                              if (config?.offlineEditing && !actualOnline) {
                                const canonicalColId = col.id !== undefined ? String(col.id) : colId;
                                // Save to offline queue
                                setOfflineChanges(prev => {
                                  const existingIndex = prev.findIndex(c => String(c.rowId) === String(rowKey) && String(c.columnId).toLowerCase() === String(canonicalColId).toLowerCase() && c.status === 'pending');
                                  if (existingIndex > -1) {
                                    const updated = [...prev];
                                    updated[existingIndex] = {
                                      ...updated[existingIndex],
                                      columnId: canonicalColId,
                                      newValue: finalValue,
                                      timestamp: new Date().toISOString()
                                    };
                                    return updated;
                                  } else {
                                    return [...prev, {
                                      id: Math.random().toString(36).substr(2, 9),
                                      rowId: rowKey,
                                      columnId: canonicalColId,
                                      columnName: String(col.name),
                                      oldValue,
                                      newValue: finalValue,
                                      timestamp: new Date().toISOString(),
                                      status: 'pending'
                                    }];
                                  }
                                });
                              } else {
                                // Default flow (online)
                                setCellEditHistory(prev => [
                                  ...prev.slice(-49),
                                  {
                                    row,
                                    col,
                                    oldValue: oldValue === undefined || oldValue === null ? '' : String(oldValue),
                                    newValue: String(finalValue),
                                  },
                                ]);
                                if (onCellEdit) {
                                  onCellEdit(row, finalValue, col);
                                }
                              }
                            }
                            setEditingCell(null);
                          } else if (typeof isValid === 'string') {
                            setEditingCell({ ...editingCell, value: finalValue, error: isValid });
                          } else {
                            setEditingCell(null);
                          }
                        };

                        const isFocusedCell =
                          isKeyboardNavActive &&
                          focusedCell?.rowIndex === rowIndex &&
                          focusedCell?.colIndex === colIndex;

                        return (
                          <td 
                            key={`cell-${colId}`} 
                            className={`${actualPadding} ${isTitle ? 'font-medium' : ''} ${alignmentClass} transition-all duration-200 relative ${isEditable && !isEditing ? 'ig_cell-editable' : ''} ${isEditing ? 'ig_cellEditing' : ''} ${isFocusedCell ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/30' : ''} ${condClasses.join(' ')}`}
                            style={cellStyle}
                            onClick={(e) => {
                              if (isKeyboardNavActive && colIndex >= 0) {
                                setFocusedCell({ rowIndex, colIndex });
                              }
                              if (col.button || col.ignoreRowClick) {
                                e.stopPropagation();
                              } else if (isEditable && !isEditing) {
                                e.stopPropagation();
                                setEditingCell({
                                  rowIndex,
                                  colId,
                                  value: String(col.selector ? col.selector(row, rowIndex) : ''),
                                  error: null
                                });
                              }
                            }}
                            onDoubleClick={(e) => {
                              if (col.button || col.ignoreRowClick) {
                                e.stopPropagation();
                              }
                            }}
                          >
                            <div className={wrapClass}>
                              {isEditing ? (
                                <div className="relative flex flex-col gap-1 w-full" onClick={e => e.stopPropagation()}>
                                  {col.editor?.type === 'custom' ? (
                                    col.editor.render({
                                      row,
                                      value: editingCell.value,
                                      setValue: (next: string) => setEditingCell({ ...editingCell, value: next, error: null }),
                                      commit: (val?: string) => handleEditCommit(val),
                                      cancel: () => setEditingCell(null),
                                      column: col
                                    })
                                  ) : col.editor?.type === 'select' ? (
                                    <select
                                      autoFocus
                                      className={`ig_editSelect w-full px-2 py-1 text-sm border rounded outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 ${editingCell.error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300'}`}
                                      value={editingCell.value}
                                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value, error: null })}
                                      onBlur={() => handleEditCommit()}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleEditCommit();
                                        else if (e.key === 'Escape') setEditingCell(null);
                                      }}
                                    >
                                      {col.editor.placeholder && <option value="" disabled>{col.editor.placeholder}</option>}
                                      {col.editor.options.map((opt: any) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  ) : col.editor?.type === 'checkbox' ? (
                                    <input
                                      autoFocus
                                      type="checkbox"
                                      className={`w-4 h-4 mx-auto ${editingCell.error ? 'border-red-500' : ''}`}
                                      checked={editingCell.value === 'true'}
                                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.checked ? 'true' : 'false', error: null })}
                                      onBlur={() => handleEditCommit()}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleEditCommit();
                                        else if (e.key === 'Escape') setEditingCell(null);
                                      }}
                                    />
                                  ) : (
                                    <input
                                      autoFocus
                                      type={col.editor?.type || 'text'}
                                      placeholder={(col.editor as any)?.placeholder}
                                      min={(col.editor as any)?.min}
                                      max={(col.editor as any)?.max}
                                      step={(col.editor as any)?.step}
                                      className={`ig_editInput w-full px-2 py-1 text-sm border rounded outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 ${editingCell.error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300'}`}
                                      value={editingCell.value}
                                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value, error: null })}
                                      onBlur={() => handleEditCommit()}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleEditCommit();
                                        } else if (e.key === 'Escape') {
                                          setEditingCell(null);
                                        }
                                      }}
                                    />
                                  )}
                                  {editingCell.error && (
                                    <span className="text-[10px] text-red-600 bg-red-50 px-1 py-0.5 rounded leading-tight absolute -bottom-5 left-0 z-10 shadow-sm border border-red-100 whitespace-nowrap">
                                      {editingCell.error}
                                    </span>
                                  )}
                                </div>
                              ) : (() => {
                                const isPendingOffline = config?.offlineEditing && offlineChanges.some(c => String(c.rowId) === String(rowKey) && String(c.columnId).toLowerCase() === String(colId).toLowerCase() && c.status === 'pending');
                                const cellIdentity = `${String(rowKey)}::${colId}`;
                                const isCopied = copiedCellKey === cellIdentity;
                                const rawCopyText = col.selector ? col.selector(row, rowIndex) : (row as any)[col.id];

                                const displayCellVal = highlightCellContent(cellVal);
                                const contentNode = isPendingOffline ? (
                                  <div className="flex items-center gap-1.5 justify-between w-full">
                                    <span className="truncate">{displayCellVal}</span>
                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse flex-shrink-0" title="Offline update pending sync" />
                                  </div>
                                ) : displayCellVal;

                                if (col.copyable) {
                                  return (
                                    <div className="group/copy flex items-center justify-between gap-1.5 w-full min-w-0">
                                      <div className="min-w-0 truncate">{contentNode}</div>
                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                                            try {
                                              await navigator.clipboard.writeText(rawCopyText === null || rawCopyText === undefined ? '' : String(rawCopyText));
                                              setCopiedCellKey(cellIdentity);
                                              setTimeout(() => {
                                                setCopiedCellKey(prev => (prev === cellIdentity ? null : prev));
                                              }, 1400);
                                            } catch {
                                              // Ignore clipboard errors
                                            }
                                          }
                                        }}
                                        className={`p-1 rounded transition-opacity shrink-0 ${
                                          isCopied
                                            ? 'opacity-100 text-emerald-600 bg-emerald-50'
                                            : 'opacity-70 sm:opacity-0 sm:group-hover/copy:opacity-100 focus:opacity-100 text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                                        }`}
                                        title={isCopied ? 'Copied!' : 'Copy cell value'}
                                        aria-label={`Copy ${String(col.name)} value`}
                                      >
                                        {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  );
                                }
                                return contentNode;
                              })()}
                            </div>
                            {showColSep && actualThIndex < totalColsCount - 1 && (
                              <div 
                                className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                                style={{ 
                                  height: columnSeparator === 'full' ? '100%' : '60%', 
                                  backgroundColor: themeObj.divider.default 
                                }} 
                              />
                            )}
                          </td>
                        );
                      })}
                      {config?.rowComments && (() => {
                        const commentsList = rowCommentsData[String(rowKey)] || [];
                        const commentsCount = commentsList.length;
                        return (
                          <td 
                            className={`${cellPadding} text-center transition-all duration-200 relative w-24`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCommentRowKey(rowKey);
                              setNewCommentText("");
                              setShowCommentsDrawer(true);
                            }}
                          >
                            <button
                              type="button"
                              className={`p-1.5 rounded-full hover:bg-slate-100 transition-colors flex items-center justify-center mx-auto relative group ${
                                commentsCount > 0 ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                              }`}
                              title={`${commentsCount} comment${commentsCount === 1 ? '' : 's'}`}
                            >
                              <MessageSquare className="w-4 h-4" />
                              {commentsCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white">
                                  {commentsCount}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })()}
                    </RowWrapper>
                  );

                  if (expandableRows || groupHeaderRow) {
                    return (
                      <React.Fragment key={`row-group-${rowKey}`}>
                        {groupHeaderRow}
                        {rowElement}
                        {expandableRows && isExpanded && expandableRowsComponent && (
                          <tr 
                            style={{ 
                              ...expandedRowStyle, 
                              borderBottomWidth: '1px', 
                              borderBottomStyle: 'solid', 
                              borderBottomColor: themeObj.divider.default,
                              ...customStyles?.expanderRow?.style
                            }}
                          >
                            <td colSpan={totalColsCount} className="p-4 bg-slate-50/50" style={customStyles?.expanderCell?.style}>
                              <div className="transition-all duration-300">
                                <SafeFeatureBoundary>
                                  {React.createElement(expandableRowsComponent, {
                                    data: row,
                                    ...expandableRowsComponentProps
                                  })}
                                </SafeFeatureBoundary>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }

                  return rowElement;
                })}
                    {bottomSpacerHeight > 0 && (
                      <tr aria-hidden="true" style={{ height: bottomSpacerHeight }}>
                        <td colSpan={totalColsCount} style={{ padding: 0, border: 0, height: bottomSpacerHeight }} />
                      </tr>
                    )}
                  </>
                );
              })() : (
                <tr>
                  <td colSpan={totalColsCount} className="p-0" style={customStyles?.noData?.style}>
                    {noDataComponent !== undefined ? (
                      noDataComponent
                    ) : (data && data.length > 0) ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4">
                        <div className="text-slate-300 mb-2">
                          <Filter className="w-10 h-10 stroke-1" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-700">No matching records</h4>
                        <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
                          No rows match your current search or active filters.
                        </p>
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="mt-3 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                          Clear Active Filters
                        </button>
                      </div>
                    ) : (
                      <DefaultNoDataComponent />
                    )}
                  </td>
                </tr>
              )}
            </AnimatePresenceWrapper>
          </tbody>
          {shouldShowFooter && (
            <tfoot style={customStyles?.footer?.style}>
              {footerComponent ? (
                <tr style={customStyles?.footer?.style}>
                  <td colSpan={totalColsCount} className="p-0">
                    <SafeFeatureBoundary>
                      {React.createElement(footerComponent, { rows: paginatedData, columns: visibleCols })}
                    </SafeFeatureBoundary>
                  </td>
                </tr>
              ) : (
                <tr className="border-t-2" style={{ borderColor: themeObj.divider.default, ...customStyles?.footer?.style }}>
                  {isRowNumbersVisible && (
                    <td
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                        borderTopWidth: '2px',
                        borderTopStyle: 'solid',
                        borderTopColor: themeObj.divider.default,
                      }}
                      className={`${cellPadding} text-center transition-all duration-200 relative`}
                    />
                  )}
                  {isExpanderVisible && (
                    <td 
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                        borderTopWidth: '2px',
                        borderTopStyle: 'solid',
                        borderTopColor: themeObj.divider.default,
                      }}
                      className={`${cellPadding} text-center transition-all duration-200 relative`}
                    >
                      {showColSep && 0 < totalColsCount - 1 && (
                        <div 
                          className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                          style={{ 
                            height: columnSeparator === 'full' ? '100%' : '60%', 
                            backgroundColor: themeObj.divider.default 
                          }} 
                        />
                      )}
                    </td>
                  )}
                  {isSelectableRows && (
                    <td 
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                        borderTopWidth: '2px',
                        borderTopStyle: 'solid',
                        borderTopColor: themeObj.divider.default,
                      }}
                      className={`${cellPadding} text-center transition-all duration-200 relative`}
                    >
                      {showColSep && (isExpanderVisible ? 1 : 0) < totalColsCount - 1 && (
                        <div 
                          className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                          style={{ 
                            height: columnSeparator === 'full' ? '100%' : '60%', 
                            backgroundColor: themeObj.divider.default 
                          }} 
                        />
                      )}
                    </td>
                  )}
                  {config?.bookmarks && (
                    <td 
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                        borderTopWidth: '2px',
                        borderTopStyle: 'solid',
                        borderTopColor: themeObj.divider.default,
                      }}
                      className={`${cellPadding} text-center transition-all duration-200 relative`}
                    >
                      {showColSep && ((isExpanderVisible ? 1 : 0) + (isSelectableRows ? 1 : 0)) < totalColsCount - 1 && (
                        <div 
                          className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                          style={{ 
                            height: columnSeparator === 'full' ? '100%' : '60%', 
                            backgroundColor: themeObj.divider.default 
                          }} 
                        />
                      )}
                    </td>
                  )}
                  {visibleCols.map((col) => {
                    const colId = String(col.id || col.name).toLowerCase();
                    const colIndex = visibleCols.findIndex(c => (String(c.id || c.name).toLowerCase()) === colId);
                    const actualThIndex = colIndex + (isSelectableRows ? 1 : 0) + (isExpanderVisible ? 1 : 0) + (isBookmarksVisible ? 1 : 0);

                    return (
                      <td
                        key={`footer-cell-${colId}`}
                        className={`${cellPadding} font-semibold transition-all duration-200 relative tabular-nums ${col.right ? 'text-right' : col.center ? 'text-center' : 'text-left'}`}
                        style={{
                          color: themeObj.text.primary,
                          borderTopWidth: '2px',
                          borderTopStyle: 'solid',
                          borderTopColor: themeObj.divider.default,
                          backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                          ...customStyles?.footerCells?.style,
                          ...getColStyle(colId)
                        }}
                      >
                        {col.footer !== undefined ? (
                          typeof col.footer === 'function' ? col.footer(sortedData) : col.footer
                        ) : col.aggregation !== undefined ? (() => {
                          if (typeof col.aggregation === 'function') {
                            return col.aggregation(sortedData);
                          }
                          if (sortedData.length === 0) return '—';
                          const rawVals = sortedData.map((r, rIdx) => col.selector ? col.selector(r, rIdx) : (r as any)[colId]).filter(v => v !== undefined && v !== null && v !== '');
                          const nums = rawVals.map(v => getNumericValue(v)).filter(n => !isNaN(n));
                          const prefix = col.aggregationLabel ? `${col.aggregationLabel}: ` : '';
                          switch (col.aggregation) {
                            case 'count':
                              return `${prefix || 'Count: '}${rawVals.length}`;
                            case 'unique':
                              return `${prefix || 'Unique: '}${new Set(rawVals.map(String)).size}`;
                            case 'sum': {
                              const total = nums.reduce((a, b) => a + b, 0);
                              return `${prefix || 'Sum: '}${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                            }
                            case 'avg': {
                              const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
                              return `${prefix || 'Avg: '}${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                            }
                            case 'min': {
                              const min = nums.length ? Math.min(...nums) : 0;
                              return `${prefix || 'Min: '}${min.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                            }
                            case 'max': {
                              const max = nums.length ? Math.max(...nums) : 0;
                              return `${prefix || 'Max: '}${max.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                            }
                            default:
                              return '';
                          }
                        })() : ''}
                        {showColSep && actualThIndex < totalColsCount - 1 && (
                          <div 
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-[1px] pointer-events-none" 
                            style={{ 
                              height: columnSeparator === 'full' ? '100%' : '60%', 
                              backgroundColor: themeObj.divider.default 
                            }} 
                          />
                        )}
                      </td>
                    );
                  })}
                  {config?.rowComments && (
                    <td 
                      style={{
                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                        borderTopWidth: '2px',
                        borderTopStyle: 'solid',
                        borderTopColor: themeObj.divider.default,
                      }}
                      className={`${cellPadding} text-center transition-all duration-200 relative`}
                    />
                  )}
                </tr>
              )}
            </tfoot>
          )}
        </table>
        )}

        {/* Overlay Spinner for re-fetching when data is already present */}
        {progressPending && paginatedData.length > 0 && (
          <div className="absolute inset-0 top-[45px] flex items-center justify-center bg-white/40 backdrop-blur-[0.5px] z-10 transition-all" style={customStyles?.progress?.style}>
            {progressComponent !== undefined ? progressComponent : <DefaultSpinner />}
          </div>
        )}
      </div>

      {/* Side Preview Panel (inline on desktop md+, fixed slide-over drawer on mobile) */}
      {config?.sidePreview && (
        <AnimatePresence>
          {previewRow && (
            <>
              <div
                className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
                onClick={() => setPreviewRow(null)}
              />
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="fixed inset-y-0 right-0 z-50 w-full max-w-sm shadow-2xl md:static md:w-[360px] md:max-w-none md:shadow-none md:z-auto border-l border-slate-200 bg-slate-50 flex-shrink-0 flex flex-col h-full overflow-hidden"
                style={{ maxHeight: effectiveWidth >= 768 && fixedHeader ? fixedHeaderScrollHeight : '100%' }}
              >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-md bg-indigo-50 text-indigo-600 shrink-0">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Preview Details</h4>
                    <p className="text-[10px] text-slate-400 truncate font-mono">
                      {(() => {
                        const titleCol = finalColumns.find(c => ['title', 'name'].includes(String(c.id || c.name).toLowerCase())) || finalColumns[0];
                        if (titleCol) {
                          try {
                            return String(titleCol.selector ? titleCol.selector(previewRow, 0) : (previewRow as any)[titleCol.id || '']);
                          } catch (e) {
                            return 'Selected Row';
                          }
                        }
                        return 'Selected Row';
                      })()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewRow(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                  aria-label="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {renderSidePreview ? (
                  <SafeFeatureBoundary>
                    {renderSidePreview(previewRow, () => setPreviewRow(null))}
                  </SafeFeatureBoundary>
                ) : (
                  <>
                    <div className="space-y-3">
                      {finalColumns.map((col) => {
                        const colId = String(col.id || col.name).toLowerCase();
                        
                        let rawVal;
                        try {
                          rawVal = col.selector ? col.selector(previewRow, 0) : (previewRow as any)[colId];
                        } catch (e) {
                          rawVal = (previewRow as any)[colId];
                        }

                        let displayVal = rawVal;
                        if (col.format) {
                          try {
                            displayVal = col.format(previewRow, 0);
                          } catch (e) {}
                        }

                        if (col.button || React.isValidElement(displayVal)) {
                          if (typeof rawVal === 'string' || typeof rawVal === 'number' || typeof rawVal === 'boolean') {
                            displayVal = String(rawVal);
                          } else {
                            return null;
                          }
                        }

                        const valString = String(displayVal ?? '');

                        return (
                          <div key={colId} className="bg-white rounded-lg border border-slate-100 p-3 shadow-sm hover:border-slate-200 transition-all flex flex-col group relative">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              {col.name}
                            </span>
                            <div className="text-xs text-slate-800 pr-8 break-words font-medium">
                              {valString || <span className="text-slate-300 italic">Empty</span>}
                            </div>
                            {valString && (
                              <button
                                onClick={() => {
                                  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                                    navigator.clipboard.writeText(valString).then(() => {
                                      setCopiedField(colId);
                                      setTimeout(() => setCopiedField(null), 1500);
                                    }).catch(() => {});
                                  }
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded bg-slate-50 border border-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-100 transition-all shadow-sm"
                                title="Copy Value"
                              >
                                {copiedField === colId ? (
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Extra Meta Data */}
                    {(() => {
                      const colKeys = new Set(finalColumns.map(col => String(col.id || col.name).toLowerCase()));
                      const allKeys = Object.keys(previewRow || {});
                      const extraFields = allKeys.filter(key => {
                        const kLower = key.toLowerCase();
                        return !colKeys.has(kLower) && key !== 'id' && !key.startsWith('_') && typeof (previewRow as any)[key] !== 'function';
                      });

                      if (extraFields.length === 0) return null;

                      return (
                        <div className="pt-3 border-t border-slate-200">
                          <h5 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Other Metadata</h5>
                          <div className="space-y-1.5">
                            {extraFields.map(key => {
                              const val = (previewRow as any)[key];
                              const valString = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');

                              return (
                                <div key={key} className="flex justify-between items-center gap-2 py-1.5 px-2 bg-slate-100/60 rounded border border-slate-100 text-[10px] relative group/meta">
                                  <span className="font-mono text-slate-500 truncate max-w-[120px]" title={key}>{key}</span>
                                  <span className="font-medium text-slate-700 truncate pr-6 max-w-[160px]" title={valString}>
                                    {valString || <span className="text-slate-300 italic">empty</span>}
                                  </span>
                                  {valString && (
                                    <button
                                      onClick={() => {
                                        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                                          navigator.clipboard.writeText(valString).then(() => {
                                            setCopiedField(key);
                                            setTimeout(() => setCopiedField(null), 1500);
                                          }).catch(() => {});
                                        }
                                      }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 opacity-0 group-hover/meta:opacity-100 hover:text-slate-600 transition-all bg-white border border-slate-100 rounded shadow-xs"
                                      title="Copy Value"
                                    >
                                      {copiedField === key ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </div>
    )}
      
      {/* Spreadsheet-style Live Selection & Dataset Status Bar */}
      {(showStatusBar || (isSelectableRows && selected.length > 0)) && (() => {
        const selectedRowsForStats = selected.length > 0
          ? finalData.filter((r: any, idx: number) => selected.includes(getRowKey(r, idx)))
          : sortedData;
        const numericCol = visibleCols.find((col) => {
          if (col.filterType === 'number' || col.heatmap || col.aggregation === 'sum' || col.aggregation === 'avg') return true;
          const sample = selectedRowsForStats[0] ? col.selector(selectedRowsForStats[0], 0) : undefined;
          return typeof sample === 'number';
        });
        const nums = numericCol
          ? selectedRowsForStats
              .map((r, i) => getNumericValue(numericCol.selector(r, i)))
              .filter((n) => !isNaN(n))
          : [];
        const sumVal = nums.length ? nums.reduce((a, b) => a + b, 0) : 0;
        const avgVal = nums.length ? sumVal / nums.length : 0;
        const minVal = nums.length ? Math.min(...nums) : 0;
        const maxVal = nums.length ? Math.max(...nums) : 0;

        return (
          <div
            className="px-4 py-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.025)' : '#f8fafc',
              borderColor: themeObj.divider.default,
              color: themeObj.text.secondary,
            }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Rows: <strong style={{ color: themeObj.text.primary }}>{sortedData.length}</strong>
                {sortedData.length !== finalData.length ? ` / ${finalData.length}` : ''}
              </span>
              {selected.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/70">
                  Selected: {selected.length}
                </span>
              )}
              {activeGroupBy && (
                <span>
                  Group: <strong style={{ color: themeObj.text.primary }}>{activeGroupBy}</strong>
                </span>
              )}
            </div>
            {numericCol && nums.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[10px] uppercase tracking-wider opacity-75">
                  {String(numericCol.name)} ({selected.length > 0 ? 'Selected' : 'Active'}):
                </span>
                <span>
                  Sum: <strong style={{ color: themeObj.text.primary }}>{sumVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </span>
                <span>
                  Avg: <strong style={{ color: themeObj.text.primary }}>{avgVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </span>
                <span className="hidden sm:inline">
                  Min: <strong style={{ color: themeObj.text.primary }}>{minVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </span>
                <span className="hidden sm:inline">
                  Max: <strong style={{ color: themeObj.text.primary }}>{maxVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {(paginationPosition === 'bottom' || paginationPosition === 'both') && renderPaginationControls()}

      {/* Audit Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Audit Trail
              </h3>
              <button 
                onClick={() => setShowAuditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {auditLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic">
                  No cell edits have been made in this session.
                </div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map(log => (
                    <div key={log.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Row ID: {log.rowId} &bull; Column: {log.columnName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {log.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex-1 bg-red-50 text-red-700 p-2 rounded line-through border border-red-100">
                          {String(log.oldValue)}
                        </div>
                        <div className="text-slate-400">&rarr;</div>
                        <div className="flex-1 bg-green-50 text-green-700 p-2 rounded border border-green-100">
                          {String(log.newValue)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sliding Row Comments Drawer */}
      <AnimatePresence>
        {showCommentsDrawer && selectedCommentRowKey !== null && (() => {
          const comments = rowCommentsData[String(selectedCommentRowKey)] || [];
          const matchedRow = finalData.find(row => {
            const rowKey = row[keyField] !== undefined ? row[keyField] : row.id;
            return String(rowKey) === String(selectedCommentRowKey);
          });
          const rowTitle = matchedRow ? (matchedRow.title || matchedRow.name || matchedRow.id || `Row ${selectedCommentRowKey}`) : `Row ${selectedCommentRowKey}`;
          
          // Autocomplete suggestions
          const filteredMentions = teamMembers.filter(m => 
            m.toLowerCase().startsWith(mentionSearch.toLowerCase())
          );

          const selectMention = (name: string) => {
            // Replace the typed @mention search with the selected name
            const beforeMention = newCommentText.slice(0, newCommentText.lastIndexOf('@'));
            setNewCommentText(beforeMention + '@' + name + ' ');
            setShowMentionsList(false);
            setMentionSearch("");
            setMentionIndex(-1);
          };

          const handleAddComment = async () => {
            if (!newCommentText.trim() || !selectedCommentRowKey) return;
            
            const commentPayload = {
              author: "You",
              text: newCommentText
            };

            const serverComment = await safeFetchJson<any>(`/api/comments/${selectedCommentRowKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(commentPayload)
            });

            const newComment = serverComment ? {
              id: serverComment.id,
              user: serverComment.author,
              text: serverComment.text,
              timestamp: new Date(serverComment.timestamp)
            } : {
              id: Math.random().toString(36).substr(2, 9),
              user: "You",
              text: newCommentText,
              timestamp: new Date()
            };
            
            setRowCommentsData(prev => ({
              ...prev,
              [String(selectedCommentRowKey)]: [...(prev[String(selectedCommentRowKey)] || []), newComment]
            }));
            setNewCommentText("");
            setShowMentionsList(false);
          };

          const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (showMentionsList && filteredMentions.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredMentions.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const activeIndex = mentionIndex >= 0 ? mentionIndex : 0;
                selectMention(filteredMentions[activeIndex]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowMentionsList(false);
              }
            } else {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }
          };

          const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const val = e.target.value;
            setNewCommentText(val);

            // Check if user is typing a mention
            const lastAtIdx = val.lastIndexOf('@');
            if (lastAtIdx !== -1 && lastAtIdx >= val.length - 15) { // within last 15 chars
              const textAfterAt = val.slice(lastAtIdx + 1);
              // Mentions shouldn't have spaces
              if (!textAfterAt.includes(' ')) {
                setShowMentionsList(true);
                setMentionSearch(textAfterAt);
                return;
              }
            }
            setShowMentionsList(false);
          };

          return (
            <>
              {/* Overlay backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCommentsDrawer(false)}
                className="fixed inset-0 bg-slate-900 z-40 cursor-pointer"
              />

              {/* Drawer Container */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-600" />
                      Row Comments
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-[280px]">
                      {rowTitle}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCommentsDrawer(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Comment Thread */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50/50">
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-60">
                      <div className="p-3 bg-indigo-50 text-indigo-500 rounded-full mb-3">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No comments yet</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                        Start the conversation by typing your comment below. Mention colleagues with @name.
                      </p>
                    </div>
                  ) : (
                    comments.map((comment) => {
                      const isYou = comment.user === "You";
                      const colorMap: Record<string, string> = {
                        "Alice": "bg-pink-100 text-pink-700 border-pink-200",
                        "Bob": "bg-blue-100 text-blue-700 border-blue-200",
                        "Charlie": "bg-green-100 text-green-700 border-green-200",
                        "David": "bg-amber-100 text-amber-700 border-amber-200",
                        "Emma": "bg-purple-100 text-purple-700 border-purple-200",
                        "You": "bg-indigo-100 text-indigo-700 border-indigo-200"
                      };
                      const userColor = colorMap[comment.user] || "bg-slate-100 text-slate-700 border-slate-200";
                      
                      return (
                        <div key={comment.id} className="flex gap-3 items-start">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${userColor}`}>
                            {comment.user.charAt(0)}
                          </div>
                          <div className="flex-1 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm relative">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="font-semibold text-slate-800 text-sm">
                                {comment.user}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {comment.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed break-words">
                              {renderCommentText(comment.text)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Panel */}
                <div className="p-4 border-t border-slate-200 bg-white relative">
                  {/* Mentions autocomplete list */}
                  {showMentionsList && filteredMentions.length > 0 && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg border border-slate-200 shadow-xl max-h-40 overflow-y-auto z-50 divide-y divide-slate-100">
                      <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <AtSign className="w-3 h-3 text-indigo-500" /> Team Members
                      </div>
                      {filteredMentions.map((name, idx) => {
                        const isHovered = idx === (mentionIndex >= 0 ? mentionIndex : 0);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => selectMention(name)}
                            className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${
                              isHovered ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600">
                              {name.charAt(0)}
                            </span>
                            <span className="font-medium">{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Textarea container */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 relative">
                      <textarea
                        rows={2}
                        value={newCommentText}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Write a comment... Use @ to mention"
                        className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 resize-none leading-relaxed"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!newCommentText.trim()}
                      onClick={handleAddComment}
                      className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-45 disabled:cursor-not-allowed shrink-0 flex items-center justify-center shadow-md shadow-indigo-200"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-slate-400 px-1">
                    <span>Press Enter to send</span>
                    <span className="flex items-center gap-0.5">
                      <AtSign className="w-2.5 h-2.5" /> Alice, Bob, Charlie, Emma...
                    </span>
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {isCommandPaletteOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsCommandPaletteOpen(false);
                setCommandSearch('');
              }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9998] cursor-pointer"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[90%] max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col focus:outline-none"
              tabIndex={-1}
              onKeyDown={handlePaletteKeyDown}
            >
              {/* Header with Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
                <Terminal className="w-5 h-5 text-indigo-600 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Type a command or search settings..."
                  value={commandSearch}
                  onChange={(e) => setCommandSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none border-none py-1 focus:ring-0 focus:outline-none"
                />
                <button
                  onClick={() => {
                    setIsCommandPaletteOpen(false);
                    setCommandSearch('');
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Commands List */}
              <div className="max-h-[350px] overflow-y-auto p-2 space-y-2">
                {filteredCommands.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No commands found matching "{commandSearch}"
                  </div>
                ) : (() => {
                  // Group commands by category
                  const categories: Record<string, typeof commands> = {};
                  filteredCommands.forEach(c => {
                    if (!categories[c.category]) {
                      categories[c.category] = [];
                    }
                    categories[c.category].push(c);
                  });

                  let absoluteIdx = 0;

                  return Object.entries(categories).map(([category, items]) => (
                    <div key={category} className="space-y-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50 rounded-md">
                        {category}
                      </div>
                      {items.map((cmd) => {
                        const currentAbsIdx = absoluteIdx++;
                        const isSelected = currentAbsIdx === selectedCommandIndex;
                        return (
                          <div
                            key={cmd.id}
                            onClick={() => {
                              cmd.action();
                              setIsCommandPaletteOpen(false);
                              setCommandSearch('');
                            }}
                            onMouseEnter={() => setSelectedCommandIndex(currentAbsIdx)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                              isSelected ? 'bg-indigo-50 text-indigo-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {cmd.icon}
                              </span>
                              <span className="text-xs truncate">{cmd.label}</span>
                            </div>
                            {cmd.shortcut && (
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm shrink-0">
                                {cmd.shortcut}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>

              {/* Footer Panel */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 select-none">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-slate-500">Ctrl + K</span> to open / close
                </div>
                <div className="flex items-center gap-3 font-medium">
                  <span className="flex items-center gap-0.5"><kbd className="px-1 border rounded bg-white">↑↓</kbd> navigate</span>
                  <span className="flex items-center gap-0.5"><kbd className="px-1 border rounded bg-white">enter</kbd> select</span>
                  <span className="flex items-center gap-0.5"><kbd className="px-1 border rounded bg-white">esc</kbd> close</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Universal LLM Integration & Data Copilot Modal */}
      {showLlmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-600 text-white">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Universal LLM Integration & AI Copilot</h4>
                  <p className="text-[11px] text-slate-500">Connect OpenAI, Anthropic Claude, Google Gemini, Ollama, or any custom endpoint</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLlmModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh] text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    LLM Provider
                  </label>
                  <select
                    value={runtimeProvider}
                    onChange={(e) => {
                      const next = e.target.value as LLMProviderType;
                      setRuntimeProvider(next);
                      const defaults: Record<LLMProviderType, string> = {
                        gemini: 'gemini-3.8-flash',
                        openai: 'gpt-4o-mini',
                        anthropic: 'claude-3-5-sonnet-latest',
                        ollama: 'llama3.2',
                        openrouter: 'openai/gpt-4o-mini',
                        custom: 'custom-model',
                        local: 'enterprisegrid-local-v1',
                      };
                      setRuntimeModel(defaults[next]);
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI (GPT-4o / o3-mini)</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="ollama">Ollama (Local LLM)</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom Proxy / Endpoint</option>
                    <option value="local">Built-in Offline Local Engine</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={runtimeModel}
                    onChange={(e) => setRuntimeModel(e.target.value)}
                    placeholder="e.g. gpt-4o-mini, claude-3-5-sonnet, llama3.2"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {runtimeProvider !== 'local' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Custom Proxy / Endpoint URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={runtimeEndpoint}
                    onChange={(e) => setRuntimeEndpoint(e.target.value)}
                    placeholder={
                      runtimeProvider === 'ollama'
                        ? 'http://localhost:11434/v1/chat/completions'
                        : '/api/llm or https://api.openai.com/v1/chat/completions'
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    If unreachable or unconfigured, EnterpriseGrid automatically falls back to its deterministic local analytical engine so features never break.
                  </p>
                </div>
              )}

              {/* Interactive Ask-Data Copilot */}
              <div className="border-t border-slate-200 pt-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Ask AI Copilot About Current Data ({filteredData.length} rows)
                </label>
                <form onSubmit={handleAskCopilot} className="flex gap-2">
                  <input
                    type="text"
                    value={aiCopilotQuestion}
                    onChange={(e) => setAiCopilotQuestion(e.target.value)}
                    placeholder="e.g. Summarize key trends or filter high ratings..."
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isAskingCopilot}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isAskingCopilot ? 'Thinking...' : 'Ask'}
                  </button>
                </form>
                {aiCopilotAnswer && (
                  <div className="mt-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-slate-700 leading-relaxed">
                    {aiCopilotAnswer}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleBuiltInAiInsights();
                      setShowLlmModal(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    Generate KPI Insights
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleBuiltInAiSummary();
                      setShowLlmModal(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Generate Executive Summary
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLlmModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Row Right-Click Context Menu */}
      {contextMenuState && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            top: Math.min(contextMenuState.y, typeof window !== 'undefined' ? window.innerHeight - 240 : contextMenuState.y),
            left: Math.min(contextMenuState.x, typeof window !== 'undefined' ? window.innerWidth - 220 : contextMenuState.x),
          }}
          className="fixed z-[9999] w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 text-xs text-slate-700"
        >
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            Row Actions
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(JSON.stringify(contextMenuState.row, null, 2));
                setExportToast('Row JSON copied!');
                setTimeout(() => setExportToast(null), 2000);
              }
              setContextMenuState(null);
            }}
            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Copy Row JSON</span>
          </button>
          {config?.sidePreview && (
            <button
              type="button"
              onClick={() => {
                setPreviewRow(contextMenuState.row);
                setContextMenuState(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Inspect in Side Preview</span>
            </button>
          )}
          {config?.bookmarks && (
            <button
              type="button"
              onClick={() => {
                const rKey = getRowKey(contextMenuState.row, contextMenuState.rowIndex);
                toggleBookmark(rKey);
                setContextMenuState(null);
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium"
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>Toggle Bookmark</span>
            </button>
          )}
          {rowContextMenu && rowContextMenu.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-100" />
              {rowContextMenu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.onClick(contextMenuState.row, contextMenuState.rowIndex);
                    setContextMenuState(null);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 font-medium ${
                    item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Built-in Add Row Modal */}
      {showAddRowModal && onAddRow && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                {addRowLabel}
              </h4>
              <button
                type="button"
                onClick={() => setShowAddRowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddRow(newRowDraft as Partial<T>);
                setShowAddRowModal(false);
              }}
              className="p-5 space-y-3 text-xs"
            >
              {finalColumns
                .filter((col) => !col.button && !col.sparkline && col.id !== 'plugin-actions')
                .map((col) => {
                  const key = String(col.id || col.name);
                  const label = typeof col.name === 'string' || typeof col.name === 'number' ? String(col.name) : key;
                  return (
                    <div key={key}>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        {label}
                      </label>
                      <input
                        type={col.filterType === 'number' ? 'number' : col.filterType === 'date' ? 'date' : 'text'}
                        value={newRowDraft[key] ?? ''}
                        onChange={(e) => setNewRowDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={`Enter ${label}...`}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  );
                })}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Built-in CSV / TSV Import Modal */}
      {showImportModal && onImportRows && (() => {
        const parsedPreview = importRawText.trim() ? parseCSV(importRawText) : [];
        const previewHeaders = parsedPreview.length > 0 ? Object.keys(parsedPreview[0]) : [];
        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Import CSV / TSV Data</h4>
                    <p className="text-[11px] text-slate-500">Upload a .csv/.tsv file or paste tabular records with headers matching column names or IDs.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer font-semibold text-slate-700">
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Choose .csv / .tsv File</span>
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || typeof FileReader === 'undefined') return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
                          setImportRawText(content);
                          setImportError(null);
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {parsedPreview.length > 0
                      ? `${parsedPreview.length} row(s) detected across ${previewHeaders.length} column(s)`
                      : 'Comma or Tab separated values'}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    CSV / TSV Content
                  </label>
                  <textarea
                    rows={6}
                    value={importRawText}
                    onChange={(e) => {
                      setImportRawText(e.target.value);
                      setImportError(null);
                    }}
                    placeholder={`account,owner,region,stage,arr,seats\nApex Cloud,Maya Lin,North America,Proposal,125000,340`}
                    className="w-full font-mono text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {importError && (
                  <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 font-medium">
                    {importError}
                  </div>
                )}

                {parsedPreview.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      Preview (first {Math.min(parsedPreview.length, 4)} of {parsedPreview.length} rows)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            {previewHeaders.map(h => (
                              <th key={h} className="px-2.5 py-1.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedPreview.slice(0, 4).map((row, idx) => (
                            <tr key={idx}>
                              {previewHeaders.map(h => (
                                <td key={h} className="px-2.5 py-1.5 text-slate-700 whitespace-nowrap max-w-[160px] truncate">{row[h]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={parsedPreview.length === 0}
                    onClick={() => {
                      const imported = importCSVText(importRawText);
                      if (imported.length === 0) {
                        setImportError('Please provide a header row followed by at least one data row.');
                        return;
                      }
                      setShowImportModal(false);
                      setImportRawText('');
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-45"
                  >
                    Import {parsedPreview.length > 0 ? `${parsedPreview.length} Row${parsedPreview.length === 1 ? '' : 's'}` : 'Rows'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Built-in Supporter Donation Modal (Removes all PRO badges and notifications once donated) */}
      {showDonationModal && !effectiveDonated && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-extrabold uppercase tracking-wider rounded bg-amber-400 text-slate-950">
                  PRO SUPPORTER
                </span>
                <h4 className="font-bold text-sm text-slate-900">
                  Support EnterpriseGrid &amp; Remove Badges
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowDonationModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-slate-600">
              <p className="leading-relaxed">
                Every Pro feature in <strong>@enterprisegrid/grid</strong> (AI Query, KPI Insights, Multi-View Calendar/Map/Kanban, Time Travel, Sparklines, Heatmaps, and External Summaries) is 100% accessible without restriction.
              </p>
              <p className="leading-relaxed font-medium text-slate-800">
                Make a one-time supporter donation to remove all <span className="font-mono font-bold text-amber-700">PRO</span> badges and donation notifications permanently across the grid and documentation:
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { amount: 5, label: 'Coffee', desc: '$5 Supporter' },
                  { amount: 15, label: 'Pro Dev', desc: '$15 Recommended' },
                  { amount: 49, label: 'Team', desc: '$49 Sponsor' },
                ].map((tier) => {
                  const active = selectedDonationAmount === tier.amount;
                  return (
                    <button
                      key={tier.amount}
                      type="button"
                      onClick={() => setSelectedDonationAmount(tier.amount)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-600/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="text-base font-extrabold font-mono text-slate-900">
                        ${tier.amount}
                      </div>
                      <div className="text-[11px] font-semibold mt-0.5">{tier.label}</div>
                      <div className="text-[10px] text-slate-500">{tier.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDonationModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Continue with Badges
                </button>
                <button
                  type="button"
                  onClick={() => handleCompleteDonation(selectedDonationAmount)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
                >
                  Donate ${selectedDonationAmount} &amp; Remove PRO Badges
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
      {showExternalBottom && (
        <SafeFeatureBoundary>
          <TableSummary
            summaryData={liveExternalSummary}
            title={externalSummaryTitle || 'External Table Data Summary'}
            variant={externalSummaryVariant}
            llmConfig={effectiveLlmConfig}
            theme={themeObj.colorScheme === 'dark' ? 'dark' : 'light'}
          />
        </SafeFeatureBoundary>
      )}
    </div>
  );
}

const DataTable = forwardRef(DataTableInner) as <T extends Record<string, any>>(
  props: DataTableProps<T> & { ref?: React.Ref<DataTableHandle> }
) => React.ReactElement | null;

export default DataTable;


export interface ColumnVisibilityEntry {
  id: string | number;
  name: React.ReactNode;
  visible: boolean;
}

export interface UseColumnVisibilityResult<T> {
  columns: TableColumn<T>[];
  visibility: ColumnVisibilityEntry[];
  toggle: (id: string | number) => void;
  setAll: (visible: boolean) => void;
}

export function useColumnVisibility<T>(rawColumns: TableColumn<T>[]): UseColumnVisibilityResult<T> {
  const [hiddenIds, setHiddenIds] = React.useState<Set<string | number>>(() => {
    const hidden = new Set<string | number>();
    rawColumns.forEach(c => {
      if (c.omit) {
        hidden.add(c.id || c.name as string);
      }
    });
    return hidden;
  });

  const toggle = (id: string | number) => {
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const setAll = (visible: boolean) => {
    if (visible) {
      setHiddenIds(new Set());
    } else {
      setHiddenIds(new Set(rawColumns.map(c => c.id || c.name as string)));
    }
  };

  const columns = React.useMemo(() => {
    return rawColumns.map(c => ({
      ...c,
      omit: hiddenIds.has(c.id || c.name as string)
    }));
  }, [rawColumns, hiddenIds]);

  const visibility = React.useMemo(() => {
    return rawColumns.map(c => ({
      id: c.id || c.name as string,
      name: c.name,
      visible: !hiddenIds.has(c.id || c.name as string)
    }));
  }, [rawColumns, hiddenIds]);

  return { columns, visibility, toggle, setAll };
}

export interface UseTableExportOptions<T> {
  columns: TableColumn<T>[];
  rows: T[];
  valueSource?: "selector" | "format";
  headerOverrides?: Record<string | number, string>;
  columnOrder?: (string | number)[];
}

export interface UseTableExportResult {
  toCSV: () => string;
  toJSON: () => string;
  download: (filename: string, format?: "csv" | "json") => void;
  copy: (format?: "csv" | "json") => Promise<void>;
}

export function useTableExport<T>({ columns, rows, valueSource = "selector", headerOverrides, columnOrder }: UseTableExportOptions<T>): UseTableExportResult {
  const getExportableColumns = React.useCallback(() => {
    let exportCols = columns.filter(c => !c.omit);
    if (columnOrder) {
      exportCols = columnOrder.map(id => exportCols.find(c => (c.id || c.name) === id)).filter(Boolean) as TableColumn<T>[];
    }
    return exportCols;
  }, [columns, columnOrder]);

  const toCSV = React.useCallback(() => {
    const exportCols = getExportableColumns();
    const headers = exportCols.map(c => {
      const id = c.id || c.name as string;
      return sanitizeCsvCell(headerOverrides?.[id] || c.name);
    });
    
    const csvRows = rows.map(row => {
      return exportCols.map((c, i) => {
        let val;
        if (valueSource === "format" && c.format) {
          val = c.format(row, i);
        } else if (c.selector) {
          val = c.selector(row, i);
        } else {
          val = "";
        }
        return sanitizeCsvCell(val);
      }).join(',');
    });

    return [headers.join(','), ...csvRows].join('\n');
  }, [getExportableColumns, rows, valueSource, headerOverrides]);

  const toJSON = React.useCallback(() => {
    const exportCols = getExportableColumns();
    
    const jsonRows = rows.map(row => {
      const obj: any = {};
      exportCols.forEach((c, i) => {
        const id = c.id || c.name as string;
        const key = String(headerOverrides?.[id] || c.name || id);
        if (DANGEROUS_OBJECT_KEYS.has(key)) return;
        
        let val;
        if (valueSource === "format" && c.format) {
          val = c.format(row, i);
        } else if (c.selector) {
          val = c.selector(row, i);
        } else {
          val = "";
        }
        obj[key] = val;
      });
      return obj;
    });
    
    return JSON.stringify(jsonRows, null, 2);
  }, [getExportableColumns, rows, valueSource, headerOverrides]);

  const download = React.useCallback((filename: string, format: "csv" | "json" = "csv") => {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
    const content = format === "csv" ? toCSV() : toJSON();
    const blob = new Blob([content], { type: format === "csv" ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [toCSV, toJSON]);

  const copy = React.useCallback(async (format: "csv" | "json" = "csv") => {
    const content = format === "csv" ? toCSV() : toJSON();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(content);
      } catch {
        // Ignore clipboard permission errors
      }
    }
  }, [toCSV, toJSON]);

  return { toCSV, toJSON, download, copy };
}

