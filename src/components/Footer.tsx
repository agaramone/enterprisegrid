import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8 mt-auto z-10 shrink-0">
      <div className="container mx-auto px-4 sm:px-8 max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-slate-500 text-sm text-center sm:text-left">
          &copy; {new Date().getFullYear()} EnterpriseGrid. Released under the MIT License.
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-slate-500">
          <Link to="/docs" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Docs
          </Link>
          <Link to="/api" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            API
          </Link>
          <Link to="/themes" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
            Themes
          </Link>
          <a
            href="https://github.com/sponsors/enterprisegrid"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rose-600 hover:text-rose-700 font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Sponsor ♥
          </a>
          <a
            href="/enterprisegrid-grid-3.0.0.tgz"
            download
            className="hover:text-indigo-600 transition-colors whitespace-nowrap shrink-0"
          >
            Download .tgz (v3.0.0)
          </a>
        </nav>
      </div>
    </footer>
  );
}
