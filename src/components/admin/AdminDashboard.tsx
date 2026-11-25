import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  ArrowLeft,
  Ban,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FolderKanban,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageCircle,
  Package,
  Palette,
  Radio,
  ShieldAlert,
  Truck,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../../lib/firebase';
import {
  checkIsAdmin,
  seedDefaultsIfNeeded,
  subscribeAllOrders,
  syncPhoneIndexesForAdmin,
} from '../../services/firebaseService';
import type { GalleryItem, OrderRecord, ServiceItem, SiteSettings } from '../../types/design';
import {
  computeAdminOrderStats,
  detectAdminOrderEvents,
  type AdminNotificationItem,
} from '../../utils/adminStats';
import { playNotificationChime, showBrowserNotification } from '../../utils/soundPlayer';
import { AdminOrdersPanel, type AdminOrdersFilterMode } from './AdminOrdersPanel';
import { AdminServicesPanel } from './AdminServicesPanel';
import { AdminSettingsAndGalleryPanel } from './AdminSettingsAndGalleryPanel';

type AdminSectionId =
  | 'overview'
  | 'all-orders'
  | 'new-orders'
  | 'pending-orders'
  | 'payment-pending-orders'
  | 'payment-received-orders'
  | 'designing-orders'
  | 'completed-orders'
  | 'delivered-orders'
  | 'cancelled-orders'
  | 'manage-services'
  | 'manage-categories'
  | 'manage-prices'
  | 'design-gallery'
  | 'customer-details'
  | 'payment-settings'
  | 'whatsapp-settings'
  | 'website-settings';

const ADMIN_SOUND_KEY = 'gd_admin_sound_on';

const ADMIN_SECTIONS: Array<{ id: AdminSectionId; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Dashboard Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'all-orders', label: 'All Orders', icon: <Package className="w-4 h-4" /> },
  { id: 'new-orders', label: 'New Orders', icon: <Clock className="w-4 h-4" /> },
  { id: 'pending-orders', label: 'Pending Orders', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'designing-orders', label: 'Designing Orders', icon: <Palette className="w-4 h-4" /> },
  { id: 'completed-orders', label: 'Completed Orders', icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: 'delivered-orders', label: 'Delivered Orders', icon: <Truck className="w-4 h-4" /> },
  { id: 'cancelled-orders', label: 'Cancelled Orders', icon: <Ban className="w-4 h-4" /> },
  { id: 'manage-services', label: 'Manage Services', icon: <FolderKanban className="w-4 h-4" /> },
  { id: 'manage-categories', label: 'Manage Categories', icon: <Layers className="w-4 h-4" /> },
  { id: 'manage-prices', label: 'Manage Prices', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'design-gallery', label: 'Design Gallery', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'customer-details', label: 'Customer Details', icon: <Users className="w-4 h-4" /> },
  { id: 'payment-settings', label: 'Payment Settings', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'whatsapp-settings', label: 'WhatsApp Settings', icon: <MessageCircle className="w-4 h-4" /> },
  { id: 'website-settings', label: 'Website Settings', icon: <Globe className="w-4 h-4" /> },
];

interface AdminDashboardProps {
  services: ServiceItem[];
  gallery: GalleryItem[];
  settings: SiteSettings;
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  services,
  gallery,
  settings,
  onExitAdmin,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [didBackfillPhones, setDidBackfillPhones] = useState(false);

  // Live notification & sound states
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [toastAlert, setToastAlert] = useState<AdminNotificationItem | null>(null);
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(ADMIN_SOUND_KEY);
      return saved !== 'false';
    } catch {
      return true;
    }
  });
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'unsupported'
  );

  const prevOrdersRef = useRef<OrderRecord[]>([]);
  const initialOrdersLoadedRef = useRef<boolean>(false);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    try {
      window.localStorage.setItem(ADMIN_SOUND_KEY, String(soundEnabled));
    } catch {
      // Ignore storage failures
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (!toastAlert) return;
    const timer = window.setTimeout(() => setToastAlert(null), 7000);
    return () => window.clearTimeout(timer);
  }, [toastAlert]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAdminUser(false);
        setAuthReady(true);
        return;
      }
      try {
        const allowed = await checkIsAdmin(currentUser.uid, currentUser.email);
        setIsAdminUser(allowed);
        if (allowed) {
          void seedDefaultsIfNeeded(false);
        }
      } catch {
        setIsAdminUser(false);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !isAdminUser) return;
    initialOrdersLoadedRef.current = false;
    prevOrdersRef.current = [];
    setOrdersError(null);

    const unsub = subscribeAllOrders(
      (list) => {
        if (initialOrdersLoadedRef.current) {
          const events = detectAdminOrderEvents(prevOrdersRef.current, list);
          if (events.length > 0) {
            setNotifications((prev) => [...events, ...prev].slice(0, 30));
            const newest = events[0];
            setToastAlert(newest);
            if (soundEnabledRef.current) {
              playNotificationChime(
                newest.type === 'NEW PAYMENT RECEIVED' ? 'payment' : 'order'
              );
            }
            showBrowserNotification(newest.title, newest.message);
          }
        }
        initialOrdersLoadedRef.current = true;
        prevOrdersRef.current = list;
        setOrders(list);
        setOrdersError(null);

        if (!didBackfillPhones && list.length > 0) {
          setDidBackfillPhones(true);
          void syncPhoneIndexesForAdmin(list);
        }
      },
      () => setOrdersError('Could not stream orders from Firestore. Retrying automatically...')
    );
    return () => unsub();
  }, [authReady, isAdminUser, didBackfillPhones]);

  const stats = useMemo(() => computeAdminOrderStats(orders, services), [orders, services]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) {
        playNotificationChime('order');
      }
      return next;
    });
  };

  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await window.Notification.requestPermission();
      setPushPermission(res);
    } catch {
      // Ignore blocked prompts
    }
  };

  const handleOpenNotification = (notif: AdminNotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    setNotifDrawerOpen(false);
    setToastAlert(null);
    setActiveSection('all-orders');
    setFocusOrderId(notif.orderId);
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google sign-in popup was closed or blocked.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-slate-300">
        Verifying admin session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="gd-card rounded-3xl p-7 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#06142E] border border-[#35AFFF]/40 flex items-center justify-center text-[#FFD369]">
            <Lock className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display font-extrabold text-2xl text-[#FFD369]">
              Admin Dashboard Login
            </h2>
            <p className="text-sm text-slate-300">
              Sign in with your authorized Google Admin account to manage orders, services, pricing, and website settings.
            </p>
          </div>

          {authError && (
            <p role="alert" className="text-xs text-rose-300">
              {authError}
            </p>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="gd-glow-btn-gold w-full min-h-[48px] rounded-xl font-bold text-sm cursor-pointer"
          >
            Sign in with Google
          </button>

          <button
            type="button"
            onClick={onExitAdmin}
            className="text-xs text-[#35AFFF] hover:text-[#FFD369] inline-flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Return to Website
          </button>
        </div>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="gd-card rounded-3xl p-7 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-400/40 flex items-center justify-center text-rose-300">
            <ShieldAlert className="w-7 h-7" aria-hidden="true" />
          </div>
          <h2 className="font-display font-bold text-xl text-[#FFD369]">
            Admin Authorization Required
          </h2>
          <p className="text-sm text-slate-300">
            Signed in as <strong className="text-white">{user.email}</strong>. This account does not have admin privileges.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="gd-glow-btn-blue px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
            >
              Switch Account
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="gd-glow-btn-gold px-4 py-2 rounded-xl text-sm font-bold cursor-pointer"
            >
              Back to Site
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statCards: Array<{
    label: string;
    value: number;
    section: AdminSectionId;
    accent?: string;
  }> = [
    { label: 'Total Orders', value: stats.totalOrders, section: 'all-orders' },
    { label: 'New Orders', value: stats.newOrders, section: 'new-orders' },
    { label: 'Pending Orders', value: stats.pendingOrders, section: 'pending-orders' },
    { label: 'Payment Pending', value: stats.paymentPending, section: 'payment-pending-orders', accent: 'text-amber-300' },
    { label: 'Payment Received', value: stats.paymentReceived, section: 'payment-received-orders', accent: 'text-emerald-300' },
    { label: 'Designing', value: stats.designing, section: 'designing-orders', accent: 'text-[#35AFFF]' },
    { label: 'Completed', value: stats.completed, section: 'completed-orders', accent: 'text-emerald-300' },
    { label: 'Delivered', value: stats.delivered, section: 'delivered-orders', accent: 'text-emerald-300' },
    { label: 'Cancelled', value: stats.cancelled, section: 'cancelled-orders', accent: 'text-rose-300' },
  ];

  const filterModeForSection: Record<string, AdminOrdersFilterMode> = {
    'all-orders': 'ALL',
    'new-orders': 'NEW',
    'pending-orders': 'PENDING',
    'payment-pending-orders': 'PAYMENT_PENDING',
    'payment-received-orders': 'PAYMENT_RECEIVED',
    'designing-orders': 'DESIGNING',
    'completed-orders': 'COMPLETED',
    'delivered-orders': 'DELIVERED',
    'cancelled-orders': 'CANCELLED',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Live Notification Toast */}
      {toastAlert && (
        <div
          role="alert"
          className="fixed top-4 right-4 z-50 max-w-sm w-[calc(100%-2rem)] gd-card rounded-2xl p-4 border-[#FFD369] shadow-[0_0_28px_rgba(255,211,105,0.28)] flex items-start gap-3"
        >
          <BellRing className="w-5 h-5 text-[#FFD369] shrink-0 mt-0.5 animate-bounce" aria-hidden="true" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#FFD369]">
              {toastAlert.title}
            </p>
            <p className="text-xs text-white leading-snug">{toastAlert.message}</p>
            <button
              type="button"
              onClick={() => handleOpenNotification(toastAlert)}
              className="text-[11px] font-bold text-[#35AFFF] hover:underline cursor-pointer"
            >
              Open Order →
            </button>
          </div>
          <button
            type="button"
            onClick={() => setToastAlert(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Admin Bar */}
      <div className="gd-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 relative">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#FFD369]">
              gurudev_designs Admin Panel
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-400/35 px-2 py-0.5 rounded-lg">
              <Radio className="w-3 h-3 animate-pulse" aria-hidden="true" />
              Live Sync ({stats.totalServices} Services)
            </span>
          </div>
          <p className="text-xs text-slate-300">Signed in as {user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Notification Sound Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            aria-label={`Notification Sound ${soundEnabled ? 'ON' : 'OFF'}`}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
              soundEnabled
                ? 'bg-[#06142E] border-[#FFD369]/50 text-[#FFD369]'
                : 'bg-[#06142E] border-[#35AFFF]/30 text-slate-400'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Sound: {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Optional Browser Push Notification */}
          {pushPermission !== 'unsupported' && pushPermission !== 'denied' && (
            <button
              type="button"
              onClick={handleRequestPushPermission}
              disabled={pushPermission === 'granted'}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                pushPermission === 'granted'
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                  : 'bg-[#06142E] border-[#35AFFF]/35 text-[#35AFFF] hover:text-[#FFD369] cursor-pointer'
              }`}
            >
              <Bell className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{pushPermission === 'granted' ? 'Push Active' : 'Enable Push'}</span>
            </button>
          )}

          {/* Live Notifications Bell */}
          <button
            type="button"
            onClick={() => setNotifDrawerOpen((o) => !o)}
            aria-label="Open live notifications"
            className="relative px-3 py-2 rounded-xl bg-[#06142E] border border-[#35AFFF]/40 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <BellRing
              className={`w-3.5 h-3.5 ${unreadCount > 0 ? 'text-[#FFD369]' : 'text-[#35AFFF]'}`}
              aria-hidden="true"
            />
            <span>Alerts</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#FFD369] text-[#06142E] font-mono-tabular text-[10px] font-extrabold">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onExitAdmin}
            className="gd-glow-btn-blue px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            View Website
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-400/40 text-xs font-semibold text-rose-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Sign Out
          </button>
        </div>

        {/* Live Admin Notification Center Drawer */}
        {notifDrawerOpen && (
          <div className="w-full mt-2 pt-3 border-t border-[#35AFFF]/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#FFD369]">
                Live Studio Notifications ({notifications.length})
              </p>
              <div className="flex items-center gap-3 text-[11px]">
                {notifications.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                      }
                      className="text-[#35AFFF] hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifications([])}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400">
                Listening in real time for new orders, verified payments, failed payments, cancellations, and custom requests.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(n)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-3 cursor-pointer ${
                        n.read
                          ? 'bg-[#06142E]/50 border-[#35AFFF]/15 text-slate-300'
                          : 'bg-[#06142E] border-[#FFD369]/45 text-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-[#FFD369] mr-2">{n.title}</span>
                        <span className="truncate">{n.message}</span>
                      </div>
                      <span className="text-[10px] text-[#35AFFF] font-mono-tabular shrink-0">
                        {new Date(n.createdAtMs).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {ordersError && (
        <div role="alert" className="rounded-2xl bg-rose-500/15 border border-rose-400/50 p-3 text-xs text-rose-200">
          {ordersError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 gd-card rounded-2xl p-3 space-y-1">
          {ADMIN_SECTIONS.map((sec) => {
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`w-full px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#FFD369] text-[#06142E] font-bold'
                    : 'text-slate-200 hover:bg-[#06142E]/70 hover:text-[#35AFFF]'
                }`}
              >
                {sec.icon}
                <span>{sec.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Content Panel */}
        <div className="lg:col-span-9 space-y-6">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* All 9 Live Dashboard Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {statCards.map((stat) => (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => setActiveSection(stat.section)}
                    className="gd-card rounded-2xl p-4 sm:p-5 text-left space-y-1 hover:border-[#FFD369]/60 transition-colors cursor-pointer"
                  >
                    <p className="text-xs text-slate-300 font-medium">{stat.label}</p>
                    <p
                      className={`font-mono-tabular text-2xl sm:text-3xl font-extrabold ${
                        stat.accent || 'text-[#FFD369]'
                      }`}
                    >
                      {stat.value}
                    </p>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <h2 className="font-display font-bold text-lg text-white">
                  Recent Live Orders (Newest First)
                </h2>
                <AdminOrdersPanel
                  orders={orders.slice(0, 10)}
                  services={services}
                  statusFilterMode="ALL"
                  focusOrderId={focusOrderId}
                  onClearFocusOrder={() => setFocusOrderId(null)}
                />
              </div>
            </div>
          )}

          {filterModeForSection[activeSection] && (
            <AdminOrdersPanel
              orders={orders}
              services={services}
              statusFilterMode={filterModeForSection[activeSection]}
              focusOrderId={focusOrderId}
              onClearFocusOrder={() => setFocusOrderId(null)}
            />
          )}

          {activeSection === 'manage-services' && (
            <AdminServicesPanel services={services} settings={settings} mode="services" />
          )}
          {activeSection === 'manage-prices' && (
            <AdminServicesPanel services={services} settings={settings} mode="prices" />
          )}
          {activeSection === 'manage-categories' && (
            <AdminSettingsAndGalleryPanel
              section="categories"
              gallery={gallery}
              orders={orders}
              settings={settings}
            />
          )}

          {activeSection === 'design-gallery' && (
            <AdminSettingsAndGalleryPanel
              section="gallery"
              gallery={gallery}
              orders={orders}
              settings={settings}
            />
          )}
          {activeSection === 'customer-details' && (
            <AdminSettingsAndGalleryPanel
              section="customers"
              gallery={gallery}
              orders={orders}
              settings={settings}
            />
          )}
          {activeSection === 'payment-settings' && (
            <AdminSettingsAndGalleryPanel
              section="payment"
              gallery={gallery}
              orders={orders}
              settings={settings}
            />
          )}
          {activeSection === 'whatsapp-settings' && (
            <AdminSettingsAndGalleryPanel
              section="whatsapp"
              gallery={gallery}
              orders={orders}
              settings={settings}
            />
          )}
          {activeSection === 'website-settings' && (
            <AdminSettingsAndGalleryPanel
              section="website"
              gallery={gallery}
              orders={orders}
              settings={settings}
            />
          )}
        </div>
      </div>
    </div>
  );
};
