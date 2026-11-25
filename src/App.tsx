import React, { useEffect, useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import { AboutUsSection } from './components/AboutUsSection';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ConfirmOrderPage } from './components/ConfirmOrderPage';
import { ContactSection } from './components/ContactSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GallerySection } from './components/GallerySection';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { InfoAndPolicyPages } from './components/InfoAndPolicyPages';
import { OrderAndPaymentPage } from './components/OrderAndPaymentPage';
import { OrderTrackingSection } from './components/OrderTrackingSection';
import { ServiceDetailModal } from './components/ServiceDetailModal';
import { ServicesSection } from './components/ServicesSection';
import { DEFAULT_SITE_SETTINGS, SEED_GALLERY, SEED_SERVICES } from './data/seedCatalog';
import {
  subscribeGallery,
  subscribeServices,
  subscribeSiteSettings,
} from './services/firebaseService';
import type {
  AppView,
  ConfirmedOrderSummary,
  GalleryItem,
  ServiceCategory,
  ServiceItem,
  SiteSettings,
} from './types/design';

function getInitialView(): AppView {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path.startsWith('/admin') || hash === '#admin') return 'admin';
  if (hash === '#services') return 'services';
  if (hash === '#my-orders' || hash === '#orders') return 'my-orders';
  if (hash === '#gallery') return 'gallery';
  if (hash === '#about') return 'about';
  if (hash === '#contact') return 'contact';
  return 'home';
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>(getInitialView);
  const [services, setServices] = useState<ServiceItem[]>(SEED_SERVICES);
  const [gallery, setGallery] = useState<GalleryItem[]>(SEED_GALLERY);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'ALL'>('ALL');
  const [detailService, setDetailService] = useState<ServiceItem | null>(null);
  const [selectedOrderService, setSelectedOrderService] = useState<ServiceItem | null>(null);
  const [latestConfirmedOrder, setLatestConfirmedOrder] =
    useState<ConfirmedOrderSummary | null>(null);

  const [myOrdersMobile, setMyOrdersMobile] = useState('');
  const [myOrdersAutoTriggerKey, setMyOrdersAutoTriggerKey] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [listenerEpoch, setListenerEpoch] = useState(0);

  const autoWaAnchorRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    setSyncError(null);
    const unsubServices = subscribeServices(setServices, () => {
      setSyncError('Live catalog connection interrupted. Tap Retry to reconnect.');
    });
    const unsubGallery = subscribeGallery(setGallery, () => {
      setSyncError('Live gallery connection interrupted. Tap Retry to reconnect.');
    });
    const unsubSettings = subscribeSiteSettings(setSettings, () => {
      setSyncError('Live settings connection interrupted. Tap Retry to reconnect.');
    });

    return () => {
      unsubServices();
      unsubGallery();
      unsubSettings();
    };
  }, [listenerEpoch]);

  const navigateTo = (view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectMenuDestination = (view: AppView, category?: ServiceCategory | 'ALL') => {
    if (category !== undefined) {
      setSelectedCategory(category);
    } else if (view === 'services') {
      setSelectedCategory('ALL');
    }
    navigateTo(view);
  };

  const handleStartOrder = (service: ServiceItem) => {
    setSelectedOrderService(service);
    navigateTo('order-form');
  };

  const handleOrderConfirmed = (summary: ConfirmedOrderSummary) => {
    setLatestConfirmedOrder(summary);
    setMyOrdersMobile(summary.mobile);
    navigateTo('confirm');

    // Safely open prefilled WhatsApp message via declarative anchor click
    setTimeout(() => {
      autoWaAnchorRef.current?.click();
    }, 150);
  };

  const handleGoToMyOrders = (prefillMobile?: string) => {
    if (prefillMobile) {
      setMyOrdersMobile(prefillMobile);
      setMyOrdersAutoTriggerKey((k) => k + 1);
    }
    navigateTo('my-orders');
  };

  const enabledCount = services.filter((s) => s.enabled).length;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#06142E] text-white flex flex-col">
        {activeView !== 'admin' && (
          <Header
            activeView={activeView}
            settings={settings}
            onNavigate={navigateTo}
            onSelectMenuDestination={handleSelectMenuDestination}
          />
        )}

        <main className="flex-1 pt-4 sm:pt-6 pb-24">
          {syncError && (
            <div
              role="alert"
              className="max-w-7xl mx-auto px-4 sm:px-6 mb-4"
            >
              <div className="rounded-2xl bg-amber-500/15 border border-amber-400/45 px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm text-amber-200">
                <span>{syncError}</span>
                <button
                  type="button"
                  onClick={() => setListenerEpoch((e) => e + 1)}
                  className="px-3 py-1 rounded-lg bg-[#FFD369] text-[#06142E] font-bold text-xs cursor-pointer shrink-0"
                >
                  Retry Sync
                </button>
              </div>
            </div>
          )}
          {/* HOME */}
          {activeView === 'home' && (
            <HeroSection
              settings={settings}
              services={services}
              onExploreServices={() => handleSelectMenuDestination('services', 'ALL')}
              onPlaceOrder={() => handleSelectMenuDestination('services', 'ALL')}
              onSelectCategory={(cat) => handleSelectMenuDestination('services', cat)}
            />
          )}

          {/* CREATE ORDER -> DESIGN SERVICES SELECTION (45 SERVICES / 6 CATEGORIES) */}
          {activeView === 'services' && (
            <ServicesSection
              services={services}
              settings={settings}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              onViewDetails={setDetailService}
              onOrderService={handleStartOrder}
            />
          )}

          {/* TWO-STEP ORDER FORM & PAYMENT SCREEN (kept mounted across both steps to preserve form/files) */}
          {(activeView === 'order-form' || activeView === 'payment') && (
            <OrderAndPaymentPage
              step={activeView === 'payment' ? 'payment' : 'order-form'}
              selectedService={selectedOrderService}
              services={services}
              settings={settings}
              onBackToServices={() => handleSelectMenuDestination('services', 'ALL')}
              onProceedToPayment={() => navigateTo('payment')}
              onBackToOrderForm={() => navigateTo('order-form')}
              onOrderConfirmed={handleOrderConfirmed}
            />
          )}

          {/* ORDER CONFIRMATION SCREEN */}
          {activeView === 'confirm' && (
            <ConfirmOrderPage
              latestOrder={latestConfirmedOrder}
              settings={settings}
              onGoToMyOrders={handleGoToMyOrders}
              onBackToHome={() => navigateTo('home')}
            />
          )}

          {/* MY ORDERS (WHATSAPP MOBILE NUMBER LIVE TRACKING) */}
          {activeView === 'my-orders' && (
            <OrderTrackingSection
              initialMobile={myOrdersMobile}
              autoTriggerKey={myOrdersAutoTriggerKey}
              settings={settings}
              onCreateOrder={() => handleSelectMenuDestination('services', 'ALL')}
            />
          )}

          {/* MENU PAGES: GALLERY, ABOUT US, CONTACT US, PAYMENT INFO, TERMS, PRIVACY, REFUND */}
          {activeView === 'gallery' && (
            <GallerySection
              items={gallery}
              onOrderSimilar={() => handleSelectMenuDestination('services', 'ALL')}
            />
          )}

          {activeView === 'about' && (
            <AboutUsSection
              settings={settings}
              serviceCount={enabledCount}
              onExploreServices={() => handleSelectMenuDestination('services', 'ALL')}
              onPlaceOrder={() => handleSelectMenuDestination('services', 'ALL')}
            />
          )}

          {activeView === 'contact' && (
            <ContactSection
              settings={settings}
              onPlaceOrder={() => handleSelectMenuDestination('services', 'ALL')}
            />
          )}

          {(activeView === 'payment-info' ||
            activeView === 'terms' ||
            activeView === 'privacy' ||
            activeView === 'refund') && (
            <InfoAndPolicyPages
              page={activeView}
              settings={settings}
              onCreateOrder={() => handleSelectMenuDestination('services', 'ALL')}
            />
          )}

          {/* SECURE ADMIN PANEL */}
          {activeView === 'admin' && (
            <AdminDashboard
              services={services}
              gallery={gallery}
              settings={settings}
              onExitAdmin={() => navigateTo('home')}
            />
          )}
        </main>

        {/* Hidden declarative WhatsApp redirect anchor triggered safely after order confirmation */}
        {latestConfirmedOrder && (
          <a
            ref={autoWaAnchorRef}
            href={latestConfirmedOrder.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          >
            Open WhatsApp Order Summary
          </a>
        )}

        {activeView !== 'admin' && (
          <footer className="border-t border-[#35AFFF]/20 bg-[#051026] py-6 pb-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-400">
              <p>
                &copy; {new Date().getFullYear()}{' '}
                <span className="text-[#FFD369] font-semibold">
                  {settings.brandName || 'gurudev_designs'}
                </span>
                . Creative Designs · Quality Work · Affordable Prices.
              </p>

              <div className="flex flex-wrap items-center gap-4 sm:gap-5">
                <button
                  type="button"
                  onClick={() => navigateTo('home')}
                  className="hover:text-white cursor-pointer"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMenuDestination('services', 'ALL')}
                  className="hover:text-white cursor-pointer"
                >
                  Services
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('my-orders')}
                  className="hover:text-white cursor-pointer"
                >
                  My Orders
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('terms')}
                  className="hover:text-white cursor-pointer"
                >
                  Terms
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('admin')}
                  className="text-[#35AFFF] hover:text-[#FFD369] inline-flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  Admin Login
                </button>
              </div>
            </div>
          </footer>
        )}

        <ServiceDetailModal
          service={detailService}
          onClose={() => setDetailService(null)}
          onOrderNow={handleStartOrder}
        />
      </div>
    </ErrorBoundary>
  );
}
