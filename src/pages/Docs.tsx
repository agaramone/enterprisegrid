import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search as SearchIcon,
  Check,
  Copy,
  Terminal,
  Layers,
  X,
  ArrowUp,
  Link as LinkIcon,
} from 'lucide-react';
import { SEO } from '../components/SEO';
import Footer from '../components/Footer';
import LiveCodeEditor from '../components/LiveCodeEditor';
import { DataTable } from '@enterprisegrid/grid';
import {
  FullFeaturedEnterprisePlayground,
  ExternalSummaryPlayground,
  UniversalLlmPlayground,
  FeaturesConfigPlayground,
  LayoutAppearancePlayground,
  ThemingStylingPlayground,
  AdvancedSortingPlayground,
  AdvancedPaginationPlayground,
  AdvancedFooterPlayground,
  AdvancedRowSelectionPlayground,
  AdvancedExpandableRowsPlayground,
  AdvancedRowEventsPlayground,
  ColumnFeaturesPlayground,
  LocalizationPlayground,
  AiAnalyticsPlayground,
  CellEditingPlayground,
  AiQueryAssistantPlayground,
  AiSmartSummaryPlayground,
  AiInsightsDashboardPlayground,
  MapViewPlayground,
  CalendarViewPlayground,
  SavedViewsPlayground,
  ShareableViewsPlayground,
  AuditTrailPlayground,
  TimeTravelPlayground,
  RowCommentsPlayground,
  SparklinePlayground,
  HeatmapPlayground,
  BookmarksPlayground,
  CommandPalettePlayground,
  SidePreviewPlayground,
  PluginSystemPlayground,
  MobileSwipeActionsPlayground,
  ThemeBuilderPlayground,
  OfflineSyncPlayground,
  MultiViewPlayground,
} from '../components/playgrounds';

const mockData = [
  { id: 1, title: 'Beetlejuice', year: '1988', director: 'Tim Burton' },
  { id: 2, title: 'Ghostbusters', year: '1984', director: 'Ivan Reitman' },
  { id: 3, title: 'The Matrix', year: '1999', director: 'Lana Wachowski' },
  { id: 4, title: 'Inception', year: '2010', director: 'Christopher Nolan' },
  { id: 5, title: 'Interstellar', year: '2014', director: 'Christopher Nolan' },
  { id: 6, title: 'The Dark Knight', year: '2008', director: 'Christopher Nolan' },
  { id: 7, title: 'Pulp Fiction', year: '1994', director: 'Quentin Tarantino' },
  { id: 8, title: 'Fight Club', year: '1999', director: 'David Fincher' },
  { id: 9, title: 'Forrest Gump', year: '1994', director: 'Robert Zemeckis' },
  { id: 10, title: 'The Shawshank Redemption', year: '1994', director: 'Frank Darabont' },
];

const mockColumns = [
  { name: 'Title', selector: (row: any) => row.title, sortable: true, id: 'title' },
  { name: 'Director', selector: (row: any) => row.director, sortable: true, id: 'director' },
  { name: 'Year', selector: (row: any) => row.year, sortable: true, id: 'year' },
];

interface NavGroup {
  group: string;
  items: { href: string; label: string }[];
}

const DOC_NAV_GROUPS: NavGroup[] = [
  {
    group: 'Getting Started',
    items: [
      { href: '#download-package', label: 'NPM Tarball & Archive' },
      { href: '#installation-architecture', label: 'Installation & Zero-Dependency' },
      { href: '#enterprise-productivity', label: 'Enterprise Productivity Suite' },
      { href: '#external-summary-guide', label: 'External Table Summary' },
      { href: '#universal-llm-guide', label: 'Universal LLM Integration' },
    ],
  },
  {
    group: 'AI & Advanced',
    items: [
      { href: '#ai-analytics', label: 'AI-Driven Analytics' },
      { href: '#ai-query-assistant', label: 'AI Query Assistant' },
      { href: '#ai-smart-summary', label: 'AI Smart Summary' },
      { href: '#ai-insights-dashboard', label: 'AI Insights Dashboard' },
    ],
  },
  {
    group: 'Data Views',
    items: [
      { href: '#multi-view', label: 'Multi-View (Kanban, Gallery)' },
      { href: '#map-view', label: 'Map View' },
      { href: '#calendar-view', label: 'Calendar View' },
      { href: '#saved-views', label: 'Saved Views' },
      { href: '#shareable-views', label: 'Shareable Views' },
      { href: '#sparklines', label: 'Sparkline Charts' },
      { href: '#heatmap-cells', label: 'Heatmap Cells' },
    ],
  },
  {
    group: 'Collaboration & Tracking',
    items: [
      { href: '#audit-trail', label: 'Audit Trail' },
      { href: '#time-travel', label: 'Time Travel' },
      { href: '#row-comments', label: 'Row Comments' },
      { href: '#favorites-bookmarks', label: 'Favorites & Bookmarks' },
      { href: '#offline-sync', label: 'Offline Editing & Sync' },
    ],
  },
  {
    group: 'Interactive Elements',
    items: [
      { href: '#command-palette-section', label: 'Command Palette' },
      { href: '#side-preview-section', label: 'Side Preview Panel' },
      { href: '#plugin-system-section', label: 'Plugin System' },
      { href: '#mobile-swipe-actions-section', label: 'Mobile Swipe Actions' },
      { href: '#theme-builder-section', label: 'Theme Builder' },
    ],
  },
  {
    group: 'Core Features',
    items: [
      { href: '#basic-usage', label: 'Basic Usage' },
      { href: '#pagination', label: 'Pagination' },
      { href: '#pagination-server', label: 'Server-Side Data' },
      { href: '#sorting', label: 'Sorting' },
      { href: '#multi-sorting', label: 'Multi-Sorting' },
      { href: '#custom-cells', label: 'Custom Cells' },
      { href: '#filtering', label: 'Column Filtering' },
      { href: '#resizing', label: 'Column Resizing' },
      { href: '#editing', label: 'Inline Editing' },
      { href: '#virtualization-csv', label: 'Virtualization & CSV Import' },
      { href: '#selection', label: 'Row Selection' },
      { href: '#expandable', label: 'Expandable Rows' },
      { href: '#row-events', label: 'Row Events' },
      { href: '#column-groups', label: 'Column Groups' },
    ],
  },
  {
    group: 'UI & Styling',
    items: [
      { href: '#toolbar', label: 'Toolbar Configuration' },
      { href: '#loading', label: 'Progress Pending' },
      { href: '#styling', label: 'Styling & Interaction' },
      { href: '#separators', label: 'Separators' },
      { href: '#title-subheader', label: 'Title & Actions' },
      { href: '#empty-state', label: 'Empty States' },
      { href: '#disabled-state', label: 'Disabled State' },
      { href: '#conditional-styles', label: 'Conditional Row Styles' },
      { href: '#conditional-cell-styles', label: 'Conditional Cell Styles' },
      { href: '#table-footers', label: 'Table Footers' },
      { href: '#fixed-header', label: 'Fixed Header & Scrolling' },
      { href: '#no-table-head', label: 'Hide Table Head' },
      { href: '#responsive-layout', label: 'Responsive & Mobile Cards' },
      { href: '#responsive-columns', label: 'Responsive Columns' },
      { href: '#column-sizing', label: 'Column Sizing & Alignment' },
      { href: '#column-formatting', label: 'Column Formatting' },
      { href: '#rtl-support', label: 'RTL Support' },
      { href: '#localization', label: 'Localization' },
      { href: '#custom-styles', label: 'Custom Styles' },
      { href: '#themes', label: 'Theming' },
    ],
  },
];

function DocSection({
  id,
  title,
  description,
  code,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  code: string;
  children: React.ReactNode;
}) {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#${id}`;
      await navigator.clipboard?.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <section id={id} className="mb-16 scroll-mt-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-2xl font-display font-bold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={handleCopyLink}
          aria-label={`Copy link to ${title}`}
          title="Copy section link"
          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
        >
          {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <LinkIcon className="w-4 h-4" />}
        </button>
      </div>
      <div className="text-[15.5px] text-slate-600 mb-6 leading-[1.75] max-w-[72ch]">{description}</div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
          Preview
        </div>
        <div className="p-4 overflow-x-auto">{children}</div>
      </div>

      <LiveCodeEditor language="jsx" title={`${id || 'snippet'}.tsx`}>
        {code}
      </LiveCodeEditor>
    </section>
  );
}

export default function Docs() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string>('download-package');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [responsivePreviewWidth, setResponsivePreviewWidth] = useState<'360px' | '580px' | '100%'>('360px');
  const [responsiveLayoutMode, setResponsiveLayoutMode] = useState<'auto' | 'cards' | 'scroll'>('auto');
  const [virtualRows, setVirtualRows] = useState(() =>
    Array.from({ length: 500 }, (_, i) => ({
      id: i + 1,
      title: `${mockData[i % mockData.length].title} #${i + 1}`,
      director: mockData[i % mockData.length].director,
      year: String(1980 + (i % 45)),
    }))
  );

  const contentScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleToggle = () => {
      setSidebarOpen((prev) => !prev);
    };
    window.addEventListener('toggle-docs-sidebar', handleToggle);
    return () => {
      window.removeEventListener('toggle-docs-sidebar', handleToggle);
    };
  }, []);

  useEffect(() => {
    const event = new CustomEvent('docs-sidebar-state', { detail: sidebarOpen });
    window.dispatchEvent(event);
  }, [sidebarOpen]);

  // Press '/' to jump to documentation sidebar search
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
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Scroll to initial hash if present
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveId(hash);
        }
      }, 120);
    }
  }, []);

  // ScrollSpy for documentation sections
  useEffect(() => {
    const container = contentScrollRef.current;
    const sectionIds = DOC_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href.slice(1)));

    const handleScroll = () => {
      const scrollTop =
        window.scrollY ||
        document.documentElement.scrollTop ||
        (container ? container.scrollTop : 0);
      setShowBackToTop(scrollTop > 480);
      let current = sectionIds[0];

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= 160) {
          current = id;
        }
      }
      setActiveId(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    container?.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      container?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard fallback
    }
  };

  const navigateToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.replace(/^#/, '');
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', href);
      setActiveId(id);
    }
    setSidebarOpen(false);
  };

  const filteredNavGroups = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return DOC_NAV_GROUPS;
    return DOC_NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || g.group.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [sidebarSearch]);

  const totalGuides = DOC_NAV_GROUPS.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-white relative">
      <SEO
        title="Documentation"
        description="Complete documentation for @enterprisegrid/grid: zero-dependency installation, enterprise productivity workflows, external TableSummary, Universal LLM integration, and interactive playgrounds."
        url="https://enterprisegrid.io/docs"
        keywords="EnterpriseGrid Docs, React Data Grid documentation, React table tutorial, Universal LLM DataTable, TableSummary, bulk actions, keyboard navigation"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: 'EnterpriseGrid Documentation',
          description:
            'Explore the full capabilities of EnterpriseGrid with interactive playgrounds and production TypeScript snippets.',
          audience: {
            '@type': 'Audience',
            audienceType: 'Developers',
          },
          about: {
            '@type': 'SoftwareApplication',
            name: 'EnterpriseGrid',
            applicationCategory: 'DeveloperApplication',
          },
        }}
      />

      {sidebarOpen && (
        <div
          className="fixed top-16 inset-x-0 bottom-0 bg-slate-900/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 relative">
        <aside
          aria-label="Documentation sections"
          className={`
          fixed md:sticky top-16 bottom-0 left-0 z-40
          w-72 bg-slate-50/90 border-r border-slate-200 px-5 py-5 flex flex-col gap-5 overflow-y-auto
          transform transition-transform duration-200 ease-out h-[calc(100vh-4rem)] shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        >
        <div className="sticky top-0 bg-slate-50/95 backdrop-blur-xs pt-0.5 pb-3 z-10 border-b border-slate-200/80">
          <div className="relative flex items-center">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Filter guides (press /)"
              aria-label="Filter documentation guides"
              className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
            {sidebarSearch && (
              <button
                type="button"
                onClick={() => setSidebarSearch('')}
                aria-label="Clear filter"
                className="absolute right-2 p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
            <span>{totalGuides} interactive guides</span>
            <span>@enterprisegrid/grid</span>
          </div>
        </div>

        <nav className="space-y-6 pb-8">
          {filteredNavGroups.length === 0 ? (
            <div className="text-center py-6 px-3 bg-white border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-600 mb-2">
                No guides matched "{sidebarSearch}".
              </p>
              <button
                type="button"
                onClick={() => setSidebarSearch('')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Reset filter
              </button>
            </div>
          ) : (
            filteredNavGroups.map((group) => (
              <div key={group.group}>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-2">
                  {group.group}
                </h3>
                <ul className="space-y-1 text-[13.5px]">
                  {group.items.map((item) => {
                    const id = item.href.slice(1);
                    const isActive = activeId === id;
                    return (
                      <li key={item.href}>
                        <a
                          href={item.href}
                          onClick={(e) => navigateToSection(e, item.href)}
                          aria-current={isActive ? 'location' : undefined}
                          className={`block px-2.5 py-1.5 rounded-lg leading-snug transition-colors ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 font-semibold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                          }`}
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>
        </aside>

        <div ref={contentScrollRef} className="flex-1 flex flex-col px-4 py-8 sm:px-10 sm:py-10 min-w-0 relative">
          <div className="max-w-6xl mx-auto w-full">
          <div className="mb-12 border-b border-slate-200 pb-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 mb-3">
              <span className="font-mono text-indigo-600 font-semibold">@enterprisegrid/grid</span>
              <span aria-hidden="true">·</span>
              <span>v3.0.0</span>
              <span aria-hidden="true">·</span>
              <span>MIT License</span>
              <span aria-hidden="true">·</span>
              <span>React 18+</span>
              <span aria-hidden="true">·</span>
              <span>Zero External Runtime Dependencies</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-4">
              EnterpriseGrid Documentation
            </h1>
            <p className="text-base sm:text-[17px] text-slate-600 max-w-[68ch] leading-[1.75]">
              Interactive guides, production patterns, and copy-ready TypeScript examples for building zero-dependency, AI-native React data grids.
            </p>
          </div>

          {/* NPM Package Download Panel */}
          <section
            id="download-package"
            className="mb-14 bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 scroll-mt-8"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-emerald-700">
                  Compiled NPM Distribution Bundle · v3.0.0 · MIT License
                </div>
                <h2 className="text-2xl font-display font-bold text-slate-900">
                  Download Local Package Archive
                </h2>
                <p className="text-[15px] text-slate-600 leading-[1.75] max-w-[72ch]">
                  Includes ESM (<code>dist/enterprisegrid.mjs</code>), CommonJS (<code>dist/enterprisegrid.cjs</code>), bundled CSS (<code>dist/enterprisegrid.css</code>), animated README preview (<code>assets/table-preview.gif</code>), <code>LICENSE</code> (MIT), and full TypeScript definitions (<code>dist/index.d.ts</code>).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="/enterprisegrid-grid-3.0.0.zip"
                  download
                  className="h-11 px-5 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
                  id="docs-download-zip-btn"
                >
                  <span>Download .zip (v3.0.0)</span>
                </a>
                <a
                  href="/enterprisegrid-grid-3.0.0.tgz"
                  download
                  className="h-11 px-5 rounded-xl bg-white text-slate-700 border border-slate-200 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                  id="docs-download-tarball-btn"
                >
                  <span>Download .tgz (v3.0.0)</span>
                </a>
                <a
                  href="https://github.com/agaramone/enterprisegrid.git"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-5 rounded-xl bg-white text-slate-700 border border-slate-200 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                  id="docs-repo-btn"
                >
                  <span>Git Repository</span>
                </a>
                <a
                  href="https://github.com/sponsors/agaramone"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0"
                  id="docs-sponsor-btn"
                >
                  <span>Sponsor Project ♥</span>
                </a>
              </div>
            </div>

            <div className="mt-6 rounded-xl overflow-hidden border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center justify-between">
                <span>Package README Animated Preview (assets/table-preview.gif)</span>
                <span className="font-mono text-[11px] text-indigo-600">v3.0.0</span>
              </div>
              <img
                src="/table-preview.gif"
                alt="EnterpriseGrid v3.0.0 Animated DataTable Preview"
                className="w-full max-w-3xl rounded-lg border border-slate-200"
                loading="lazy"
              />
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Option A: Install Locally
                </h4>
                <div className="bg-slate-950 text-indigo-200 px-3.5 py-2.5 rounded-xl font-mono text-xs flex items-center justify-between gap-4 border border-slate-900">
                  <span className="overflow-x-auto whitespace-nowrap scrollbar-none">
                    npm install ./enterprisegrid-grid-3.0.0.tgz
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy('install-tgz', 'npm install ./enterprisegrid-grid-3.0.0.tgz')
                    }
                    className="px-2.5 py-1 rounded-lg border bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 text-[11px] font-semibold shrink-0 flex items-center gap-1"
                  >
                    {copiedId === 'install-tgz' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'install-tgz' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Option B: Publish to Registry
                </h4>
                <div className="bg-slate-950 text-emerald-300 px-3.5 py-2.5 rounded-xl font-mono text-xs flex items-center justify-between gap-4 border border-slate-900">
                  <span className="overflow-x-auto whitespace-nowrap scrollbar-none">
                    npm publish ./enterprisegrid-grid-3.0.0.tgz --access public
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        'publish-tgz',
                        'npm publish ./enterprisegrid-grid-3.0.0.tgz --access public'
                      )
                    }
                    className="px-2.5 py-1 rounded-lg border bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 text-[11px] font-semibold shrink-0 flex items-center gap-1"
                  >
                    {copiedId === 'publish-tgz' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === 'publish-tgz' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Installation & Zero-Dependency Architecture Guide */}
          <section id="installation-architecture" className="mb-16 scroll-mt-8">
            <h2 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2.5 mb-3">
              <Terminal className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>Installation & Zero-Dependency Resilience</span>
            </h2>
            <p className="text-[15.5px] text-slate-600 leading-[1.75] mb-6 max-w-[72ch]">
              <code>@enterprisegrid/grid</code> requires only <code>react</code> and <code>react-dom</code> (&gt;=18). Built-in inline SVG icons, reduced-motion CSS transitions, native Month/Week/Agenda Calendar views, geospatial Map views, SVG Sparklines, and deterministic AI fallbacks guarantee uninterrupted builds even when third-party icon, map, or AI packages are omitted.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-5 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs font-bold text-indigo-600 mb-1.5">
                  01. Install Package
                </div>
                <p className="text-sm text-slate-600 leading-[1.65]">
                  Run <code>npm install @enterprisegrid/grid</code>. No peer dependency conflicts or optional installs needed.
                </p>
              </div>
              <div className="p-5 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs font-bold text-indigo-600 mb-1.5">
                  02. Import CSS Once
                </div>
                <p className="text-sm text-slate-600 leading-[1.65]">
                  Import <code>@enterprisegrid/grid/dist/enterprisegrid.css</code> in your app root.
                </p>
              </div>
              <div className="p-5 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs font-bold text-indigo-600 mb-1.5">
                  03. Connect Any LLM
                </div>
                <p className="text-sm text-slate-600 leading-[1.65]">
                  Pass <code>columns</code> + <code>data</code>, optionally attach <code>llmConfig</code> or <code>TableSummary</code>.
                </p>
              </div>
            </div>

            <LiveCodeEditor language="tsx" title="setup.tsx">
              {`import React from 'react';
import { DataTable, TableSummary, DataTableHandle } from '@enterprisegrid/grid';
import '@enterprisegrid/grid/dist/enterprisegrid.css';

export function App({ columns, rows }) {
  return (
    <DataTable
      title="Production Grid"
      columns={columns}
      data={rows}
      pagination
      searchable
      exportable
      externalSummary="top"
    />
  );
}`}
            </LiveCodeEditor>
          </section>

          {/* Enterprise Full-Featured, External Summary & Universal LLM Playgrounds */}
          <FullFeaturedEnterprisePlayground />
          <ExternalSummaryPlayground />
          <UniversalLlmPlayground />

          <div className="mb-10 pt-6 border-t border-slate-200 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>Additional Interactive Playgrounds &amp; Feature Guides</span>
          </div>

          <AiAnalyticsPlayground />
          <AiQueryAssistantPlayground />
          <AiSmartSummaryPlayground />
          <AiInsightsDashboardPlayground />
          <MapViewPlayground />
          <CalendarViewPlayground />
          <SavedViewsPlayground />
          <ShareableViewsPlayground />
          <AuditTrailPlayground />
          <TimeTravelPlayground />
          <RowCommentsPlayground />
          <SparklinePlayground />
          <HeatmapPlayground />
          <BookmarksPlayground />
          <CommandPalettePlayground />
          <SidePreviewPlayground />
          <PluginSystemPlayground />
          <MobileSwipeActionsPlayground />
          <ThemeBuilderPlayground />
          <OfflineSyncPlayground />
          <MultiViewPlayground />
          <CellEditingPlayground />

          <FeaturesConfigPlayground />
          <LayoutAppearancePlayground />
          <ThemingStylingPlayground />
          <AdvancedSortingPlayground />
          <AdvancedPaginationPlayground />
          <AdvancedFooterPlayground />
          <AdvancedRowSelectionPlayground />
          <AdvancedExpandableRowsPlayground />
          <AdvancedRowEventsPlayground />
          <ColumnFeaturesPlayground />
          <LocalizationPlayground />

          <DocSection
            id="virtualization-csv"
            title="Windowed Virtualization, Copyable Cells & CSV Import"
            description={
              <p>
                Enable <code>virtualize</code> with <code>fixedHeader</code> to render hundreds or thousands of unpaginated rows at 60fps with zero dependencies. Add <code>copyable: true</code> to any column for one-click cell copy, and attach <code>onImportRows</code> to surface the built-in <strong>Import CSV</strong> modal.
              </p>
            }
            code={`<DataTable
  title="500-Row Virtualized Catalog"
  columns={[
    { id: 'id', name: 'ID', selector: (r) => r.id, width: '80px', copyable: true },
    { id: 'title', name: 'Title', selector: (r) => r.title, sortable: true, copyable: true },
    { id: 'director', name: 'Director', selector: (r) => r.director, sortable: true },
    { id: 'year', name: 'Year', selector: (r) => r.year, right: true },
  ]}
  data={rows}
  virtualize
  virtualRowHeight={44}
  virtualOverscan={8}
  fixedHeader
  fixedHeaderScrollHeight="300px"
  searchable
  onImportRows={(imported) =>
    setRows((prev) => [
      ...imported.map((item, idx) => ({ id: prev.length + idx + 1, ...item })),
      ...prev,
    ])
  }
/>`}
          >
            <DataTable
              title={`Virtualized Catalog (${virtualRows.length} rows)`}
              columns={[
                { id: 'id', name: 'ID', selector: (r: any) => r.id, width: '72px', copyable: true },
                { id: 'title', name: 'Title', selector: (r: any) => r.title, sortable: true, copyable: true },
                { id: 'director', name: 'Director', selector: (r: any) => r.director, sortable: true },
                { id: 'year', name: 'Year', selector: (r: any) => r.year, right: true },
              ]}
              data={virtualRows}
              virtualize
              virtualRowHeight={44}
              virtualOverscan={8}
              fixedHeader
              fixedHeaderScrollHeight="300px"
              searchable
              onImportRows={(imported) =>
                setVirtualRows((prev) => [
                  ...imported.map((item: any, idx: number) => ({
                    id: prev.length + idx + 1,
                    title: item.title || 'Imported Title',
                    director: item.director || 'Unknown',
                    year: item.year || '2026',
                  })),
                  ...prev,
                ])
              }
            />
          </DocSection>

          <DocSection
            id="responsive-layout"
            title="Responsive Container & Mobile Cards"
            description={
              <p>
                <code>DataTable</code> measures its own container width via <code>ResizeObserver</code> and switches cleanly between full table columns and touch-friendly stacked cards when narrower than <code>mobileBreakpoint</code> (default <code>640px</code>). Users can also toggle between <strong>Cards</strong> and <strong>Table</strong> directly from the toolbar, or double-click any resize handle to reset column width.
              </p>
            }
            code={`<DataTable
  title="Adaptive Revenue Grid"
  columns={columns}
  data={data}
  responsiveLayout="${responsiveLayoutMode}" // 'auto' | 'cards' | 'scroll'
  mobileBreakpoint={640}
  pagination
  paginationPerPage={4}
  searchable
  selectableRows
  resizable
/>`}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Container:
                  </span>
                  {(['360px', '580px', '100%'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setResponsivePreviewWidth(w)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        responsivePreviewWidth === w
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {w === '360px' ? 'Phone (360px)' : w === '580px' ? 'Split Pane (580px)' : 'Desktop (100%)'}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Mode:
                  </span>
                  {(['auto', 'cards', 'scroll'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setResponsiveLayoutMode(m)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        responsiveLayoutMode === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="mx-auto transition-all duration-300 border border-dashed border-indigo-200 rounded-xl p-2 bg-slate-50/40"
                style={{ width: responsivePreviewWidth, maxWidth: '100%' }}
              >
                <DataTable
                  title="Adaptive Catalog"
                  columns={[
                    { id: 'title', name: 'Title', selector: (r: any) => r.title, sortable: true, copyable: true },
                    { id: 'director', name: 'Director', selector: (r: any) => r.director, sortable: true, hide: 'sm' },
                    { id: 'year', name: 'Year', selector: (r: any) => r.year, sortable: true, right: true },
                  ]}
                  data={mockData.slice(0, 6)}
                  responsiveLayout={responsiveLayoutMode}
                  mobileBreakpoint={640}
                  pagination
                  paginationPerPage={3}
                  searchable
                  selectableRows
                  resizable
                />
              </div>
            </div>
          </DocSection>

          <DocSection
            id="custom-styles"
            title="Custom Styles"
            description={
              <p>
                Override default component styles using the <code>customStyles</code> prop. It allows you to inject inline styles or CSS classes into specific table components like <code>rows</code>, <code>headRow</code>, <code>cells</code>, and <code>pagination</code>.
              </p>
            }
            code={`<DataTable
  columns={columns}
  data={data}
  customStyles={{
    headRow: { style: { backgroundColor: '#f1f5f9', borderTop: '2px solid #6366f1' } },
    rows: { style: { minHeight: '64px', fontSize: '15px' } },
  }}
  config={{ searchable: false, exportable: false, densityToggle: false, columnVisibility: false }}
/>`}
          >
            <DataTable
              columns={mockColumns}
              data={mockData.slice(0, 3)}
              customStyles={{
                headRow: { style: { backgroundColor: '#f1f5f9', borderTop: '2px solid #6366f1' } },
                rows: { style: { minHeight: '64px', fontSize: '15px' } },
              }}
              config={{
                searchable: false,
                exportable: false,
                densityToggle: false,
                columnVisibility: false,
              }}
            />
          </DocSection>

          <DocSection
            id="themes"
            title="Theming & Custom Theme Builder"
            description={
              <p>
                Set the table theme using the <code>theme</code> prop. Choose from built-in themes (<code>light</code>, <code>dark</code>) or register custom themes using the <code>createTheme</code> utility.
              </p>
            }
            code={`import { createTheme } from '@enterprisegrid/grid';

createTheme('custom-dark', {
  text: { primary: '#f8fafc', secondary: '#cbd5e1' },
  background: { default: '#0f172a' },
  divider: { default: '#1e293b' },
});

<DataTable
  columns={columns}
  data={data}
  theme="custom-dark"
  config={{ searchable: false, exportable: false, densityToggle: false, columnVisibility: false }}
/>`}
          >
            <div className="bg-slate-900 p-4 -m-4">
              <DataTable
                columns={mockColumns}
                data={mockData.slice(0, 3)}
                theme="dark"
                config={{
                  searchable: false,
                  exportable: false,
                  densityToggle: false,
                  columnVisibility: false,
                }}
              />
            </div>
          </DocSection>
          </div>
        </div>
      </div>

      {showBackToTop && (
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          aria-label="Scroll documentation to top"
          className="fixed bottom-6 right-6 z-30 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-lg hover:bg-slate-800 transition-colors"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>Top</span>
        </button>
      )}

      <Footer />
    </div>
  );
}
