import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  Images,
  Info,
  LayoutGrid,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Shield,
  X,
} from 'lucide-react';
import type { AppView, MenuItemKey, ServiceCategory, SiteSettings } from '../types/design';
import { getActiveMenuKey, getVisibleMenuItems, type MenuDefinition } from '../utils/menuConfig';
import { buildWhatsAppUrl } from '../utils/orderUtils';
import { resolveAssetUrl } from '../utils/assetUrl';

interface HeaderProps {
  activeView: AppView;
  settings: SiteSettings;
  onNavigate: (view: AppView) => void;
  onSelectMenuDestination: (view: AppView, category?: ServiceCategory | 'ALL') => void;
}

const MENU_ICONS: Partial<Record<MenuItemKey, React.ReactNode>> = {
  home: <Home className="w-4 h-4 shrink-0" aria-hidden="true" />,
  allServices: <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden="true" />,
  gallery: <Images className="w-4 h-4 shrink-0" aria-hidden="true" />,
  orders: <ClipboardList className="w-4 h-4 shrink-0" aria-hidden="true" />,
  about: <Info className="w-4 h-4 shrink-0" aria-hidden="true" />,
  contact: <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />,
  whatsapp: <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />,
  paymentInfo: <CreditCard className="w-4 h-4 shrink-0" aria-hidden="true" />,
  terms: <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />,
  privacy: <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />,
  refund: <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />,
  admin: <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />,
};

export const Header: React.FC<HeaderProps> = ({
  activeView,
  settings,
  onNavigate,
  onSelectMenuDestination,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleMenuItems = getVisibleMenuItems(settings.menuVisibility);
  const activeMenuKey = getActiveMenuKey(activeView);

  const directWaUrl = buildWhatsAppUrl(
    settings.whatsappNumber || '916353894486',
    `Hello ${settings.brandName || 'gurudev_designs'}, I need help with a design order.`
  );

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const handleDrawerItemClick = (item: MenuDefinition) => {
    setDrawerOpen(false);
    if (item.view) {
      onSelectMenuDestination(item.view, item.category);
    }
  };

  const isMyOrdersActive = activeView === 'my-orders' || activeView === 'confirm';
  const isCreateOrderActive =
    activeView === 'services' || activeView === 'order-form' || activeView === 'payment';

  return (
    <>
      {/* Compact Top Brand Header (48px) */}
      <header className="sticky top-0 z-40 bg-[#06142E]/95 backdrop-blur-md border-b border-[#35AFFF]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#35AFFF] rounded-lg"
          >
            {settings.logoUrl ? (
              <img
                src={resolveAssetUrl(settings.logoUrl)}
                alt={settings.brandName || 'gurudev_designs'}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-lg object-cover border border-[#35AFFF]/40"
              />
            ) : (
              <span
                className="w-7 h-7 rounded-lg bg-[#10264B] border border-[#35AFFF]/50 flex items-center justify-center text-[#FFD369] font-display font-extrabold text-xs shadow-[0_0_10px_rgba(53,175,255,0.22)]"
                aria-hidden="true"
              >
                GD
              </span>
            )}
            <span className="font-display font-extrabold text-base sm:text-lg tracking-tight text-[#FFD369]">
              {settings.brandName || 'gurudev_designs'}
            </span>
          </button>

          <p className="hidden sm:block text-xs text-slate-300 font-medium truncate">
            {settings.bannerSubtitle || 'YOUR CREATIVE DESIGN PARTNER'}
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onSelectMenuDestination('services', 'ALL')}
              className="hidden md:inline-flex text-xs font-semibold text-slate-200 hover:text-[#FFD369] transition-colors cursor-pointer"
            >
              All Services
            </button>
            <button
              type="button"
              onClick={() => onNavigate('gallery')}
              className="hidden md:inline-flex text-xs font-semibold text-slate-200 hover:text-[#FFD369] transition-colors cursor-pointer"
            >
              Gallery
            </button>
            <a
              href={directWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#35AFFF] hover:text-[#FFD369] inline-flex items-center gap-1 whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Support</span>
            </a>
          </div>
        </div>
      </header>

      {/* Slide-Out Menu Backdrop */}
      <div
        aria-hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 z-50 bg-[#020817]/75 backdrop-blur-xs transition-opacity duration-200 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Slide-Out Menu Drawer from Right Side */}
      <aside
        id="site-slide-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Website Menu"
        aria-hidden={!drawerOpen}
        className={`fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[86vw] bg-[#06142E] border-l border-[#35AFFF]/45 shadow-[0_0_36px_rgba(53,175,255,0.28)] flex flex-col transition-[transform,visibility] duration-200 ease-out ${
          drawerOpen ? 'translate-x-0 visible pointer-events-auto' : 'translate-x-full invisible pointer-events-none'
        }`}
      >
        <div className="px-4 py-3 border-b border-[#35AFFF]/25 bg-[#10264B]/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {settings.logoUrl ? (
              <img
                src={resolveAssetUrl(settings.logoUrl)}
                alt={settings.brandName || 'gurudev_designs'}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-xl object-cover border border-[#35AFFF]/45 shrink-0"
              />
            ) : (
              <span
                className="w-8 h-8 rounded-xl bg-[#06142E] border border-[#35AFFF]/50 flex items-center justify-center text-[#FFD369] font-display font-extrabold text-xs shrink-0"
                aria-hidden="true"
              >
                GD
              </span>
            )}
            <div className="min-w-0">
              <p className="font-display font-extrabold text-sm text-[#FFD369] truncate">
                {settings.brandName || 'gurudev_designs'}
              </p>
              <p className="text-[11px] text-slate-300 truncate">Menu &amp; Quick Navigation</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="min-h-[40px] min-w-[40px] rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-slate-200 hover:text-[#FFD369] hover:border-[#FFD369] inline-flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Slide-in Navigation Menu"
          className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1"
        >
          {visibleMenuItems.map((item, idx) => {
            const isSelected = !item.externalWhatsApp && activeMenuKey === item.key;
            const prevGroup = idx > 0 ? visibleMenuItems[idx - 1].group : item.group;
            const showDivider = item.group !== prevGroup && idx > 0;

            if (item.externalWhatsApp) {
              return (
                <React.Fragment key={item.key}>
                  {showDivider && (
                    <div className="my-2 border-t border-[#35AFFF]/20" aria-hidden="true" />
                  )}
                  <a
                    href={directWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setDrawerOpen(false)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center gap-3 text-sm font-medium text-white bg-[#10264B]/40 border border-transparent hover:bg-[#10264B] hover:border-[#35AFFF]/45 transition-colors"
                  >
                    <span className="text-[#FFD369]">{MENU_ICONS[item.key]}</span>
                    <span className="truncate">{item.label}</span>
                  </a>
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={item.key}>
                {showDivider && (
                  <div className="my-2 border-t border-[#35AFFF]/20" aria-hidden="true" />
                )}
                <button
                  type="button"
                  onClick={() => handleDrawerItemClick(item)}
                  aria-current={isSelected ? 'page' : undefined}
                  className={`w-full min-h-[42px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-sm transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#10264B] border border-[#35AFFF] text-[#FFD369] font-bold shadow-[0_0_16px_rgba(53,175,255,0.28)]'
                      : 'bg-[#10264B]/40 border border-transparent text-white font-medium hover:bg-[#10264B] hover:border-[#35AFFF]/45'
                  }`}
                >
                  <span className="text-[#FFD369]">{MENU_ICONS[item.key]}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="px-3.5 py-3 border-t border-[#35AFFF]/25 bg-[#10264B]/40 space-y-2">
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              onSelectMenuDestination('services', 'ALL');
            }}
            className="gd-glow-btn-gold w-full min-h-[44px] rounded-xl font-bold text-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Create Design Order
          </button>
          <p className="text-[11px] text-center text-slate-300 font-mono-tabular truncate">
            WhatsApp: +{settings.whatsappNumber || '916353894486'}
          </p>
        </div>
      </aside>

      {/* Fixed THREE-BUTTON WHITE BOTTOM NAVIGATION (My Orders | + Create Order | Menu) */}
      <nav
        aria-label="Bottom Navigation"
        data-testid="bottom-navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 shadow-[0_-8px_28px_rgba(3,10,24,0.38)]"
      >
        <div className="max-w-3xl mx-auto px-3 sm:px-6 h-16 grid grid-cols-3 items-center gap-2">
          {/* Button 1: My Orders */}
          <button
            type="button"
            data-testid="nav-my-orders"
            onClick={() => onNavigate('my-orders')}
            aria-current={isMyOrdersActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center h-full rounded-xl transition-colors cursor-pointer ${
              isMyOrdersActive
                ? 'text-[#1D7AFC]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-5 h-5" aria-hidden="true" />
            <span className={`text-[11px] sm:text-xs mt-1 whitespace-nowrap ${isMyOrdersActive ? 'font-bold' : 'font-semibold'}`}>
              My Orders
            </span>
          </button>

          {/* Button 2: Prominent Blue Rounded + Create Order in the Center */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              data-testid="nav-create-order"
              onClick={() => onSelectMenuDestination('services', 'ALL')}
              aria-current={isCreateOrderActive ? 'page' : undefined}
              className={`h-11 px-3.5 sm:px-5 rounded-2xl text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-[0_6px_18px_rgba(29,122,252,0.42)] active:scale-[0.98] ${
                isCreateOrderActive
                  ? 'bg-[#0E63DB] ring-2 ring-[#35AFFF]/60'
                  : 'bg-[#1D7AFC] hover:bg-[#1565D8]'
              }`}
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Create Order</span>
            </button>
          </div>

          {/* Button 3: Menu Hamburger */}
          <button
            type="button"
            data-testid="nav-menu"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="site-slide-menu"
            className={`flex flex-col items-center justify-center h-full rounded-xl transition-colors cursor-pointer ${
              drawerOpen ? 'text-[#1D7AFC]' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
            <span className={`text-[11px] sm:text-xs mt-1 whitespace-nowrap ${drawerOpen ? 'font-bold' : 'font-semibold'}`}>
              Menu
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
