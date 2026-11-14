import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { DataTable, TableSummary, ExternalSummaryData } from '@enterprisegrid/grid';

const mockData = [
  { id: 1, name: 'Q1 Launch', status: 'Completed', budget: 120000, impact: 'High' },
  { id: 2, name: 'Q2 Expansion', status: 'In Progress', budget: 250000, impact: 'Very High' },
  { id: 3, name: 'Q3 Refactor', status: 'Planning', budget: 85000, impact: 'Medium' },
  { id: 4, name: 'Q4 Marketing', status: 'At Risk', budget: 150000, impact: 'High' },
];

const mockColumns = [
  { id: 'name', name: 'Project Name', selector: (row: any) => row.name, sortable: true },
  { id: 'status', name: 'Status', selector: (row: any) => row.status, sortable: true },
  { id: 'budget', name: 'Budget', selector: (row: any) => row.budget, sortable: true, format: (row: any) => `$${row.budget.toLocaleString()}` },
  { id: 'impact', name: 'Impact', selector: (row: any) => row.impact, sortable: true },
];

export function AiSmartSummaryPlayground() {
  const [liveSummary, setLiveSummary] = useState<ExternalSummaryData<any> | null>(null);
  const [summaryPlacement, setSummaryPlacement] = useState<'above' | 'below'>('above');

  const codeSnippet = `
import { useState } from 'react';
import { DataTable, TableSummary, ExternalSummaryData } from '@enterprisegrid/grid';

export function DashboardWithExternalSummary() {
  // 1. Hold live summary state synced from DataTable
  const [summaryData, setSummaryData] = useState<ExternalSummaryData | null>(null);

  return (
    <div className="space-y-6">
      {/* Option A: Standalone <TableSummary /> placed anywhere outside the table */}
      <TableSummary
        summaryData={summaryData}
        title="Executive Portfolio Summary (Outside Table)"
        variant="detailed" // 'detailed' | 'cards' | 'compact'
        llmConfig={{
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          fallbackToLocal: true,
        }}
      />

      {/* Option B: Or pass externalSummary="top" | "bottom" directly on <DataTable /> */}
      <DataTable
        columns={columns}
        data={data}
        selectableRows
        searchable
        onSummaryChange={setSummaryData}
      />
    </div>
  );
}
  `.trim();

  return (
    <div id="ai-smart-summary" className="mb-16 scroll-mt-24">
      <h2 className="text-2xl font-semibold text-slate-800 mb-3">External Table Summary & AI Smart Summary</h2>

      <div className="text-slate-600 mb-4 leading-relaxed max-w-[75ch]">
        Summarize table data <strong>completely outside of the table</strong> using the standalone <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs text-indigo-600">&lt;TableSummary /&gt;</code> component or the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs text-indigo-600">externalSummary</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs text-indigo-600">onSummaryChange</code> props. Search, filter, or select rows in the table below and watch the external summary cards, column-level aggregations, and executive synopsis update in real time.
      </div>

      <div className="mb-5">
        <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 p-1 rounded-lg text-xs">
          <span className="px-2 text-slate-500 font-semibold">Placement:</span>
          <button
            type="button"
            onClick={() => setSummaryPlacement('above')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              summaryPlacement === 'above' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Outside Above Table
          </button>
          <button
            type="button"
            onClick={() => setSummaryPlacement('below')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              summaryPlacement === 'below' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Outside Below Table
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 mb-6">
        <div className="w-full space-y-4">
          {summaryPlacement === 'above' && (
            <TableSummary
              summaryData={liveSummary}
              data={mockData}
              columns={mockColumns}
              title="External Portfolio Summary (Rendered Outside Table)"
              llmConfig={{
                provider: 'gemini',
                model: 'gemini-3.8-flash',
                fallbackToLocal: true,
              }}
            />
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <DataTable
              title="Quarterly Initiative Tracker"
              columns={mockColumns}
              data={mockData}
              selectableRows
              searchable
              onSummaryChange={setLiveSummary}
              config={{ searchable: true, exportable: true, densityToggle: true, columnVisibility: true }}
            />
          </div>

          {summaryPlacement === 'below' && (
            <TableSummary
              summaryData={liveSummary}
              data={mockData}
              columns={mockColumns}
              title="External Portfolio Summary (Rendered Outside Table)"
              llmConfig={{
                provider: 'gemini',
                model: 'gemini-3.8-flash',
                fallbackToLocal: true,
              }}
            />
          )}
        </div>

        <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-[#1e1e1e] shadow-sm flex flex-col">
          <div className="bg-[#2d2d2d] border-b border-[#404040] px-4 py-2 text-xs font-semibold text-slate-300">
            External Table Summary Integration Example
          </div>
          <div className="flex-grow p-4 overflow-auto">
            <SyntaxHighlighter language="jsx" style={vscDarkPlus} customStyle={{ margin: 0, padding: 0, background: 'transparent', fontSize: '13px' }}>
              {codeSnippet}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
    </div>
  );
}
