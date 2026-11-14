import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { SEO } from '../components/SEO';
import Footer from '../components/Footer';
import { DataTable, createTheme } from '@enterprisegrid/grid';
import LiveCodeEditor from '../components/LiveCodeEditor';

const mockData = [
  { id: 1, title: 'Beetlejuice', year: '1988', director: 'Tim Burton' },
  { id: 2, title: 'Ghostbusters', year: '1984', director: 'Ivan Reitman' },
  { id: 3, title: 'The Matrix', year: '1999', director: 'Lana Wachowski' },
  { id: 4, title: 'Inception', year: '2010', director: 'Christopher Nolan' },
];

const mockColumns = [
  { id: 'title', name: 'Title', selector: (row: any) => row.title, sortable: true },
  { id: 'director', name: 'Director', selector: (row: any) => row.director, sortable: true },
  { id: 'year', name: 'Year', selector: (row: any) => row.year, sortable: true, right: true },
];

interface ThemePreset {
  id: string;
  label: string;
  base: 'light' | 'dark';
  colors: {
    textPrimary: string;
    textSecondary: string;
    bgDefault: string;
    contextBg: string;
    contextText: string;
    dividerDefault: string;
    actionButton: string;
    actionHover: string;
    actionDisabled: string;
  };
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'indigo-slate',
    label: 'Indigo Slate',
    base: 'light',
    colors: {
      textPrimary: '#1e293b',
      textSecondary: '#4f46e5',
      bgDefault: '#f8fafc',
      contextBg: '#4f46e5',
      contextText: '#ffffff',
      dividerDefault: '#e2e8f0',
      actionButton: '#6366f1',
      actionHover: 'rgba(79, 70, 229, 0.08)',
      actionDisabled: 'rgba(15, 23, 42, 0.12)',
    },
  },
  {
    id: 'obsidian-night',
    label: 'Obsidian Night',
    base: 'dark',
    colors: {
      textPrimary: '#f1f5f9',
      textSecondary: '#818cf8',
      bgDefault: '#0f172a',
      contextBg: '#312e81',
      contextText: '#f8fafc',
      dividerDefault: '#1e293b',
      actionButton: '#818cf8',
      actionHover: 'rgba(129, 140, 248, 0.12)',
      actionDisabled: 'rgba(248, 250, 252, 0.18)',
    },
  },
  {
    id: 'emerald-studio',
    label: 'Emerald Studio',
    base: 'light',
    colors: {
      textPrimary: '#0f172a',
      textSecondary: '#047857',
      bgDefault: '#f8faf9',
      contextBg: '#065f46',
      contextText: '#ffffff',
      dividerDefault: '#d1fae5',
      actionButton: '#059669',
      actionHover: 'rgba(5, 150, 105, 0.08)',
      actionDisabled: 'rgba(15, 23, 42, 0.14)',
    },
  },
  {
    id: 'high-contrast',
    label: 'Mono Contrast',
    base: 'light',
    colors: {
      textPrimary: '#09090b',
      textSecondary: '#27272a',
      bgDefault: '#ffffff',
      contextBg: '#09090b',
      contextText: '#ffffff',
      dividerDefault: '#d4d4d8',
      actionButton: '#18181b',
      actionHover: 'rgba(9, 9, 11, 0.06)',
      actionDisabled: 'rgba(9, 9, 11, 0.15)',
    },
  },
];

export default function Themes() {
  const [themeName, setThemeName] = useState('indigo-slate');
  const [baseTheme, setBaseTheme] = useState<'light' | 'dark'>('light');
  const [colors, setColors] = useState(THEME_PRESETS[0].colors);

  useEffect(() => {
    createTheme(
      themeName || 'custom-theme',
      {
        text: {
          primary: colors.textPrimary,
          secondary: colors.textSecondary,
        },
        background: {
          default: colors.bgDefault,
        },
        context: {
          background: colors.contextBg,
          text: colors.contextText,
        },
        divider: {
          default: colors.dividerDefault,
        },
        action: {
          button: colors.actionButton,
          hover: colors.actionHover,
          disabled: colors.actionDisabled,
        },
      },
      baseTheme
    );
  }, [colors, themeName, baseTheme]);

  const applyPreset = (preset: ThemePreset) => {
    setThemeName(preset.id);
    setBaseTheme(preset.base);
    setColors(preset.colors);
  };

  const handleChange = (key: keyof typeof colors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const safeHex = (val: string) => (/^#[0-9a-fA-F]{6}$/.test(val) ? val : '#6366f1');

  const codeSnippet = `import { DataTable, createTheme } from '@enterprisegrid/grid';

createTheme('${themeName || 'custom-theme'}', {
  text: {
    primary: '${colors.textPrimary}',
    secondary: '${colors.textSecondary}',
  },
  background: {
    default: '${colors.bgDefault}',
  },
  context: {
    background: '${colors.contextBg}',
    text: '${colors.contextText}',
  },
  divider: {
    default: '${colors.dividerDefault}',
  },
  action: {
    button: '${colors.actionButton}',
    hover: '${colors.actionHover}',
    disabled: '${colors.actionDisabled}',
  },
}, '${baseTheme}');

export function MyThemedTable({ columns, data }) {
  return (
    <DataTable
      title="Movie Directory"
      columns={columns}
      data={data}
      theme="${themeName || 'custom-theme'}"
      selectableRows
      pagination
    />
  );
}`;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-slate-50/70">
      <SEO
        title="Theme Builder"
        description="Create custom themes for EnterpriseGrid by picking curated presets or brand colors. Preview live changes and copy the generated configuration instantly."
        url="https://enterprisegrid.io/themes"
        keywords="React table theme builder, data grid style creator, custom CSS generator, visual data grid customizer"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'EnterpriseGrid Theme Builder',
          description:
            'Create custom themes for EnterpriseGrid by picking curated presets or brand colors. See live changes and copy the generated configuration instantly.',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'All',
          offers: {
            '@type': 'Offer',
            price: '0.00',
            priceCurrency: 'USD',
          },
        }}
      />

      <div className="container mx-auto px-4 sm:px-8 py-10 max-w-7xl flex-1">
        <div className="mb-10 border-b border-slate-200 pb-8 space-y-5">
          <div>
            <div className="text-xs font-semibold text-indigo-600 mb-2">
              Visual Theme Customizer
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-3">
              Interactive Theme Generator
            </h1>
            <p className="text-base sm:text-[17px] text-slate-600 max-w-[72ch] leading-[1.75]">
              Start from a curated preset or customize individual tokens. Changes render immediately on the grid and sync into the copy-ready TypeScript snippet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                  themeName === preset.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-full border border-black/15"
                  style={{ backgroundColor: preset.colors.contextBg }}
                />
                <span>{preset.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => applyPreset(THEME_PRESETS[0])}
              title="Reset theme to default"
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Reset theme"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="w-full lg:w-[340px] flex-shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
              <div>
                <h2 className="font-display font-bold text-sm text-slate-900 mb-4">Base Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="theme-name-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Theme Name
                    </label>
                    <input
                      id="theme-name-input"
                      type="text"
                      value={themeName}
                      onChange={(e) => setThemeName(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg text-sm px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="base-theme-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Base Mode
                    </label>
                    <select
                      id="base-theme-select"
                      value={baseTheme}
                      onChange={(e) => setBaseTheme(e.target.value as 'light' | 'dark')}
                      className="w-full border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h2 className="font-display font-bold text-sm text-slate-900 mb-4">Color Tokens</h2>
                <div className="space-y-3">
                  {Object.entries(colors).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <label className="text-xs font-medium text-slate-700 capitalize truncate">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => handleChange(key as keyof typeof colors, e.target.value)}
                          aria-label={`${key} value`}
                          className="w-28 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-indigo-500"
                        />
                        <input
                          type="color"
                          value={safeHex(value)}
                          onChange={(e) => handleChange(key as keyof typeof colors, e.target.value)}
                          aria-label={`Pick ${key} color`}
                          className="w-7 h-7 rounded cursor-pointer border border-slate-200 p-0.5 bg-white shrink-0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full flex-1 min-w-0 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600">Live Preview</span>
                <span className="text-xs font-mono text-slate-400">{themeName || 'custom-theme'}</span>
              </div>
              <div className="p-4 transition-colors" style={{ backgroundColor: colors.bgDefault }}>
                <DataTable
                  title="Movie Database"
                  columns={mockColumns}
                  data={mockData}
                  theme={themeName || 'custom-theme'}
                  selectableRows
                  pagination
                  config={{
                    searchable: true,
                    exportable: false,
                    densityToggle: false,
                    columnVisibility: false,
                  }}
                />
              </div>
            </div>

            <LiveCodeEditor language="tsx" title="theme-config.tsx">
              {codeSnippet}
            </LiveCodeEditor>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
