import React, { useState } from 'react';
import LiveCodeEditor from '../LiveCodeEditor';
import { BarChart3 } from 'lucide-react';
import {
  DataTable,
  TableSummary,
  ExternalSummaryData,
  TableColumn,
} from '@enterprisegrid/grid';

interface OrderItem {
  id: number;
  customer: string;
  segment: 'Enterprise' | 'Mid-Market' | 'SMB';
  status: 'Paid' | 'Pending' | 'Overdue';
  amount: number;
  items: number;
}

const sampleOrders: OrderItem[] = [
  { id: 1, customer: 'Acme Cloud Corp', segment: 'Enterprise', status: 'Paid', amount: 42500, items: 14 },
  { id: 2, customer: 'Beacon Health', segment: 'Mid-Market', status: 'Paid', amount: 18900, items: 6 },
  { id: 3, customer: 'Cobalt Logistics', segment: 'Enterprise', status: 'Pending', amount: 61200, items: 22 },
  { id: 4, customer: 'Driftwood Media', segment: 'SMB', status: 'Overdue', amount: 4800, items: 3 },
  { id: 5, customer: 'Evergreen Energy', segment: 'Enterprise', status: 'Paid', amount: 88400, items: 30 },
];

const orderColumns: TableColumn<OrderItem>[] = [
  { id: 'customer', name: 'Customer', selector: (r) => r.customer, sortable: true, filterable: true },
  { id: 'segment', name: 'Segment', selector: (r) => r.segment, sortable: true, filterable: true },
  { id: 'status', name: 'Invoice Status', selector: (r) => r.status, sortable: true },
  {
    id: 'amount',
    name: 'Invoice Amount ($)',
    selector: (r) => r.amount,
    sortable: true,
    right: true,
    format: (r) => <span className="font-mono tabular-nums">${r.amount.toLocaleString()}</span>,
  },
  {
    id: 'items',
    name: 'Line Items',
    selector: (r) => r.items,
    sortable: true,
    right: true,
    format: (r) => <span className="font-mono tabular-nums">{r.items}</span>,
  },
];

export function ExternalSummaryPlayground() {
  const [summaryData, setSummaryData] = useState<ExternalSummaryData<OrderItem> | null>(null);
  const [variant, setVariant] = useState<'detailed' | 'cards' | 'compact'>('detailed');

  const codeSnippet = `import React, { useState } from 'react';
import { DataTable, TableSummary, ExternalSummaryData } from '@enterprisegrid/grid';

export function OrdersReportPage() {
  const [summaryData, setSummaryData] = useState<ExternalSummaryData | null>(null);

  return (
    <div className="space-y-6">
      {/* Standalone summary component placed anywhere outside the DataTable */}
      <TableSummary
        summaryData={summaryData}
        title="Live Ledger Summary"
        variant="${variant}" // 'detailed' | 'cards' | 'compact' | 'sidebar'
        llmConfig={{ provider: 'gemini', model: 'gemini-3.8-flash', fallbackToLocal: true }}
      />

      {/* Or use built-in prop: <DataTable externalSummary="top" ... /> */}
      <DataTable
        columns={columns}
        data={orders}
        selectableRows
        searchable
        onSummaryChange={setSummaryData}
      />
    </div>
  );
}`;

  return (
    <div id="external-summary-guide" className="mb-16 scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-2xl font-display font-semibold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          External Table Summary (<code>&lt;TableSummary /&gt;</code>)
        </h2>
        <p className="text-[15.5px] text-slate-600 mt-2 max-w-[75ch] leading-[1.75]">
          Summarize table data outside the grid container. Filter, search, or select rows below and watch the standalone <code>&lt;TableSummary /&gt;</code> card recalculate totals, averages, min/max, category distributions, and executive copy in real time via <code>onSummaryChange</code>—or render it automatically with <code>externalSummary="top" | "bottom"</code>.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-slate-500">Summary Variant:</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 shrink-0">
          {(['detailed', 'cards', 'compact'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 ${
                variant === v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Standalone TableSummary rendered OUTSIDE the DataTable container */}
      <div className="mb-4">
        <TableSummary
          summaryData={summaryData}
          title="Live External Ledger Summary (Detached Component)"
          variant={variant}
        />
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          id="external-summary-docs-grid"
          title="Customer Invoices"
          columns={orderColumns}
          data={sampleOrders}
          selectableRows
          searchable
          onSummaryChange={setSummaryData}
          config={{
            columnVisibility: false,
            exportable: true,
          }}
        />
      </div>

      <LiveCodeEditor language="tsx" title="external-summary.tsx">
        {codeSnippet}
      </LiveCodeEditor>
    </div>
  );
}
