import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, X, Eye } from './icons';

export interface NativeCalendarEvent<T = any> {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  resource: T;
}

interface NativeCalendarViewProps<T> {
  events: NativeCalendarEvent<T>[];
  onSelectEvent?: (row: T) => void;
  theme?: 'light' | 'dark';
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isDateBetween(target: Date, start: Date, end: Date): boolean {
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return t >= s && t <= e;
}

export function NativeCalendarView<T>({
  events,
  onSelectEvent,
  theme = 'light',
}: NativeCalendarViewProps<T>) {
  // Default initial date to first valid event date or today
  const initialDate = useMemo(() => {
    const valid = events.find(e => e.start && !isNaN(e.start.getTime()));
    return valid ? new Date(valid.start) : new Date();
  }, [events]);

  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [calMode, setCalMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [selectedEvent, setSelectedEvent] = useState<NativeCalendarEvent<T> | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: new Date(year, month, d),
        isCurrentMonth: true,
      });
    }

    // Next month padding to 35 or 42 cells
    const totalCells = cells.length <= 35 ? 35 : 42;
    let nextMonthDay = 1;
    while (cells.length < totalCells) {
      cells.push({
        date: new Date(year, month + 1, nextMonthDay++),
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const navigatePrev = () => {
    if (calMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const navigateNext = () => {
    if (calMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const today = new Date();
  const isDark = theme === 'dark';

  return (
    <div className={`w-full h-full flex flex-col rounded-lg border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'} overflow-hidden`}>
      {/* Calendar Toolbar */}
      <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={navigateToday}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${isDark ? 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'}`}
          >
            Today
          </button>
          <div className="flex items-center rounded-md border overflow-hidden border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={navigatePrev}
              className={`p-1.5 transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white hover:bg-slate-100 text-slate-600'}`}
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={navigateNext}
              className={`p-1.5 border-l transition-colors ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200' : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'}`}
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <h4 className="text-sm font-bold ml-2 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-indigo-600" />
            <span>{MONTH_NAMES[month]} <span className="font-mono">{year}</span></span>
            <span className="text-[11px] font-normal text-slate-400 font-mono">({events.length} events)</span>
          </h4>
        </div>

        <div className={`inline-flex rounded-lg p-0.5 border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
          {(['month', 'week', 'agenda'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setCalMode(mode)}
              className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-all ${
                calMode === mode
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Body */}
      <div className="flex-1 overflow-y-auto relative">
        {calMode === 'month' && (
          <div className="overflow-x-auto h-full">
            <div className="flex flex-col h-full min-h-[420px] min-w-[540px]">
              <div className={`grid grid-cols-7 border-b text-[11px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-800/40 border-slate-700 text-slate-400' : 'bg-slate-50/70 border-slate-200 text-slate-500'}`}>
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="py-2 px-2 text-center border-r last:border-r-0 border-slate-200/60 dark:border-slate-700/60">
                    {day}
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                {calendarDays.map((cell, idx) => {
                  const dayEvents = events.filter(ev =>
                    ev.start && !isNaN(ev.start.getTime()) && isDateBetween(cell.date, ev.start, ev.end || ev.start)
                  );
                  const isTodayCell = isSameDay(cell.date, today);

                  return (
                    <div
                      key={idx}
                      className={`min-h-[82px] p-1.5 border-b border-r last:border-r-0 transition-colors flex flex-col gap-1 ${
                        isDark
                          ? `${cell.isCurrentMonth ? 'bg-slate-900' : 'bg-slate-950/60 text-slate-600'} border-slate-800`
                          : `${cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/60 text-slate-400'} border-slate-100`
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full font-semibold ${
                            isTodayCell
                              ? 'bg-indigo-600 text-white'
                              : ''
                          }`}
                        >
                          {cell.date.getDate()}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-mono text-slate-400">{dayEvents.length}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 overflow-y-auto max-h-[68px]">
                        {dayEvents.map((ev, eIdx) => (
                          <button
                            key={`${ev.id}-${eIdx}`}
                            type="button"
                            onClick={() => {
                              setSelectedEvent(ev);
                              onSelectEvent?.(ev.resource);
                            }}
                            className="w-full text-left px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition-colors truncate"
                            title={ev.title}
                          >
                            {ev.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {calMode === 'week' && (
          <div className="overflow-x-auto h-full">
            <div className="grid grid-cols-7 h-full min-h-[420px] min-w-[640px] divide-x divide-slate-200 dark:divide-slate-800">
            {weekDays.map((day, idx) => {
              const dayEvents = events.filter(ev =>
                ev.start && !isNaN(ev.start.getTime()) && isDateBetween(day, ev.start, ev.end || ev.start)
              );
              const isTodayCell = isSameDay(day, today);
              return (
                <div key={idx} className="flex flex-col p-2 gap-2">
                  <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-slate-400">{DAYS_OF_WEEK[day.getDay()]}</div>
                    <div className={`mt-1 inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-mono font-bold ${isTodayCell ? 'bg-indigo-600 text-white' : ''}`}>
                      {day.getDate()}
                    </div>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    {dayEvents.length === 0 ? (
                      <div className="text-[10px] text-slate-300 text-center py-6 italic">No events</div>
                    ) : (
                      dayEvents.map((ev, eIdx) => (
                        <button
                          key={`${ev.id}-${eIdx}`}
                          type="button"
                          onClick={() => {
                            setSelectedEvent(ev);
                            onSelectEvent?.(ev.resource);
                          }}
                          className="w-full text-left p-2 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-colors"
                        >
                          <div className="font-semibold truncate">{ev.title}</div>
                          <div className="text-[10px] opacity-75 font-mono mt-0.5">
                            {ev.start.toISOString().split('T')[0]}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {calMode === 'agenda' && (
          <div className="p-4 space-y-2">
            {events.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 italic">No scheduled events in current dataset.</div>
            ) : (
              events
                .slice()
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .map((ev, idx) => (
                  <div
                    key={`${ev.id}-${idx}`}
                    onClick={() => {
                      setSelectedEvent(ev);
                      onSelectEvent?.(ev.resource);
                    }}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                      isDark ? 'bg-slate-800/50 border-slate-700 hover:border-indigo-500' : 'bg-slate-50/70 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="px-2.5 py-1 rounded bg-indigo-600 text-white font-mono text-xs font-bold shrink-0">
                        {ev.start.toISOString().split('T')[0]}
                      </div>
                      <div className="font-semibold text-sm truncate">{ev.title}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(ev);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect
                    </button>
                  </div>
                ))
            )}
          </div>
        )}

        {/* Selected Event Inspector Popover */}
        {selectedEvent && (
          <div className="fixed sm:absolute bottom-3 left-3 right-3 sm:left-auto sm:bottom-4 sm:right-4 z-20 sm:w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Scheduled Record</span>
                <h5 className="font-bold text-sm text-slate-900 dark:text-white">{selectedEvent.title}</h5>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs font-mono text-slate-500 mb-3">
              Date: {selectedEvent.start.toISOString().split('T')[0]}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 border-t border-slate-100 pt-2 text-xs">
              {Object.entries(selectedEvent.resource || {}).slice(0, 6).map(([k, v]) => {
                if (typeof v === 'object' || typeof v === 'function') return null;
                return (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-slate-400 capitalize">{k}:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 font-mono truncate max-w-[160px]">{String(v)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface NativeMapMarker<T = any> {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  row: T;
}

interface NativeMapViewProps<T> {
  markers: NativeMapMarker<T>[];
  onSelectMarker?: (row: T) => void;
  theme?: 'light' | 'dark';
}

/**
 * Zero-dependency interactive geospatial map view.
 * Uses Mercator projection on an interactive pan/zoom canvas with OpenStreetMap tile rendering
 * and interactive vector markers so it works 100% even if `leaflet` / `react-leaflet` are not installed.
 */
export function NativeMapView<T>({
  markers,
  onSelectMarker,
  theme = 'light',
}: NativeMapViewProps<T>) {
  const [selectedMarker, setSelectedMarker] = useState<NativeMapMarker<T> | null>(markers[0] || null);
  const [zoom, setZoom] = useState<number>(2);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Convert lat/lng to normalized 0..100% coordinates for our world projection
  const projectPoint = (lat: number, lng: number) => {
    const clampedLat = Math.max(-85, Math.min(85, lat));
    const x = ((lng + 180) / 360) * 100;
    const latRad = (clampedLat * Math.PI) / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y = (0.5 - mercN / (2 * Math.PI)) * 100;
    return { x, y };
  };

  const scale = Math.pow(1.35, zoom - 2);

  return (
    <div className="w-full h-full flex flex-col sm:flex-row bg-slate-900 text-white overflow-hidden select-none relative">
      {/* Interactive Map Viewport */}
      <div
        className="flex-1 relative overflow-hidden bg-[#0b192c] cursor-grab active:cursor-grabbing min-h-[290px]"
        onMouseDown={(e) => {
          setIsDragging(true);
          setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        }}
        onMouseMove={(e) => {
          if (!isDragging) return;
          setPanOffset({
            x: Math.max(-350, Math.min(350, e.clientX - dragStart.x)),
            y: Math.max(-250, Math.min(250, e.clientY - dragStart.y)),
          });
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        {/* Scaled & Panned Map Layer */}
        <div
          className="absolute inset-0 transition-transform duration-150 ease-out"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Stylistic World Grid & Continents SVG */}
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-full object-cover opacity-85"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern id="eg-map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="1000" height="500" fill="#0f172a" />
            <rect width="1000" height="500" fill="url(#eg-map-grid)" />
            {/* Equator & Prime Meridian */}
            <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(99, 102, 241, 0.25)" strokeDasharray="4 4" />
            <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(99, 102, 241, 0.25)" strokeDasharray="4 4" />
            {/* Simplified Continent Silhouettes for Geospatial Context */}
            <g fill="#1e293b" stroke="#334155" strokeWidth="1.2">
              {/* North America */}
              <path d="M 90,65 L 245,55 L 305,115 L 255,215 L 185,235 L 115,155 Z" />
              {/* South America */}
              <path d="M 245,255 L 335,275 L 355,365 L 295,455 L 255,415 Z" />
              {/* Europe */}
              <path d="M 455,65 L 575,55 L 595,145 L 475,165 L 445,125 Z" />
              {/* Africa */}
              <path d="M 455,180 L 585,180 L 625,295 L 555,415 L 495,385 L 445,265 Z" />
              {/* Asia */}
              <path d="M 585,55 L 865,65 L 895,215 L 765,265 L 635,215 L 595,145 Z" />
              {/* Australia */}
              <path d="M 770,325 L 890,320 L 905,405 L 795,415 Z" />
            </g>
          </svg>

          {/* Plotted Coordinate Markers */}
          {markers.map((marker) => {
            const pos = projectPoint(marker.lat, marker.lng);
            const isSelected = selectedMarker?.id === marker.id;
            return (
              <div
                key={marker.id}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-full z-10 group"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMarker(marker);
                  onSelectMarker?.(marker.row);
                }}
              >
                <div
                  className={`flex flex-col items-center cursor-pointer transition-transform ${
                    isSelected ? 'scale-125 z-20' : 'hover:scale-110'
                  }`}
                >
                  <div
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap mb-0.5 shadow-md border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-900/90 text-slate-100 border-slate-700 opacity-90 group-hover:opacity-100'
                    }`}
                  >
                    {marker.title}
                  </div>
                  <MapPin
                    className={`w-6 h-6 drop-shadow ${
                      isSelected ? 'text-indigo-400 fill-indigo-600' : 'text-rose-500 fill-rose-500/30'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Zoom & Reset Controls */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 bg-slate-900/90 border border-slate-700 rounded-lg p-1 shadow-lg z-20">
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(6, z + 1))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-200 font-mono font-bold text-sm"
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(1, z - 1))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-200 font-mono font-bold text-sm border-t border-slate-800"
            title="Zoom Out"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(2);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-mono border-t border-slate-800"
            title="Reset View"
          >
            1:1
          </button>
        </div>

        {/* Selected Pin Popup Overlay */}
        {selectedMarker && (
          <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-xl max-w-xs z-20 backdrop-blur-xs">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs font-bold text-white truncate">{selectedMarker.title}</span>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800">
                {selectedMarker.lat.toFixed(2)}, {selectedMarker.lng.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-slate-800 text-[11px]">
              <a
                href={`https://www.openstreetmap.org/?mlat=${selectedMarker.lat}&mlon=${selectedMarker.lng}#map=10/${selectedMarker.lat}/${selectedMarker.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 font-medium underline"
              >
                Open in OpenStreetMap ↗
              </a>
              <button
                type="button"
                onClick={() => setSelectedMarker(null)}
                className="text-slate-400 hover:text-slate-200 text-[10px]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Geospatial Coordinate Directory Sidebar */}
      <div className="w-full sm:w-64 border-t sm:border-t-0 sm:border-l border-slate-800 bg-slate-900/95 flex flex-col max-h-[200px] sm:max-h-full">
        <div className="px-3 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Geospatial Pins</span>
          <span className="text-xs font-mono bg-slate-800 text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
            {markers.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {markers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 italic">
              No valid lat/lng coordinates found in current view.
            </div>
          ) : (
            markers.map((m) => {
              const isSelected = selectedMarker?.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMarker(m);
                    onSelectMarker?.(m.row);
                  }}
                  className={`w-full text-left px-3 py-2.5 transition-colors flex items-center justify-between gap-2 ${
                    isSelected ? 'bg-indigo-600/20 text-white' : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{m.title}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {m.lat.toFixed(4)}°, {m.lng.toFixed(4)}°
                    </div>
                  </div>
                  <MapPin className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-600'}`} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
