import React, { useState } from 'react';
import { DataTable } from '@enterprisegrid/grid';
import LiveCodeEditor from './LiveCodeEditor';

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

export default function WorkingGridPlayground() {
  const [config, setConfig] = useState({
    pagination: true,
    selectableRows: true,
    expandableRows: false,
    striped: true,
    highlightOnHover: true,
    fixedHeader: false,
    dense: false,
    pointerOnHover: true,
    responsive: true,
    noHeader: true,
    noTableHead: false,
  });

  const toggleConfig = (key: keyof typeof config) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const codeSnippet = `
<DataTable
  columns={columns}
  data={data}${config.pagination ? '\n  pagination' : ''}${config.selectableRows ? '\n  selectableRows' : ''}${config.expandableRows ? '\n  expandableRows\n  expandableRowsComponent={ExpComponent}' : ''}${config.striped ? '\n  striped' : ''}${config.highlightOnHover ? '\n  highlightOnHover' : ''}${config.fixedHeader ? '\n  fixedHeader' : ''}${config.dense ? '\n  dense' : ''}${config.pointerOnHover ? '\n  pointerOnHover' : ''}${config.responsive ? '\n  responsive' : ''}${config.noHeader ? '\n  noHeader' : ''}${config.noTableHead ? '\n  noTableHead' : ''}
/>`.trim();

  return (
    <div id="working-grid" className="mb-16 scroll-mt-8">
      <h2 className="text-2xl font-display font-bold mb-3 text-slate-900">10-Line Grid Quickstart</h2>
      <div className="text-[15.5px] text-slate-600 mb-6 leading-[1.75] max-w-[70ch]">
        Toggle props below to see how a full-featured interactive grid comes together in under 10 lines of React.
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/4 flex-shrink-0">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sticky top-6">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Props Configuration</h3>
            <div className="space-y-3">
              {Object.entries(config).map(([key, value]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => toggleConfig(key as keyof typeof config)}
                      className="peer sr-only"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                    {key}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-3/4 flex-1 min-w-0 flex flex-col space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Live Preview</span>
              <span className="text-xs font-normal text-slate-400 tabular-nums">10 sample rows</span>
            </div>
            <div className="p-0 flex-grow overflow-auto relative min-h-[280px]">
              <DataTable
                columns={mockColumns}
                data={mockData}
                pagination={config.pagination}
                paginationPerPage={5}
                paginationRowsPerPageOptions={[5, 10]}
                selectableRows={config.selectableRows}
                expandableRows={config.expandableRows}
                expandableRowsComponent={({ data }: any) => (
                  <div className="p-5 bg-slate-50 text-sm text-slate-700 border-b border-slate-200">
                    Expanded details for: <strong className="text-indigo-600">{data.title}</strong> ({data.year})
                  </div>
                )}
                striped={config.striped}
                highlightOnHover={config.highlightOnHover}
                fixedHeader={config.fixedHeader}
                fixedHeaderScrollHeight={config.fixedHeader ? '300px' : undefined}
                dense={config.dense}
                pointerOnHover={config.pointerOnHover}
                responsive={config.responsive}
                noHeader={config.noHeader}
                noTableHead={config.noTableHead}
                config={{ searchable: false, exportable: false, densityToggle: false, columnVisibility: false }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <LiveCodeEditor language="jsx" title="quickstart.tsx">
              {codeSnippet}
            </LiveCodeEditor>

            <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex flex-col">
              <div className="bg-white border-b border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">
                Accessibility Check
              </div>
              <div className="p-4 text-sm text-slate-700 space-y-3 leading-[1.65]">
                {!config.pagination && (
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold shrink-0">Note:</span>
                    <span>Enable pagination for large datasets to keep keyboard navigation fast.</span>
                  </div>
                )}
                {!config.highlightOnHover && (
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold shrink-0">Contrast:</span>
                    <span>Ensure custom row styles maintain at least 4.5:1 text contrast.</span>
                  </div>
                )}
                {config.selectableRows && (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-700 font-semibold shrink-0">Pass:</span>
                    <span>Row selection checkboxes include ARIA labels tied to row content.</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-emerald-700 font-semibold shrink-0">Pass:</span>
                  <span>Semantic table roles and keyboard focus states are active.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
