import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Copy,
  Check,
  ChevronRight,
  Star,
  LayoutGrid,
  RotateCcw,
  Sparkles,
  MessageSquare,
  TrendingUp,
  History,
  FileText,
  Share2,
  Bookmark,
  MapPin,
  Calendar as CalendarIcon,
  Sliders,
  ShieldCheck,
  Edit3,
  ArrowUpDown,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { useState, useRef, useMemo, forwardRef, useEffect } from 'react';
import { SEO } from '../components/SEO';
import Footer from '../components/Footer';
import LiveCodeEditor from '../components/LiveCodeEditor';
import { DataTable as EnterpriseGridDemo, createTheme, isEnterpriseGridDonated, setEnterpriseGridDonated } from '@enterprisegrid/grid';
import type { DataTableHandle } from '@enterprisegrid/grid';

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().split('T')[0];
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().split('T')[0];

const initialData = [
  { id: 1, title: 'Beetlejuice', year: '1988', director: 'Tim Burton', lat: 34.0522, lng: -118.2437, date: todayStr, trend: [45, 52, 49, 63, 58, 67, 72, 85, 78, 92], rating: 4.2, genre: 'Comedy' },
  { id: 2, title: 'Ghostbusters', year: '1984', director: 'Ivan Reitman', lat: 40.7128, lng: -74.0060, date: tomorrowStr, trend: [68, 72, 70, 78, 85, 82, 89, 94, 91, 98], rating: 4.5, genre: 'Comedy' },
  { id: 3, title: 'The Matrix', year: '1999', director: 'Lana Wachowski, Lilly Wachowski', lat: -33.8688, lng: 151.2093, date: yesterdayStr, trend: [95, 92, 90, 88, 85, 82, 80, 83, 85, 89], rating: 4.9, genre: 'Sci-Fi' },
  { id: 4, title: 'Inception', year: '2010', director: 'Christopher Nolan', lat: 51.5074, lng: -0.1278, date: todayStr, trend: [75, 78, 82, 80, 85, 89, 93, 91, 95, 99], rating: 4.8, genre: 'Sci-Fi' },
  { id: 5, title: 'Interstellar', year: '2014', director: 'Christopher Nolan', lat: 64.1466, lng: -21.9426, date: tomorrowStr, trend: [80, 83, 85, 84, 88, 90, 92, 95, 98, 102], rating: 4.7, genre: 'Sci-Fi' },
  { id: 6, title: 'Pulp Fiction', year: '1994', director: 'Quentin Tarantino', lat: 34.0522, lng: -118.2437, date: yesterdayStr, trend: [90, 88, 85, 87, 82, 80, 78, 75, 79, 82], rating: 4.9, genre: 'Drama' },
  { id: 7, title: 'The Shawshank Redemption', year: '1994', director: 'Frank Darabont', lat: 40.7587, lng: -82.5221, date: todayStr, trend: [98, 99, 100, 97, 98, 99, 100, 99, 100, 102], rating: 5.0, genre: 'Drama' },
  { id: 8, title: 'The Godfather', year: '1972', director: 'Francis Ford Coppola', lat: 40.7128, lng: -74.0060, date: tomorrowStr, trend: [92, 94, 93, 95, 91, 90, 92, 94, 93, 96], rating: 5.0, genre: 'Drama' },
  { id: 9, title: 'The Dark Knight', year: '2008', director: 'Christopher Nolan', lat: 41.8781, lng: -87.6298, date: yesterdayStr, trend: [88, 90, 92, 95, 93, 96, 98, 100, 99, 104], rating: 4.9, genre: 'Action' },
  { id: 10, title: "Schindler's List", year: '1993', director: 'Steven Spielberg', lat: 50.0647, lng: 19.9450, date: todayStr, trend: [70, 72, 75, 73, 78, 80, 82, 85, 84, 88], rating: 4.9, genre: 'Drama' },
  { id: 11, title: 'Forrest Gump', year: '1994', director: 'Robert Zemeckis', lat: 32.0809, lng: -81.0912, date: tomorrowStr, trend: [85, 84, 86, 88, 89, 91, 93, 92, 95, 97], rating: 4.6, genre: 'Drama' },
  { id: 12, title: 'Star Wars: Episode V', year: '1980', director: 'Irvin Kershner', lat: 60.5518, lng: -6.4080, date: yesterdayStr, trend: [78, 82, 80, 85, 89, 87, 91, 95, 93, 98], rating: 4.8, genre: 'Sci-Fi' },
  { id: 13, title: 'Goodfellas', year: '1990', director: 'Martin Scorsese', lat: 40.7128, lng: -74.0060, date: todayStr, trend: [82, 80, 83, 85, 82, 81, 84, 88, 86, 90], rating: 4.7, genre: 'Drama' },
  { id: 14, title: 'The Lord of the Rings', year: '2003', director: 'Peter Jackson', lat: -41.2865, lng: 174.7762, date: tomorrowStr, trend: [94, 96, 95, 98, 97, 99, 100, 102, 101, 105], rating: 4.9, genre: 'Action' },
  { id: 15, title: 'Spirited Away', year: '2001', director: 'Hayao Miyazaki', lat: 35.6762, lng: 139.6503, date: yesterdayStr, trend: [72, 75, 78, 76, 80, 83, 85, 89, 87, 92], rating: 4.5, genre: 'Drama' },
];

createTheme(
  'enterprisegrid-brand',
  {
    text: {
      primary: '#1e293b',
      secondary: '#4f46e5',
    },
    background: {
      default: '#f8fafc',
    },
    context: {
      background: '#4f46e5',
      text: '#ffffff',
    },
    divider: {
      default: '#e2e8f0',
    },
    action: {
      button: '#6366f1',
      hover: 'rgba(79, 70, 229, 0.08)',
      disabled: 'rgba(15, 23, 42, 0.12)',
    },
  },
  'light'
);

const DEFAULT_CONFIG = {
  pagination: true,
  selectableRows: true,
  expandableRows: true,
  sortable: true,
  searchable: true,
  exportable: true,
  densityToggle: true,
  columnVisibility: true,
  animations: true,
  mapView: true,
  calendarView: true,
  savedViews: true,
  shareableViews: true,
  auditTrail: true,
  timeTravel: true,
  rowComments: true,
  heatmapCells: true,
  bookmarks: true,
  commandPalette: true,
  enableAiQuery: true,
  enableAiInsights: true,
  enableAiSummary: true,
  externalSummary: true,
  progressPending: false,
  simulateEmptyData: false,
  customProgressComponent: false,
  customNoDataComponent: false,
  keyField: 'id',
};

const CustomLoader = () => (
  <div className="flex flex-col items-center gap-3 bg-white border border-slate-200 p-6 rounded-xl shadow-md m-4">
    <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    <span className="text-xs font-semibold text-slate-600">Loading dataset...</span>
  </div>
);

const CustomEmptyState = () => (
  <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl m-4 text-center">
    <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-3 border border-indigo-100">
      <LayoutGrid className="w-5 h-5" />
    </div>
    <h4 className="text-sm font-semibold text-slate-800">No Records Available</h4>
    <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
      Turn off "Simulate Empty Data" in the configurator above to restore the sample dataset.
    </p>
  </div>
);

const ExpandedMovieComponent = ({ data }: any) => {
  const plots: Record<number, string> = {
    1: "A couple of recently deceased ghosts contract a 'bio-exorcist' to scare away the new owners of their home.",
    2: 'Three parapsychologists launch a unique ghost-removal service in New York City.',
    3: 'A computer hacker discovers reality is an elaborate simulation controlled by cyber-intelligence.',
    4: 'A thief specializing in dream-sharing technology is tasked with planting an idea into a target mind.',
    5: "Explorers travel through a wormhole in space to secure humanity's long-term survival.",
    6: 'Four interconnected stories of crime and redemption unfold across Los Angeles.',
    7: 'Two imprisoned men bond over years, finding solace and redemption through shared resilience.',
    8: 'The aging patriarch of a crime dynasty transfers control of his clandestine empire to his son.',
    9: 'Batman confronts chaos unleashed by the Joker across Gotham City.',
    10: 'Industrialist Oskar Schindler saves over a thousand refugees during World War II.',
  };

  const plot = plots[data.id] || 'Classic cinema title included in the EnterpriseGrid sample catalog.';

  return (
    <div className="p-4 sm:p-5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row gap-4 text-sm">
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <span>{data.title}</span>
          <span className="text-xs font-mono text-slate-500">· {data.year}</span>
        </div>
        <p className="text-slate-600 leading-[1.65]">{plot}</p>
        <p className="text-xs text-slate-500">
          Directed by <span className="font-medium text-slate-700">{data.director}</span>
        </p>
      </div>
      <div className="sm:w-36 flex sm:flex-col justify-between sm:justify-center items-start sm:items-center bg-white p-3 rounded-lg border border-slate-200 shrink-0">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rating</span>
        <span className="text-indigo-600 font-bold text-base font-mono tabular-nums">
          {Number(data.rating || 4.5).toFixed(1)} / 5.0
        </span>
      </div>
    </div>
  );
};

const CustomCheckbox = forwardRef(({ checked, onChange, disabled, ...rest }: any, ref: any) => (
  <span
    ref={ref}
    onClick={(e) => {
      if (disabled) return;
      onChange?.(e);
    }}
    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border cursor-pointer transition-colors ${
      checked
        ? 'bg-indigo-600 border-indigo-600 text-white'
        : 'bg-white border-slate-300 text-transparent hover:border-indigo-400'
    } ${disabled ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200' : ''}`}
    {...rest}
  >
    <Check className={`w-3.5 h-3.5 stroke-[3px] ${checked ? 'opacity-100' : 'opacity-0'}`} />
  </span>
));
CustomCheckbox.displayName = 'CustomCheckbox';

function computeLocalInsights(rows: any[], title: string): string {
  if (!rows.length) {
    return `No active rows in "${title}" to analyze.`;
  }
  const years = rows.map((r) => parseInt(r.year, 10)).filter((y) => !isNaN(y));
  const ratings = rows.map((r) => Number(r.rating)).filter((r) => !isNaN(r));
  const avgRating = ratings.length
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
    : 'N/A';
  const minYear = years.length ? Math.min(...years) : 'N/A';
  const maxYear = years.length ? Math.max(...years) : 'N/A';

  const directorCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.director) {
      directorCounts[r.director] = (directorCounts[r.director] || 0) + 1;
    }
  }
  const topDirector = Object.entries(directorCounts).sort((a, b) => b[1] - a[1])[0];
  const topFilm = [...rows].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))[0];

  return [
    `Dataset Summary (${title}) — ${rows.length} active records spanning ${minYear} to ${maxYear}.`,
    `Average Audience Rating: ${avgRating} / 5.0 across ${ratings.length} scored entries.`,
    topFilm ? `Highest Rated Title: "${topFilm.title}" (${topFilm.year}) at ${topFilm.rating}/5.0.` : '',
    topDirector ? `Most Represented Director: ${topDirector[0]} (${topDirector[1]} titles).` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

type ConfigTab = 'core' | 'ai' | 'views' | 'layout';

const CAPABILITIES = [
  { icon: Sparkles, title: 'Universal LLM Ready', desc: 'Connect OpenAI, Anthropic, Gemini, Ollama, OpenRouter, or custom endpoints with zero-dependency local analytical fallback.' },
  { icon: TrendingUp, title: 'External Table Summary', desc: 'Sync live totals, numeric aggregates, and executive summaries outside the table via TableSummary or onSummaryChange.' },
  { icon: Sliders, title: 'Quick Filters & Bulk Actions', desc: 'Filter datasets with one-click segmented predicates and run multi-row batch actions with confirmation.' },
  { icon: Edit3, title: 'Inline Cell Editing', desc: 'Edit text, numbers, dates, checkboxes, dropdowns, or custom star ratings with validation and audit logging.' },
  { icon: Terminal, title: 'Command Palette (Ctrl+K)', desc: 'Jump across views, toggle density, select rows, export CSV/JSON, or switch fullscreen from the keyboard.' },
  { icon: ArrowUpDown, title: 'Multi-Sort & Column Aggregations', desc: 'Hold Shift/Cmd to sort multiple columns and compute sum, avg, min, max, count, or unique values in footers.' },
  { icon: MessageSquare, title: 'Row Comments & Mentions', desc: 'Attach threaded row comments and team mentions with instant local persistence and optional backend sync.' },
  { icon: History, title: 'Audit Trail & Time Travel', desc: 'Track inline edits chronologically and step backward or forward across layout and filter snapshots.' },
  { icon: Share2, title: 'Saved & Shareable Views', desc: 'Save named view presets and copy shareable state URLs capturing columns, sorts, and density.' },
  { icon: MapPin, title: 'Native Map & Calendar Views', desc: 'Switch seamlessly between Table, Kanban, Gallery, geospatial Map, and Month/Week/Agenda Calendar modes.' },
  { icon: Bookmark, title: 'Bookmarks & Side Preview', desc: 'Star priority rows, inspect full row details in a slide-over drawer, or right-click for contextual actions.' },
  { icon: ShieldCheck, title: 'Zero-Dependency & Accessible', desc: 'Requires only React and ReactDOM >=18 with built-in SVG icons, keyboard grid navigation, and WCAG AA contrast.' },
];

export default function Home() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<ConfigTab>('core');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [viewedMovieNotice, setViewedMovieNotice] = useState<string | null>(null);

  // Layout & Appearance states surfaced in Theme & Layout tab
  const [titleText, setTitleText] = useState('Movie Catalog');
  const [selectedTheme, setSelectedTheme] = useState<'default' | 'dark' | 'enterprisegrid-brand'>('default');
  const [dense, setDense] = useState(false);
  const [striped, setStriped] = useState(false);
  const [fixedHeader, setFixedHeader] = useState(false);
  const [hasDonated, setHasDonated] = useState<boolean>(() => isEnterpriseGridDonated());
  const [configProNotice, setConfigProNotice] = useState<string | null>(null);

  const tableRef = useRef<DataTableHandle>(null);
  const [localData, setLocalData] = useState(initialData);
  const [currentSelectedRows, setCurrentSelectedRows] = useState<any[]>([]);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insightsText, setInsightsText] = useState<string | null>(null);

  useEffect(() => {
    const handleDonationChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      const donated = Boolean(customEvent.detail);
      setHasDonated(donated);
      if (donated) {
        setConfigProNotice(null);
      }
    };
    window.addEventListener('eg-donation-changed', handleDonationChange as EventListener);
    return () => window.removeEventListener('eg-donation-changed', handleDonationChange as EventListener);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadServerData = async () => {
      try {
        const res = await fetch('/api/movies?page=1&limit=100', {
          headers: { Accept: 'application/json' },
        });
        const ct = res.headers?.get?.('content-type') || '';
        if (res.ok && ct.toLowerCase().includes('application/json') && isMounted) {
          const result = await res.json();
          if (Array.isArray(result.data) && result.data.length > 0) {
            setLocalData(result.data);
          }
        }
      } catch {
        // Fallback silently to local initialData
      }
    };
    loadServerData();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeData = useMemo(() => {
    if (config.simulateEmptyData) return [];
    return localData;
  }, [config.simulateEmptyData, localData]);

  const generateInsights = async () => {
    setIsGeneratingInsights(true);
    setInsightsText(null);
    const dataToAnalyze = currentSelectedRows.length > 0 ? currentSelectedRows : activeData;
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          data: dataToAnalyze,
          title: titleText || 'Grid Data',
        }),
      });
      const ct = response.headers?.get?.('content-type') || '';
      if (response.ok && ct.toLowerCase().includes('application/json')) {
        const result = await response.json();
        if (result?.insights) {
          setInsightsText(result.insights);
          return;
        }
      }
      setInsightsText(computeLocalInsights(dataToAnalyze, titleText || 'Movie Catalog'));
    } catch {
      setInsightsText(computeLocalInsights(dataToAnalyze, titleText || 'Movie Catalog'));
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const customColumns = useMemo(() => {
    return [
      {
        name: 'Title',
        selector: (row: any) => row.title,
        cell: (row: any) => <strong className="text-indigo-600 font-semibold">{row.title}</strong>,
        sortable: true,
        id: 'title',
        filterable: true,
        filterType: 'text' as const,
        width: '26%',
        editable: true,
        validate: (value: string) => (value.trim() ? true : 'Title is required'),
      },
      {
        name: 'Director',
        selector: (row: any) => row.director,
        sortable: true,
        id: 'director',
        filterable: true,
        filterType: 'text' as const,
      },
      {
        name: 'Year',
        selector: (row: any) => row.year,
        sortable: true,
        id: 'year',
        right: true,
        filterable: true,
        filterType: 'number' as const,
        aggregation: 'avg' as const,
        aggregationLabel: 'Avg',
        editor: { type: 'number' as const },
        validate: (value: string) => {
          const num = parseInt(value, 10);
          return num > 1800 && num <= new Date().getFullYear() ? true : 'Invalid year';
        },
      },
      {
        name: 'Genre',
        selector: (row: any) => row.genre || 'Action',
        id: 'genre',
        width: '110px',
        editor: {
          type: 'select' as const,
          options: [
            { value: 'Action', label: 'Action' },
            { value: 'Comedy', label: 'Comedy' },
            { value: 'Drama', label: 'Drama' },
            { value: 'Sci-Fi', label: 'Sci-Fi' },
          ],
        },
      },
      {
        name: 'Rating',
        selector: (row: any) => row.rating || 4.5,
        id: 'rating',
        width: '100px',
        center: true,
        aggregation: 'avg' as const,
        aggregationLabel: 'Avg',
        heatmap: config.heatmapCells,
        heatmapConfig: {
          colorScale: 'purples' as const,
          min: 3.5,
          max: 5.0,
        },
      },
      {
        name: 'Trend',
        id: 'trend',
        selector: (row: any) => row.trend || [50, 50, 50],
        sparkline: true,
        sparklineConfig: {
          type: 'area' as const,
          strokeColor: '#4f46e5',
          fillColor: 'rgba(79, 70, 229, 0.1)',
          height: 28,
          highlightMin: true,
          highlightMax: true,
          highlightLast: true,
          interactive: true,
        },
        width: '120px',
      },
      {
        name: 'Action',
        id: 'action',
        selector: () => 'View',
        button: true,
        ignoreRowClick: true,
        cell: (row: any) => (
          <button
            type="button"
            onClick={() => {
              setViewedMovieNotice(`Viewing "${row.title}" (${row.year}) — Directed by ${row.director}`);
              setTimeout(() => setViewedMovieNotice(null), 3500);
            }}
            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-md transition-colors"
          >
            Details
          </button>
        ),
        width: '90px',
        center: true,
      },
    ];
  }, [config.heatmapCells]);

  const copyInstall = async () => {
    try {
      await navigator.clipboard?.writeText('npm install @enterprisegrid/grid');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const toggleConfigKey = (key: keyof typeof DEFAULT_CONFIG, label?: string, isPro?: boolean) => {
    setConfig((prev) => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key],
    }));
    if (isPro && !hasDonated) {
      setConfigProNotice(label || String(key));
    }
  };

  const resetAllConfig = () => {
    setConfig(DEFAULT_CONFIG);
    setSelectedTheme('default');
    setDense(false);
    setStriped(false);
    setFixedHeader(false);
    setTitleText('Movie Catalog');
  };

  const tabItems: Record<ConfigTab, { key: keyof typeof DEFAULT_CONFIG; label: string; isPro?: boolean }[]> = {
    core: [
      { key: 'pagination', label: 'Pagination' },
      { key: 'selectableRows', label: 'Row Selection' },
      { key: 'expandableRows', label: 'Expandable Rows' },
      { key: 'sortable', label: 'Multi-Column Sort' },
      { key: 'searchable', label: 'Global Search' },
      { key: 'exportable', label: 'CSV / JSON Export' },
      { key: 'densityToggle', label: 'Density Switcher' },
      { key: 'columnVisibility', label: 'Column Visibility', isPro: true },
    ],
    ai: [
      { key: 'externalSummary', label: 'External Table Summary', isPro: true },
      { key: 'enableAiQuery', label: 'AI Natural Query', isPro: true },
      { key: 'enableAiInsights', label: 'AI Insights Dashboard', isPro: true },
      { key: 'enableAiSummary', label: 'AI Executive Summary', isPro: true },
      { key: 'heatmapCells', label: 'Heatmap Cells', isPro: true },
      { key: 'commandPalette', label: 'Command Palette (Ctrl+K)', isPro: true },
    ],
    views: [
      { key: 'mapView', label: 'Map View', isPro: true },
      { key: 'calendarView', label: 'Calendar View', isPro: true },
      { key: 'savedViews', label: 'Saved Views', isPro: true },
      { key: 'shareableViews', label: 'Shareable Views', isPro: true },
      { key: 'auditTrail', label: 'Audit Trail', isPro: true },
      { key: 'timeTravel', label: 'Time Travel', isPro: true },
      { key: 'rowComments', label: 'Row Comments', isPro: true },
      { key: 'bookmarks', label: 'Bookmarks', isPro: true },
    ],
    layout: [
      { key: 'progressPending', label: 'Simulate Loading' },
      { key: 'customProgressComponent', label: 'Custom Loader UI' },
      { key: 'simulateEmptyData', label: 'Simulate Empty Data' },
      { key: 'customNoDataComponent', label: 'Custom Empty UI' },
    ],
  };

  const generatedSnippet = `import { useState } from 'react';
import { DataTable, TableSummary } from '@enterprisegrid/grid';
import '@enterprisegrid/grid/dist/enterprisegrid.css';

export function MyGrid({ columns, data }) {
  const [summaryData, setSummaryData] = useState(null);

  return (
    <div className="space-y-4">${
      config.externalSummary
        ? `\n      <TableSummary summaryData={summaryData} title="External Table Summary" />`
        : ''
    }
      <DataTable
        title="${titleText}"
        columns={columns}
        data={data}${config.externalSummary ? `\n        onSummaryChange={setSummaryData}` : ''}${
          selectedTheme !== 'default' ? `\n        theme="${selectedTheme}"` : ''
        }${dense ? '\n        dense' : ''}${striped ? '\n        striped' : ''}${
          fixedHeader ? '\n        fixedHeader\n        fixedHeaderScrollHeight="320px"' : ''
        }${config.pagination ? '\n        pagination' : ''}${
          config.selectableRows ? '\n        selectableRows' : ''
        }${config.expandableRows ? '\n        expandableRows' : ''}${
          config.sortable ? '\n        sortable' : ''
        }${config.searchable ? '\n        searchable' : ''}${
          config.exportable ? '\n        exportable' : ''
        }${config.enableAiQuery ? '\n        enableAiQuery' : ''}${
          config.enableAiInsights ? '\n        enableAiInsights' : ''
        }${config.enableAiSummary ? '\n        enableAiSummary' : ''}${
          config.progressPending ? '\n        progressPending' : ''
        }
        llmConfig={{ provider: 'gemini', model: 'gemini-3.8-flash', fallbackToLocal: true }}
      />
    </div>
  );
}`;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden w-full bg-white">
      <SEO
        title="EnterpriseGrid - The AI-Powered React Data Table"
        description="EnterpriseGrid - Zero-dependency, AI-native interactive data grid for React applications. Includes external TableSummary, universal LLM integration, bulk actions, inline editing, and multi-view modes."
        url="https://enterprisegrid.io/"
        keywords="React data grid, React data table, AI data insights, React 18 table, TableSummary, Universal LLM"
      />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-20 sm:pb-24 border-b border-slate-200 overflow-hidden flex-shrink-0 bg-gradient-to-b from-slate-50/70 to-white">
        <div className="container mx-auto px-4 sm:px-8 max-w-5xl relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-600 mb-6"
          >
            <span>AI-Native React Data Grid</span>
            <span aria-hidden="true">·</span>
            <span>Zero External Dependencies</span>
            <span aria-hidden="true">·</span>
            <Link
              to="/docs#enterprise-productivity"
              className="inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Explore v3.0.0 suite <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold text-slate-900 mb-6 max-w-4xl mx-auto"
          >
            The AI-Powered <span className="text-indigo-600">Interactive Data Grid</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="text-base sm:text-lg text-slate-600 max-w-[64ch] mx-auto leading-[1.75] mb-8"
          >
            Built for high-density React workflows. Sorting, column aggregations, inline editing, external table summaries, and universal LLM integration work out of the box with only React and ReactDOM.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
          >
            <Link
              to="/docs"
              className="h-11 px-6 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center hover:bg-indigo-700 transition-colors w-full sm:w-auto whitespace-nowrap shrink-0"
            >
              Read Documentation
            </Link>
            <Link
              to="/api"
              className="h-11 px-6 rounded-xl bg-white text-slate-800 border border-slate-200 text-sm font-semibold flex items-center justify-center hover:bg-slate-50 transition-colors w-full sm:w-auto whitespace-nowrap shrink-0"
            >
              Browse API Reference
            </Link>
          </motion.div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={copyInstall}
              className="group flex items-center justify-between bg-slate-900 text-slate-100 rounded-xl px-4 py-2.5 w-full max-w-md cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <span className="font-mono text-sm flex items-center gap-2 truncate">
                <span className="text-slate-400 select-none">$</span>
                <span>npm install @enterprisegrid/grid</span>
              </span>
              <span className="ml-3 flex items-center gap-1.5 text-xs font-medium text-slate-300 shrink-0">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <Copy className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                )}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Configurator + Code Preview */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-8 max-w-7xl">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-3">
              Interactive Grid Configurator
            </h2>
            <p className="text-[15.5px] text-slate-600 leading-[1.75] max-w-[75ch]">
              Toggle capabilities below to inspect generated React code and test every feature immediately on the live grid. Click any Title, Year, or Genre cell to edit inline.
            </p>
          </div>

          {/* Full-Width Live Feature Controls */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-display font-bold text-slate-900">
                  Live Feature Controls
                </h3>
                {/* Category Tabs */}
                <div className="flex flex-wrap gap-1 bg-white p-1 rounded-lg border border-slate-200">
                  {(
                    [
                      { id: 'core', label: 'Core & UX' },
                      { id: 'ai', label: 'AI & Summary' },
                      { id: 'views', label: 'Views & Collab' },
                      { id: 'layout', label: 'Theme & State' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={resetAllConfig}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            </div>

            {/* Toggle Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {tabItems[activeTab].map((item) => {
                const active = Boolean(config[item.key]);
                return (
                  <label
                    key={item.key}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      active
                        ? 'bg-white border-indigo-200 text-slate-900 shadow-2xs'
                        : 'bg-slate-100/60 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleConfigKey(item.key, item.label, item.isPro)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.isPro && !hasDonated && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-extrabold uppercase tracking-wider leading-none shrink-0">
                        PRO
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {!hasDonated && configProNotice && (
              <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-extrabold uppercase tracking-wider">
                    PRO
                  </span>
                  <span>
                    <strong>{configProNotice}</strong> is unlocked and active! Support EnterpriseGrid with a one-time donation to remove all PRO badges and notifications.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('eg-open-donate-modal'))}
                    className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-bold transition-colors cursor-pointer"
                  >
                    Donate &amp; Remove Badges
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnterpriseGridDonated(true)}
                    className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold transition-colors cursor-pointer"
                  >
                    I Already Donated
                  </button>
                </div>
              </div>
            )}

            {/* Extra Theme & Layout Controls on Layout tab */}
            {activeTab === 'layout' && (
              <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-end gap-6">
                <div className="w-48">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Theme
                  </label>
                  <select
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="default">Default Light</option>
                    <option value="dark">Dark Mode</option>
                    <option value="enterprisegrid-brand">Brand Indigo</option>
                  </select>
                </div>
                <div className="w-56">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Grid Title
                  </label>
                  <input
                    type="text"
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-wrap gap-4 pb-1.5 text-xs font-medium text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dense}
                      onChange={(e) => setDense(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Dense Rows</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={striped}
                      onChange={(e) => setStriped(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Striped</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fixedHeader}
                      onChange={(e) => setFixedHeader(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Fixed Header</span>
                  </label>
                </div>
              </div>
            )}

            <p className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
              Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono">Ctrl+K</kbd> inside the table to open the Command Palette, or right-click any row for actions.
            </p>
          </div>

          {/* Live Interactive Preview */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-3 sm:p-5 space-y-4 mb-8">
            {viewedMovieNotice && (
              <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
                <span>{viewedMovieNotice}</span>
                <button
                  type="button"
                  onClick={() => setViewedMovieNotice(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
                >
                  Dismiss
                </button>
              </div>
            )}

            {insightsText && (
              <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-xl relative">
                <button
                  type="button"
                  onClick={() => setInsightsText(null)}
                  aria-label="Close insights"
                  className="absolute top-3 right-3 text-xs font-semibold text-indigo-600 hover:text-indigo-900"
                >
                  Close
                </button>
                <h4 className="text-indigo-900 font-display font-bold text-sm flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-indigo-600" />
                  <span>Dataset Insights</span>
                </h4>
                <div className="text-sm text-indigo-950/85 leading-[1.7] whitespace-pre-wrap">
                  {insightsText}
                </div>
              </div>
            )}

            <EnterpriseGridDemo
              id="demo-table-main"
              ref={tableRef}
              title={titleText}
              data={activeData}
              columns={customColumns}
              keyField={config.keyField}
              theme={selectedTheme}
              dense={dense}
              striped={striped}
              fixedHeader={fixedHeader}
              fixedHeaderScrollHeight={fixedHeader ? '320px' : undefined}
              externalSummary={config.externalSummary ? 'top' : false}
              externalSummaryTitle="External Table Summary (Live Synced Outside Table)"
              enableAiQuery={config.enableAiQuery}
              enableAiInsights={config.enableAiInsights}
              enableAiSummary={config.enableAiSummary}
              llmConfig={{
                provider: 'gemini',
                model: 'gemini-3.8-flash',
                fallbackToLocal: true,
              }}
              selectableRows={config.selectableRows}
              selectableRowsComponent={CustomCheckbox}
              onSelectedRowsChange={({ selectedRows }) => setCurrentSelectedRows(selectedRows)}
              expandableRows={config.expandableRows}
              expandableRowsComponent={ExpandedMovieComponent}
              expandOnRowClicked
              pagination={config.pagination}
              paginationPerPage={5}
              paginationRowsPerPageOptions={[5, 10, 15]}
              progressPending={config.progressPending}
              progressComponent={config.customProgressComponent ? <CustomLoader /> : undefined}
              noDataComponent={config.customNoDataComponent ? <CustomEmptyState /> : undefined}
              config={config}
              resizable
              fullscreenToggle
              enableKeyboardNavigation
              enableContextMenu
              mapConfig={{ latField: 'lat', lngField: 'lng', titleField: 'title' }}
              calendarConfig={{ dateField: 'date', titleField: 'title' }}
              quickFilters={[
                { id: 'nolan', label: 'Christopher Nolan', predicate: (r: any) => r.director === 'Christopher Nolan' },
                { id: '90s', label: '1990s Classics', predicate: (r: any) => Number(r.year) >= 1990 && Number(r.year) < 2000 },
                { id: 'top', label: 'Rated 4.8+', predicate: (r: any) => Number(r.rating) >= 4.8 },
              ]}
              onCellEdit={(row, value, column) => {
                setLocalData((prev) =>
                  prev.map((item) =>
                    item.id === row.id ? { ...item, [column.id as string]: value } : item
                  )
                );
              }}
              actions={
                <button
                  type="button"
                  onClick={generateInsights}
                  disabled={isGeneratingInsights}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isGeneratingInsights ? 'Analyzing...' : 'Analyze Selection'}</span>
                </button>
              }
            />
          </div>

          {/* Generated React Code Snippet */}
          <LiveCodeEditor language="tsx" title="MyGrid.tsx">
            {generatedSnippet}
          </LiveCodeEditor>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-4 sm:px-8 max-w-7xl">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl font-display font-bold mb-3 text-slate-900">
              Built for Production Data Workflows
            </h2>
            <p className="text-[15.5px] text-slate-600 leading-[1.75]">
              Every capability works out of the box with zero optional dependency traps, consistent keyboard ergonomics, and clean TypeScript ergonomics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                    <Icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h3 className="text-base font-display font-bold mb-2 text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-[1.7]">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
