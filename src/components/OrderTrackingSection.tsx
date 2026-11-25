import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Eye,
  Loader2,
  MessageCircle,
  PackageSearch,
  Plus,
  Radio,
  RefreshCw,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { subscribeOrdersByPhoneKey } from '../services/firebaseService';
import type { OrderTrackingRecord, SiteSettings } from '../types/design';
import {
  detectCustomerOrderEvents,
  type CustomerNotificationItem,
} from '../utils/adminStats';
import {
  buildWhatsAppUrl,
  formatPriceINR,
  getLiveOrderStepsState,
  normalizeMobileLast10,
} from '../utils/orderUtils';
import { playNotificationChime, showBrowserNotification } from '../utils/soundPlayer';

interface OrderTrackingSectionProps {
  initialMobile?: string;
  autoTriggerKey?: number;
  settings: SiteSettings;
  onCreateOrder: () => void;
}

const CUSTOMER_SOUND_KEY = 'gd_customer_sound_on';

function formatDate(ts: unknown): string {
  if (!ts) return 'Just now';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    const d = (ts as { toDate: () => Date }).toDate();
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return String(ts);
}

function getNotificationBadgeClass(type: CustomerNotificationItem['type']): string {
  if (type === 'Order Cancelled') return 'bg-rose-500/20 text-rose-200 border-rose-400/50';
  if (type === 'Order Delivered' || type === 'Design Completed') {
    return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50';
  }
  if (type === 'Payment Verified') return 'bg-sky-500/20 text-sky-200 border-sky-400/50';
  return 'bg-[#FFD369]/20 text-[#FFD369] border-[#FFD369]/50';
}

export const OrderTrackingSection: React.FC<OrderTrackingSectionProps> = ({
  initialMobile = '',
  autoTriggerKey = 0,
  settings,
  onCreateOrder,
}) => {
  const [mobile, setMobile] = useState(initialMobile);
  const [honeypot, setHoneypot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedMobileLabel, setSearchedMobileLabel] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderTrackingRecord[]>([]);
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OrderTrackingRecord | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<CustomerNotificationItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(CUSTOMER_SOUND_KEY);
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

  const unsubRef = useRef<(() => void) | null>(null);
  const prevOrdersRef = useRef<OrderTrackingRecord[]>([]);
  const isFirstSnapshotRef = useRef<boolean>(true);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    try {
      window.localStorage.setItem(CUSTOMER_SOUND_KEY, String(soundEnabled));
    } catch {
      // Ignore storage failures
    }
  }, [soundEnabled]);

  const stopLiveListener = () => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopLiveListener();
    };
  }, []);

  const handleRequestPushNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const permission = await window.Notification.requestPermission();
      setPushPermission(permission);
    } catch {
      // Ignore blocked permission prompts
    }
  };

  const runPhoneLookup = async (rawMobile: string) => {
    setError(null);
    const last10 = normalizeMobileLast10(rawMobile);
    if (last10.length !== 10) {
      setError('Please enter a valid 10-digit WhatsApp mobile number.');
      return;
    }

    setLoading(true);
    setHasLoadedSnapshot(false);
    isFirstSnapshotRef.current = true;
    prevOrdersRef.current = [];
    setLiveAlerts([]);
    stopLiveListener();

    try {
      const res = await fetch('/api/orders/lookup-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: last10, honeypot }),
      });

      const data = (await res.json()) as {
        phoneKey?: string;
        maskedMobile?: string;
        error?: string;
      };

      if (!res.ok || !data.phoneKey) {
        setError(data.error || 'Unable to verify lookup request. Please try again.');
        setLoading(false);
        return;
      }

      setSearchedMobileLabel(data.maskedMobile || `+91 ${last10}`);
      unsubRef.current = subscribeOrdersByPhoneKey(
        data.phoneKey,
        (liveOrders) => {
          if (!isFirstSnapshotRef.current) {
            const newEvents = detectCustomerOrderEvents(prevOrdersRef.current, liveOrders);
            if (newEvents.length > 0) {
              setLiveAlerts((prev) => [...newEvents, ...prev].slice(0, 8));
              if (soundEnabledRef.current) {
                playNotificationChime('status');
              }
              const latest = newEvents[0];
              showBrowserNotification(`gurudev_designs · ${latest.type}`, latest.message);
            }
          }
          isFirstSnapshotRef.current = false;
          prevOrdersRef.current = liveOrders;
          setOrders(liveOrders);
          setHasLoadedSnapshot(true);
          setLoading(false);
        },
        () => {
          setError('Unable to stream live order updates right now. Please try again.');
          setLoading(false);
        }
      );
    } catch {
      setError('Network error while checking your orders. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialMobile) {
      setMobile(initialMobile);
    }
    if (autoTriggerKey > 0 && initialMobile) {
      void runPhoneLookup(initialMobile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMobile, autoTriggerKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runPhoneLookup(mobile);
  };

  return (
    <section
      id="my-orders-section"
      aria-labelledby="my-orders-heading"
      className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6"
    >
      {/* Clean MY ORDERS lookup card */}
      <div className="gd-card rounded-3xl p-5 sm:p-8 space-y-5">
        <div className="space-y-1.5 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#35AFFF]">
            Instant Live Order Lookup
          </p>
          <h1
            id="my-orders-heading"
            className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFD369]"
          >
            MY ORDERS
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Enter Your WhatsApp Mobile Number to view all your orders and live studio progress.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Hidden anti-automation honeypot field */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            aria-hidden="true"
            className="hidden"
          />

          <div className="space-y-1.5">
            <label htmlFor="my-orders-mobile" className="block text-xs sm:text-sm font-semibold text-white">
              Enter Your WhatsApp Mobile Number
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center h-12 rounded-2xl bg-[#06142E] border border-[#35AFFF]/40 focus-within:border-[#35AFFF] overflow-hidden">
                <span className="h-full px-3.5 bg-[#10264B] border-r border-[#35AFFF]/25 text-sm font-mono-tabular font-bold text-[#FFD369] inline-flex items-center shrink-0">
                  +91
                </span>
                <input
                  id="my-orders-mobile"
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 Mobile Number (e.g. 9876543210)"
                  className="w-full h-full px-3.5 bg-transparent text-sm sm:text-base font-mono-tabular text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="gd-glow-btn-gold h-12 px-6 rounded-2xl font-extrabold text-sm tracking-wide inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>LOADING...</span>
                  </>
                ) : (
                  <>
                    <PackageSearch className="w-4 h-4" aria-hidden="true" />
                    <span>VIEW MY ORDERS</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-rose-500/15 border border-rose-400/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
            >
              <p className="text-xs sm:text-sm text-rose-200 font-medium">{error}</p>
              <button
                type="button"
                onClick={() => void runPhoneLookup(mobile)}
                className="px-3 py-1 rounded-lg bg-[#06142E] border border-[#35AFFF]/40 text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          <p className="text-[11px] sm:text-xs text-slate-400 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#35AFFF] shrink-0" aria-hidden="true" />
            Privacy protected: only basic order summary and live status are displayed here.
          </p>
        </form>
      </div>

      {/* Live Orders Results */}
      {hasLoadedSnapshot && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <Radio className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
                Live Updates Active
              </span>
              {searchedMobileLabel && (
                <span className="text-xs text-slate-400 font-mono-tabular">
                  · {searchedMobileLabel}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                aria-label={soundEnabled ? 'Mute status sound' : 'Unmute status sound'}
                className="px-2.5 py-1.5 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-[11px] font-semibold text-slate-200 hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#FFD369]" aria-hidden="true" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                )}
                <span>Sound: {soundEnabled ? 'ON' : 'OFF'}</span>
              </button>

              {pushPermission !== 'unsupported' && pushPermission !== 'denied' && (
                <button
                  type="button"
                  onClick={handleRequestPushNotifications}
                  disabled={pushPermission === 'granted'}
                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1 ${
                    pushPermission === 'granted'
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-[#06142E] border-[#35AFFF]/35 text-[#35AFFF] hover:text-[#FFD369] cursor-pointer'
                  }`}
                >
                  {pushPermission === 'granted' ? (
                    <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {pushPermission === 'granted' ? 'Push Alerts Active' : 'Enable Push Alerts'}
                  </span>
                </button>
              )}

              <span className="text-xs font-semibold text-[#FFD369] ml-1">
                {orders.length} {orders.length === 1 ? 'Order' : 'Orders'} Found
              </span>
            </div>
          </div>

          {/* Real-Time Customer Order Status Notification Feed */}
          {liveAlerts.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className="gd-card rounded-2xl p-4 border-[#FFD369]/50 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FFD369]">
                  <BellRing className="w-4 h-4 animate-bounce" aria-hidden="true" />
                  <span>Live Order Notifications</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveAlerts([])}
                  className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Clear Alerts
                </button>
              </div>
              <ul className="space-y-2">
                {liveAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#06142E]/85 border border-[#35AFFF]/25 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold shrink-0 ${getNotificationBadgeClass(
                          alert.type
                        )}`}
                      >
                        {alert.type}
                      </span>
                      <span className="text-slate-100 truncate">{alert.message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="gd-card rounded-3xl p-8 text-center space-y-3" role="status">
              <p className="text-base sm:text-lg font-bold text-[#FFD369]">
                No Orders Found for {searchedMobileLabel}
              </p>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                Verify you entered the same WhatsApp mobile number used when placing your design order.
              </p>
              <button
                type="button"
                onClick={onCreateOrder}
                className="gd-glow-btn-gold min-h-[44px] px-5 py-2.5 rounded-2xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Create Your First Order
              </button>
            </div>
          ) : (
            <div className="space-y-4" data-testid="my-orders-list">
              {orders.map((order) => {
                const progress = getLiveOrderStepsState(order.status, order.paymentStatus);
                const amount =
                  typeof order.finalAmount === 'number'
                    ? order.finalAmount
                    : order.servicePrice || 0;

                return (
                  <article
                    key={order.orderId}
                    data-testid="my-order-card"
                    className="gd-card rounded-3xl p-4 sm:p-6 space-y-5"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#35AFFF]/20 pb-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-tabular text-sm sm:text-base font-extrabold text-[#FFD369]">
                            {order.orderId}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs text-slate-300">{formatDate(order.createdAt)}</span>
                        </div>
                        <h2 className="font-display font-bold text-base sm:text-lg text-white">
                          {order.serviceName}
                        </h2>
                        {order.customerName && (
                          <p className="text-xs text-slate-300">
                            Customer: <span className="text-white font-semibold">{order.customerName}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        <p className="font-mono-tabular text-lg sm:text-xl font-extrabold text-[#FFD369]">
                          {formatPriceINR(amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setDetailOrder(order)}
                          className="gd-glow-btn-blue px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#FFD369]" aria-hidden="true" />
                          View Details
                        </button>
                      </div>
                    </div>

                    {/* Status Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#06142E]/75 border border-[#35AFFF]/20 rounded-2xl p-3.5 text-xs sm:text-sm">
                      <div>
                        <p className="text-slate-400 text-xs">Payment Status</p>
                        <p
                          className={`font-bold mt-0.5 ${
                            order.paymentStatus === 'PAYMENT VERIFIED'
                              ? 'text-emerald-300'
                              : order.paymentStatus === 'PAYMENT REJECTED'
                                ? 'text-rose-300'
                                : 'text-[#FFD369]'
                          }`}
                        >
                          {order.paymentStatus || 'PAYMENT VERIFICATION PENDING'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs">Current Order Status</p>
                        <p className="font-bold text-[#35AFFF] mt-0.5">
                          {progress.friendlyLabel}
                        </p>
                      </div>
                    </div>

                    {/* 6-Step Live Order Progress */}
                    {progress.isCancelled ? (
                      <div className="rounded-2xl bg-rose-500/15 border border-rose-400/40 p-3.5 text-xs sm:text-sm text-rose-200">
                        This order has been cancelled. Contact our studio on WhatsApp if you need help.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-300">Order Progress</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {progress.steps.map((step, idx) => (
                            <div
                              key={step.label}
                              className={`rounded-2xl p-2.5 border text-[11px] sm:text-xs flex items-center gap-1.5 ${
                                step.active
                                  ? 'bg-[#35AFFF]/20 border-[#35AFFF] text-white font-bold shadow-[0_0_12px_rgba(53,175,255,0.2)]'
                                  : step.completed
                                    ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                                    : 'bg-[#06142E]/60 border-[#35AFFF]/15 text-slate-400'
                              }`}
                            >
                              <CheckCircle2
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  step.completed ? 'text-[#FFD369]' : 'text-slate-600'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="leading-tight">
                                {idx + 1}. {step.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sanitized Order Details Modal (zero files, zero raw phone, zero UTR/credentials) */}
      {detailOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sanitized-order-detail-title"
        >
          <div className="gd-card rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-5 relative">
            <button
              type="button"
              onClick={() => setDetailOrder(null)}
              aria-label="Close order details"
              className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pr-10">
              <p className="font-mono-tabular text-xs font-bold text-[#35AFFF]">
                {detailOrder.orderId}
              </p>
              <h3
                id="sanitized-order-detail-title"
                className="font-display font-extrabold text-xl text-[#FFD369]"
              >
                {detailOrder.serviceName}
              </h3>
              <p className="text-xs text-slate-300">
                Placed on {formatDate(detailOrder.createdAt)}
              </p>
            </div>

            <div className="rounded-2xl bg-[#06142E] border border-[#35AFFF]/30 p-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Customer Name</span>
                <span className="font-semibold text-white">
                  {detailOrder.customerName || 'Customer'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Service Price</span>
                <span className="font-mono-tabular text-white">
                  {formatPriceINR(detailOrder.servicePrice ?? detailOrder.finalAmount ?? 0)}
                </span>
              </div>
              {(detailOrder.discountAmount || 0) > 0 && (
                <div className="flex items-center justify-between gap-2 text-emerald-300">
                  <span>Discount</span>
                  <span className="font-mono-tabular">
                    -{formatPriceINR(detailOrder.discountAmount || 0)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-[#35AFFF]/20 pt-2">
                <span className="font-bold text-white">Total Amount</span>
                <span className="font-mono-tabular font-extrabold text-[#FFD369]">
                  {formatPriceINR(detailOrder.finalAmount ?? detailOrder.servicePrice ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-[#35AFFF]/20 pt-2">
                <span className="text-slate-400">Payment Status</span>
                <span
                  className={`font-bold text-xs ${
                    detailOrder.paymentStatus === 'PAYMENT VERIFIED'
                      ? 'text-emerald-300'
                      : detailOrder.paymentStatus === 'PAYMENT REJECTED'
                        ? 'text-rose-300'
                        : 'text-[#FFD369]'
                  }`}
                >
                  {detailOrder.paymentStatus || 'PAYMENT VERIFICATION PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Current Order Status</span>
                <span className="font-bold text-xs text-[#35AFFF]">
                  {getLiveOrderStepsState(detailOrder.status, detailOrder.paymentStatus).friendlyLabel}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-[#06142E]/70 border border-[#35AFFF]/20 p-3.5 space-y-1">
              <p className="text-xs font-semibold text-[#FFD369]">Studio Update</p>
              <p className="text-xs sm:text-sm text-slate-200">{detailOrder.deliveryStatus}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <a
                href={buildWhatsAppUrl(
                  settings.whatsappNumber || '916353894486',
                  `Hello ${settings.brandName || 'gurudev_designs'}, I am checking on my Order ID: ${detailOrder.orderId} (${detailOrder.serviceName}).`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="gd-glow-btn-gold flex-1 min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                WhatsApp Support
              </a>
              <button
                type="button"
                onClick={() => setDetailOrder(null)}
                className="gd-glow-btn-blue min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
