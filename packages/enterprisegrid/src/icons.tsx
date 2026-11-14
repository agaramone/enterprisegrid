import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

const BaseIcon: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 16,
  className = '',
  children,
  ...props
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

export const ChevronDown: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m6 9 6 6 6-6" /></BaseIcon>
);

export const ChevronUp: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m18 15-6-6-6 6" /></BaseIcon>
);

export const ChevronLeft: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m15 18-6-6 6-6" /></BaseIcon>
);

export const ChevronRight: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m9 18 6-6-6-6" /></BaseIcon>
);

export const ChevronsLeft: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m11 17-5-5 5-5" /><path d="m18 17-5-5 5-5" /></BaseIcon>
);

export const ChevronsRight: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></BaseIcon>
);

export const Search: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></BaseIcon>
);

export const Settings2: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
  </BaseIcon>
);

export const Download: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
  </BaseIcon>
);

export const Eye: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </BaseIcon>
);

export const EyeOff: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </BaseIcon>
);

export const LayoutGrid: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </BaseIcon>
);

export const GripVertical: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <circle cx="9" cy="12" r="1" /><circle cx="9" cy="5" r="1" /><circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="12" r="1" /><circle cx="15" cy="5" r="1" /><circle cx="15" cy="19" r="1" />
  </BaseIcon>
);

export const Map: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
    <path d="M15 5.764v15" /><path d="M9 3.236v15" />
  </BaseIcon>
);

export const MapPin: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </BaseIcon>
);

export const Calendar: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
  </BaseIcon>
);

export const Save: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" />
  </BaseIcon>
);

export const Bookmark: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></BaseIcon>
);

export const Share2: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
  </BaseIcon>
);

export const History: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
  </BaseIcon>
);

export const Undo2: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" /></BaseIcon>
);

export const Redo2: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" /></BaseIcon>
);

export const Clock: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></BaseIcon>
);

export const MessageSquare: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></BaseIcon>
);

export const Send: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></BaseIcon>
);

export const AtSign: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></BaseIcon>
);

export const X: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></BaseIcon>
);

export const Star: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </BaseIcon>
);

export const Command: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
  </BaseIcon>
);

export const Terminal: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><polyline points="4 17 10 11 4 5" /><line x1="12" x2="20" y1="19" y2="19" /></BaseIcon>
);

export const Keyboard: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="M6 8h.001" /><path d="M10 8h.001" /><path d="M14 8h.001" /><path d="M18 8h.001" />
    <path d="M8 12h.001" /><path d="M12 12h.001" /><path d="M16 12h.001" /><path d="M7 16h10" />
  </BaseIcon>
);

export const Copy: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </BaseIcon>
);

export const Check: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="M20 6 9 17l-5-5" /></BaseIcon>
);

export const Cloud: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></BaseIcon>
);

export const CloudOff: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="m2 2 20 20" /><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" />
    <path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
  </BaseIcon>
);

export const RefreshCw: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
  </BaseIcon>
);

export const Trello: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <rect width="3" height="9" x="7" y="7" /><rect width="3" height="5" x="14" y="7" />
  </BaseIcon>
);

export const Sparkles: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" /><path d="M22 5h-4" />
  </BaseIcon>
);

export const Pin: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <line x1="12" x2="12" y1="17" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </BaseIcon>
);

export const Layers: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </BaseIcon>
);

export const Filter: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></BaseIcon>
);

export const Bot: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
  </BaseIcon>
);

export const FileText: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
  </BaseIcon>
);

export const ArrowUp: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></BaseIcon>
);

export const ArrowDown: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></BaseIcon>
);

export const Maximize2: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" x2="14" y1="3" y2="10" />
    <line x1="3" x2="10" y1="21" y2="14" />
  </BaseIcon>
);

export const Minimize2: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" x2="21" y1="10" y2="3" />
    <line x1="3" x2="10" y1="21" y2="14" />
  </BaseIcon>
);

export const Plus: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </BaseIcon>
);

export const Trash2: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </BaseIcon>
);

export const Printer: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
    <rect width="12" height="8" x="6" y="14" />
  </BaseIcon>
);

export const MoreVertical: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </BaseIcon>
);

export const Upload: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </BaseIcon>
);

export const RotateCcw: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </BaseIcon>
);

export const TableIcon: React.FC<IconProps> = (props) => (
  <BaseIcon {...props}>
    <path d="M12 3v18" />
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
  </BaseIcon>
);




