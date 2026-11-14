import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LayoutGrid, PanelLeftOpen, PanelLeftClose, Heart, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { isEnterpriseGridDonated, setEnterpriseGridDonated } from '@enterprisegrid/grid';

const NAV_LINKS = [
  { to: '/', label: 'Overview' },
  { to: '/docs', label: 'Docs' },
  { to: '/themes', label: 'Themes' },
  { to: '/api', label: 'API' },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [docsSidebarOpen, setDocsSidebarOpen] = useState(false);
  const [hasDonated, setHasDonated] = useState<boolean>(() => isEnterpriseGridDonated());
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(15);
  const location = useLocation();

  const isDocsPage = location.pathname === '/docs';

  useEffect(() => {
    const handleStateChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setDocsSidebarOpen(customEvent.detail);
    };
    const handleDonationChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setHasDonated(Boolean(customEvent.detail));
    };
    const handleOpenDonateModal = () => {
      setShowDonateModal(true);
    };
    window.addEventListener('docs-sidebar-state', handleStateChange);
    window.addEventListener('eg-donation-changed', handleDonationChange as EventListener);
    window.addEventListener('eg-open-donate-modal', handleOpenDonateModal);
    return () => {
      window.removeEventListener('docs-sidebar-state', handleStateChange);
      window.removeEventListener('eg-donation-changed', handleDonationChange as EventListener);
      window.removeEventListener('eg-open-donate-modal', handleOpenDonateModal);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleToggleSidebar = () => {
    window.dispatchEvent(new CustomEvent('toggle-docs-sidebar'));
  };

  const handleCompleteDonation = (amount: number) => {
    setEnterpriseGridDonated(true);
    setHasDonated(true);
    setShowDonateModal(false);
    setMobileMenuOpen(false);
    window.dispatchEvent(new CustomEvent('eg-donation-completed', { detail: amount }));
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full shrink-0 h-16 flex items-center justify-between gap-8 px-4 sm:px-8 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        {/* Zone 1: Brand Wordmark */}
        <Link
          to="/"
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-xs group-hover:bg-indigo-700 transition-colors">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            EnterpriseGrid
          </span>
          {!hasDonated && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-extrabold uppercase tracking-wider leading-none">
              PRO
            </span>
          )}
        </Link>

        {/* Zone 2: Primary Navigation Links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 text-sm font-medium">
          {NAV_LINKS.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-indigo-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[19px] h-0.5 bg-indigo-600 rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Mobile Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {!hasDonated && (
            <button
              type="button"
              onClick={() => setShowDonateModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
              title="Donate to support EnterpriseGrid and remove all PRO badges & donation notifications"
            >
              <Heart className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Donate · Remove PRO</span>
            </button>
          )}

          {isDocsPage && (
            <button
              type="button"
              className="md:hidden p-2 text-indigo-600 hover:text-indigo-800 transition-colors flex items-center justify-center bg-indigo-50 hover:bg-indigo-100 rounded-lg whitespace-nowrap shrink-0"
              onClick={handleToggleSidebar}
              aria-label={docsSidebarOpen ? 'Close documentation sidebar' : 'Open documentation sidebar'}
              aria-expanded={docsSidebarOpen}
              id="mobile-sidebar-toggle-btn"
            >
              {docsSidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeftOpen className="w-5 h-5" />
              )}
            </button>
          )}

          <Link
            to={isDocsPage ? '/api' : '/docs'}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {isDocsPage ? 'API Reference' : 'Get Started'}
          </Link>

          <button
            type="button"
            className="md:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 transition-colors rounded-lg"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              className="absolute top-16 left-0 w-full bg-white border-b border-slate-200 shadow-lg md:hidden flex flex-col py-4 px-6 gap-2 z-50"
            >
              {NAV_LINKS.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="h-px bg-slate-100 my-1" />
              {!hasDonated && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowDonateModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-sm font-bold hover:bg-amber-100 transition-colors"
                >
                  <Heart className="w-4 h-4 text-amber-600 fill-amber-500" />
                  <span>Donate · Remove PRO Badges</span>
                </button>
              )}
              <Link
                to={isDocsPage ? '/api' : '/docs'}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                {isDocsPage ? 'API Reference' : 'Get Started'}
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Global Donation Modal */}
      <AnimatePresence>
        {showDonateModal && !hasDonated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
            onClick={() => setShowDonateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5" />
                  <h3 className="font-display font-bold text-base">Support EnterpriseGrid Pro</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDonateModal(false)}
                  aria-label="Close donation modal"
                  className="text-white/80 hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  All <span className="font-semibold text-slate-900">EnterpriseGrid Pro</span> features (AI Query, Insights, Multi-View, Time Travel, Audit Trail, Universal LLM, and CSV Import) are 100% unlocked for you to use. Donate once to support open-source development and permanently remove all <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold uppercase">PRO</span> badges and notifications.
                </p>

                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { amount: 5, label: 'Supporter', desc: 'Buy a coffee' },
                    { amount: 15, label: 'Pro Dev', desc: 'Most popular' },
                    { amount: 49, label: 'Team Sponsor', desc: 'Full team love' },
                  ].map((tier) => (
                    <button
                      key={tier.amount}
                      type="button"
                      onClick={() => setSelectedTier(tier.amount)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedTier === tier.amount
                          ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="text-lg font-extrabold text-slate-900">${tier.amount}</div>
                      <div className="text-xs font-bold text-amber-800 mt-0.5">{tier.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{tier.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800">What happens after donating:</div>
                  <div>• Immediately removes all PRO badges from DataTable & Docs</div>
                  <div>• Permanently hides donation reminder notifications</div>
                  <div>• Keeps all 45+ Enterprise & AI features unlocked forever</div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDonateModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Maybe Later
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCompleteDonation(selectedTier)}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg shadow-sm transition-all cursor-pointer"
                  >
                    Donate ${selectedTier} & Remove PRO Badges
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
