import React, { useState, useRef } from 'react';
import LiveCodeEditor from '../LiveCodeEditor';
import { Archive, CheckSquare, Keyboard, Layers } from 'lucide-react';
import {
  DataTable,
  DataTableHandle,
  TableColumn,
  QuickFilter,
  BulkAction,
  RowContextMenuItem,
} from '@enterprisegrid/grid';

interface DealRecord {
  id: number;
  account: string;
  owner: string;
  region: string;
  stage: 'Discovery' | 'Proposal' | 'Negotiation' | 'Closed Won';
  arr: number;
  seats: number;
  renewalDate: string;
}

const initialDeals: DealRecord[] = [
  { id: 101, account: 'Northstar Logistics', owner: 'Elena Rostova', region: 'North America', stage: 'Closed Won', arr: 148000, seats: 420, renewalDate: '2026-04-15' },
  { id: 102, account: 'Helios Biotech', owner: 'Marcus Vance', region: 'EMEA', stage: 'Negotiation', arr: 92500, seats: 210, renewalDate: '2026-05-02' },
  { id: 103, account: 'Kuroda Robotics', owner: 'Kenji Sato', region: 'APAC', stage: 'Closed Won', arr: 215000, seats: 680, renewalDate: '2026-06-19' },
  { id: 104, account: 'Vanguard Retail', owner: 'Sofia Alvarez', region: 'North America', stage: 'Proposal', arr: 64000, seats: 145, renewalDate: '2026-04-28' },
  { id: 105, account: 'Boreal Energy', owner: 'Liam OConnor', region: 'EMEA', stage: 'Negotiation', arr: 178000, seats: 510, renewalDate: '2026-07-11' },
  { id: 106, account: 'Solstice FinTech', owner: 'Priya Nair', region: 'APAC', stage: 'Discovery', arr: 48500, seats: 95, renewalDate: '2026-08-03' },
];

export function FullFeaturedEnterprisePlayground() {
  const [deals, setDeals] = useState<DealRecord[]>(initialDeals);
  const [lastActionLog, setLastActionLog] = useState<string>('Right-click any row, select rows for bulk actions, or click table and use Arrow keys + Space/Enter.');
  const tableRef = useRef<DataTableHandle<DealRecord>>(null);

  const columns: TableColumn<DealRecord>[] = [
    {
      id: 'account',
      name: 'Account',
      selector: (row) => row.account,
      sortable: true,
      filterable: true,
      editable: true,
      copyable: true,
      pinned: 'left',
      aggregation: 'count',
      aggregationLabel: 'Deals',
    },
    {
      id: 'owner',
      name: 'Account Owner',
      selector: (row) => row.owner,
      sortable: true,
      filterable: true,
      editable: true,
    },
    {
      id: 'region',
      name: 'Region',
      selector: (row) => row.region,
      sortable: true,
      filterable: true,
      aggregation: 'unique',
      aggregationLabel: 'Regions',
    },
    {
      id: 'stage',
      name: 'Stage',
      selector: (row) => row.stage,
      sortable: true,
      editable: true,
      editor: {
        type: 'select',
        options: [
          { value: 'Discovery', label: 'Discovery' },
          { value: 'Proposal', label: 'Proposal' },
          { value: 'Negotiation', label: 'Negotiation' },
          { value: 'Closed Won', label: 'Closed Won' },
        ],
      },
      cell: (row) => {
        const tone =
          row.stage === 'Closed Won'
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : row.stage === 'Negotiation'
            ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
            : row.stage === 'Proposal'
            ? 'text-amber-700 bg-amber-50 border-amber-200'
            : 'text-slate-600 bg-slate-100 border-slate-200';
        return (
          <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded border ${tone}`}>
            {row.stage}
          </span>
        );
      },
    },
    {
      id: 'arr',
      name: 'ARR ($)',
      selector: (row) => row.arr,
      sortable: true,
      filterable: true,
      filterType: 'number',
      right: true,
      editable: true,
      heatmap: true,
      heatmapConfig: { colorScale: 'greens' },
      format: (row) => <span className="font-mono tabular-nums">${row.arr.toLocaleString()}</span>,
      aggregation: 'sum',
      aggregationLabel: 'Total',
    },
    {
      id: 'seats',
      name: 'Seats',
      selector: (row) => row.seats,
      sortable: true,
      filterType: 'number',
      right: true,
      editable: true,
      format: (row) => <span className="font-mono tabular-nums">{row.seats.toLocaleString()}</span>,
      aggregation: 'avg',
      aggregationLabel: 'Avg',
    },
    {
      id: 'renewalDate',
      name: 'Renewal Date',
      selector: (row) => row.renewalDate,
      sortable: true,
      filterType: 'date',
    },
  ];

  const quickFilters: QuickFilter<DealRecord>[] = [
    { id: 'won', label: 'Closed Won', predicate: (r) => r.stage === 'Closed Won' },
    { id: 'enterprise', label: 'Enterprise ($100k+)', predicate: (r) => r.arr >= 100000 },
    { id: 'na', label: 'North America', predicate: (r) => r.region === 'North America' },
  ];

  const bulkActions: BulkAction<DealRecord>[] = [
    {
      id: 'mark-won',
      label: 'Mark Closed Won',
      variant: 'primary',
      icon: <CheckSquare className="w-3.5 h-3.5" />,
      onClick: (selectedRows, clearSelection) => {
        const ids = new Set(selectedRows.map((r) => r.id));
        setDeals((prev) => prev.map((d) => (ids.has(d.id) ? { ...d, stage: 'Closed Won' } : d)));
        setLastActionLog(`Marked ${selectedRows.length} deal(s) as Closed Won.`);
        clearSelection();
      },
    },
    {
      id: 'archive-deals',
      label: 'Discount 10%',
      variant: 'default',
      icon: <Archive className="w-3.5 h-3.5" />,
      onClick: (selectedRows, clearSelection) => {
        const ids = new Set(selectedRows.map((r) => r.id));
        setDeals((prev) => prev.map((d) => (ids.has(d.id) ? { ...d, arr: Math.round(d.arr * 0.9) } : d)));
        setLastActionLog(`Applied 10% adjustment to ${selectedRows.length} deal(s).`);
        clearSelection();
      },
    },
  ];

  const rowContextMenu: RowContextMenuItem<DealRecord>[] = [
    {
      id: 'promote-stage',
      label: 'Promote to Closed Won',
      onClick: (row) => {
        setDeals((prev) => prev.map((d) => (d.id === row.id ? { ...d, stage: 'Closed Won' } : d)));
        setLastActionLog(`Promoted ${row.account} via right-click context menu.`);
      },
    },
    {
      id: 'remove-row',
      label: 'Delete Deal',
      danger: true,
      onClick: (row) => {
        setDeals((prev) => prev.filter((d) => d.id !== row.id));
        setLastActionLog(`Deleted ${row.account} via right-click context menu.`);
      },
    },
  ];

  const codeSnippet = `import { useRef, useState } from 'react';
import { DataTable, DataTableHandle, TableColumn } from '@enterprisegrid/grid';

const columns: TableColumn<Deal>[] = [
  { id: 'account', name: 'Account', selector: r => r.account, pinned: 'left', aggregation: 'count', aggregationLabel: 'Deals' },
  { id: 'arr', name: 'ARR ($)', selector: r => r.arr, right: true, aggregation: 'sum', aggregationLabel: 'Total' },
  { id: 'seats', name: 'Seats', selector: r => r.seats, right: true, aggregation: 'avg', aggregationLabel: 'Avg' },
];

export function EnterprisePipelineGrid() {
  const tableRef = useRef<DataTableHandle<Deal>>(null);
  const [deals, setDeals] = useState(initialDeals);

  return (
    <DataTable
      ref={tableRef}
      id="revenue-pipeline"
      title="Enterprise Revenue Pipeline"
      columns={columns}
      data={deals}
      selectableRows
      searchable
      exportable
      resizable
      groupBy="region"
      persistStateKey="revenue-pipeline-v1"
      fullscreenToggle
      enableKeyboardNavigation
      enableContextMenu
      quickFilters={[
        { id: 'won', label: 'Closed Won', predicate: (r) => r.stage === 'Closed Won' },
        { id: 'enterprise', label: 'Enterprise ($100k+)', predicate: (r) => r.arr >= 100000 },
      ]}
      bulkActions={[
        {
          id: 'mark-won',
          label: 'Mark Closed Won',
          variant: 'primary',
          onClick: (rows, clear) => { /* batch mutate */ clear(); }
        }
      ]}
      onAddRow={(draft) => setDeals(prev => [{ id: Date.now(), ...draft }, ...prev])}
      onImportRows={(rows) => setDeals(prev => [...rows.map((r, i) => ({ id: Date.now() + i, ...r })), ...prev])}
      onDeleteRows={(rows) => setDeals(prev => prev.filter(r => !rows.includes(r)))}
      rowContextMenu={[
        { id: 'delete', label: 'Delete Deal', danger: true, onClick: (row) => setDeals(prev => prev.filter(r => r.id !== row.id)) }
      ]}
    />
  );
}`;

  return (
    <div id="enterprise-productivity" className="mb-16 scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-2xl font-display font-semibold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          Full-Featured Enterprise Productivity
        </h2>
        <p className="text-[15.5px] text-slate-600 mt-2 max-w-[75ch] leading-[1.75]">
          Production CRUD workflows built directly into the grid: segmented quick filters, contextual bulk actions, column footer auto-aggregations (<code>sum</code>, <code>avg</code>, <code>count</code>, <code>unique</code>), built-in Add Row modal, right-click context menu, fullscreen mode, arrow-key cell navigation, and automatic <code>localStorage</code> layout persistence.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => tableRef.current?.selectAll()}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          ref.selectAll()
        </button>
        <button
          type="button"
          onClick={() => {
            const undone = tableRef.current?.undoLastEdit();
            setLastActionLog(undone ? 'Undid last inline cell edit via ref.undoLastEdit().' : 'Edit any cell first to test ref.undoLastEdit() or Ctrl+Z.');
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          ref.undoLastEdit()
        </button>
        <button
          type="button"
          onClick={() => tableRef.current?.toggleFullscreen()}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          ref.toggleFullscreen()
        </button>
        <button
          type="button"
          onClick={() => {
            tableRef.current?.resetLayout();
            setDeals(initialDeals);
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          Reset Demo
        </button>
      </div>

      <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Keyboard className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="truncate">{lastActionLog}</span>
        </div>
        <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">{deals.length} records</span>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <DataTable
          ref={tableRef}
          id="enterprise-productivity-demo"
          title="Enterprise Revenue Pipeline"
          columns={columns}
          data={deals}
          selectableRows
          selectableRowsHighlight
          showRowNumbers
          showStatusBar
          searchable
          exportable
          resizable
          pagination
          paginationPerPage={5}
          paginationRowsPerPageOptions={[5, 10, 20]}
          persistStateKey="docs-enterprise-pipeline-v1"
          fullscreenToggle
          enableKeyboardNavigation
          enableContextMenu
          addRowLabel="New Deal"
          quickFilters={quickFilters}
          bulkActions={bulkActions}
          rowContextMenu={rowContextMenu}
          onCellEdit={(row, val, col) => {
            const colId = String(col.id);
            setDeals((prev) =>
              prev.map((d) =>
                d.id === row.id
                  ? { ...d, [colId]: colId === 'arr' || colId === 'seats' ? Number(val) || 0 : val }
                  : d
              )
            );
            setLastActionLog(`Edited "${col.name}" on ${row.account} -> ${val}`);
          }}
          onAddRow={(draft) => {
            if (!draft) return;
            const created: DealRecord = {
              id: Date.now(),
              account: String(draft.account || 'New Enterprise Account'),
              owner: String(draft.owner || 'Unassigned'),
              region: String(draft.region || 'North America'),
              stage: (['Discovery', 'Proposal', 'Negotiation', 'Closed Won'].includes(String(draft.stage))
                ? String(draft.stage)
                : 'Discovery') as DealRecord['stage'],
              arr: Number(draft.arr) || 50000,
              seats: Number(draft.seats) || 100,
              renewalDate: String(draft.renewalDate || '2026-09-01'),
            };
            setDeals((prev) => [created, ...prev]);
            setLastActionLog(`Added new deal: ${created.account}`);
          }}
          onImportRows={(importedRows) => {
            const normalized: DealRecord[] = importedRows.map((draft, idx) => ({
              id: Date.now() + idx,
              account: String(draft.account || `Imported Account ${idx + 1}`),
              owner: String(draft.owner || 'Unassigned'),
              region: String(draft.region || 'North America'),
              stage: (['Discovery', 'Proposal', 'Negotiation', 'Closed Won'].includes(String(draft.stage))
                ? String(draft.stage)
                : 'Discovery') as DealRecord['stage'],
              arr: Number(draft.arr) || 50000,
              seats: Number(draft.seats) || 100,
              renewalDate: String(draft.renewalDate || '2026-09-01'),
            }));
            setDeals((prev) => [...normalized, ...prev]);
            setLastActionLog(`Imported ${normalized.length} deal(s) from CSV/TSV.`);
          }}
          onDeleteRows={(rowsToDelete) => {
            const ids = new Set(rowsToDelete.map((r) => r.id));
            setDeals((prev) => prev.filter((d) => !ids.has(d.id)));
            setLastActionLog(`Deleted ${rowsToDelete.length} selected row(s).`);
          }}
          config={{
            bookmarks: true,
            sidePreview: true,
            commandPalette: true,
            columnPinning: true,
            rowGrouping: true,
          }}
          renderSidePreview={(row, onClose) => (
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{row.region}</div>
                  <h4 className="text-lg font-bold text-slate-900">{row.account}</h4>
                </div>
                <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                  Close
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 uppercase text-[10px] font-bold">Annual Revenue</div>
                  <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">${row.arr.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="text-slate-400 uppercase text-[10px] font-bold">Seats</div>
                  <div className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5">{row.seats.toLocaleString()}</div>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div><span className="font-semibold text-slate-800">Owner:</span> {row.owner}</div>
                <div><span className="font-semibold text-slate-800">Stage:</span> {row.stage}</div>
                <div><span className="font-semibold text-slate-800">Renewal Date:</span> {row.renewalDate}</div>
              </div>
            </div>
          )}
        />
      </div>

      <LiveCodeEditor language="tsx" title="enterprise-pipeline.tsx">
        {codeSnippet}
      </LiveCodeEditor>
    </div>
  );
}
