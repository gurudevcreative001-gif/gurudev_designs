import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  MessageCircle,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import {
  deleteOrderRecord,
  resolveStorageUrl,
  updateOrderStatusAndNotes,
} from '../../services/firebaseService';
import {
  ORDER_STATUSES,
  type OrderRecord,
  type OrderStatus,
  type PaymentVerificationStatus,
  type ServiceItem,
} from '../../types/design';
import {
  buildWhatsAppUrl,
  formatPriceINR,
  getLiveOrderStepsState,
} from '../../utils/orderUtils';

export type AdminOrdersFilterMode =
  | 'ALL'
  | 'NEW'
  | 'PENDING'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_RECEIVED'
  | 'DESIGNING'
  | 'COMPLETED'
  | 'DELIVERED'
  | 'CANCELLED';

interface AdminOrdersPanelProps {
  orders: OrderRecord[];
  services: ServiceItem[];
  statusFilterMode: AdminOrdersFilterMode;
  focusOrderId?: string | null;
  onClearFocusOrder?: () => void;
}

const QUICK_STATUS_PILLS: Array<{
  label: string;
  status: OrderStatus;
  paymentStatus?: PaymentVerificationStatus;
}> = [
  { label: 'New Order', status: 'NEW ORDER' },
  { label: 'Payment Pending', status: 'PAYMENT PENDING' },
  { label: 'Payment Verified', status: 'PAYMENT RECEIVED', paymentStatus: 'PAYMENT VERIFIED' },
  { label: 'Designing Started', status: 'DESIGNING' },
  { label: 'Design Completed', status: 'DESIGN COMPLETED' },
  { label: 'Delivered', status: 'DELIVERED' },
  { label: 'Cancelled', status: 'CANCELLED' },
];

const StorageAttachmentPreview: React.FC<{
  urlOrPath: string;
  alt: string;
  label: string;
  imgClassName: string;
  compactDownloadLabel?: string;
}> = ({ urlOrPath, alt, label, imgClassName, compactDownloadLabel = 'Download' }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(
    urlOrPath.startsWith('storage://') ? '' : urlOrPath
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!urlOrPath.startsWith('storage://')) {
      setResolvedUrl(urlOrPath);
      setLoadFailed(false);
      return;
    }
    resolveStorageUrl(urlOrPath)
      .then((url) => {
        if (active) {
          setResolvedUrl(url);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [urlOrPath]);

  return (
    <div className="space-y-2">
      {resolvedUrl ? (
        <img src={resolvedUrl} alt={alt} referrerPolicy="no-referrer" className={imgClassName} />
      ) : (
        <div className="w-full h-28 rounded-lg bg-[#06142E] border border-[#35AFFF]/20 flex items-center justify-center text-[11px] text-slate-400 px-2 text-center">
          {loadFailed ? 'Protected file unavailable' : 'Resolving secure file...'}
        </div>
      )}
      <div className="flex items-center justify-between text-xs gap-2">
        <span className="text-slate-300 truncate">{label}</span>
        {resolvedUrl && (
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="text-[#FFD369] hover:underline inline-flex items-center gap-1 font-semibold shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            {compactDownloadLabel}
          </a>
        )}
      </div>
    </div>
  );
};

function formatOrderTimestamp(ts: unknown): { label: string; isoDate: string } {
  if (!ts || typeof ts !== 'object' || !('toDate' in ts)) {
    return { label: 'Just now', isoDate: '' };
  }
  const d = (ts as { toDate: () => Date }).toDate();
  return {
    label: d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    isoDate: d.toISOString().slice(0, 10),
  };
}

export const AdminOrdersPanel: React.FC<AdminOrdersPanelProps> = ({
  orders,
  services,
  statusFilterMode,
  focusOrderId,
  onClearFocusOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>('PAYMENT VERIFICATION PENDING');
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentVerificationStatus>(
    'PAYMENT VERIFICATION PENDING'
  );
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OrderRecord | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [checkingRazorpay, setCheckingRazorpay] = useState(false);

  useEffect(() => {
    if (!focusOrderId) return;
    const match = orders.find((o) => o.orderId === focusOrderId);
    if (match) {
      openOrderModal(match);
      onClearFocusOrder?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOrderId, orders]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      const pStatus = o.paymentStatus || 'PAYMENT VERIFICATION PENDING';
      if (statusFilterMode === 'NEW' && o.status !== 'NEW ORDER') {
        return false;
      }
      if (
        statusFilterMode === 'PENDING' &&
        (o.status === 'CANCELLED' ||
          ![
            'NEW ORDER',
            'PAYMENT VERIFICATION PENDING',
            'PAYMENT PENDING',
            'PAYMENT RECEIVED',
          ].includes(o.status))
      ) {
        return false;
      }
      if (
        statusFilterMode === 'PAYMENT_PENDING' &&
        (o.status === 'CANCELLED' ||
          (pStatus !== 'PAYMENT VERIFICATION PENDING' &&
            o.status !== 'PAYMENT VERIFICATION PENDING' &&
            o.status !== 'PAYMENT PENDING'))
      ) {
        return false;
      }
      if (
        statusFilterMode === 'PAYMENT_RECEIVED' &&
        (o.status === 'CANCELLED' ||
          (pStatus !== 'PAYMENT VERIFIED' && o.status !== 'PAYMENT RECEIVED'))
      ) {
        return false;
      }
      if (statusFilterMode === 'DESIGNING' && o.status !== 'DESIGNING') return false;
      if (statusFilterMode === 'COMPLETED' && o.status !== 'DESIGN COMPLETED') return false;
      if (statusFilterMode === 'DELIVERED' && o.status !== 'DELIVERED') return false;
      if (statusFilterMode === 'CANCELLED' && o.status !== 'CANCELLED') return false;

      if (serviceFilter !== 'ALL' && o.serviceId !== serviceFilter) return false;

      if (dateFilter) {
        const { isoDate } = formatOrderTimestamp(o.createdAt);
        if (isoDate !== dateFilter) return false;
      }

      if (q) {
        const matchId = o.orderId.toLowerCase().includes(q);
        const matchMobile = o.mobile.toLowerCase().includes(q);
        const matchName = o.customerName.toLowerCase().includes(q);
        const matchRef = (o.paymentReference || '').toLowerCase().includes(q);
        const matchRzp = (o.razorpayPaymentId || '').toLowerCase().includes(q);
        if (!matchId && !matchMobile && !matchName && !matchRef && !matchRzp) return false;
      }
      return true;
    });
  }, [orders, statusFilterMode, serviceFilter, dateFilter, searchTerm]);

  const openOrderModal = (order: OrderRecord) => {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setEditPaymentStatus(order.paymentStatus || 'PAYMENT VERIFICATION PENDING');
    setEditNotes(order.adminNotes || '');
    setActionMessage(null);
  };

  const handleCheckRazorpayStatus = async () => {
    if (!selectedOrder?.razorpayPaymentId) return;
    setCheckingRazorpay(true);
    setActionMessage(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/payments/razorpay/verify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken || ''}`,
        },
        body: JSON.stringify({ razorpayPaymentId: selectedOrder.razorpayPaymentId }),
      });
      const data = (await res.json()) as {
        status?: string;
        amountInInr?: number;
        method?: string;
        error?: string;
      };
      if (!res.ok) {
        setActionMessage(data.error || 'Could not query Razorpay payment status.');
      } else {
        setActionMessage(
          `Razorpay Live API: status="${data.status}", amount=₹${data.amountInInr}, method=${data.method}`
        );
      }
    } catch {
      setActionMessage('Unable to contact Razorpay verification endpoint.');
    } finally {
      setCheckingRazorpay(false);
    }
  };

  const handleSaveOrderChanges = async (
    overrideStatus?: OrderStatus,
    overridePaymentStatus?: PaymentVerificationStatus,
    feedbackText?: string
  ) => {
    if (!selectedOrder?.docId) return;
    const nextStatus = overrideStatus || editStatus;
    const nextPaymentStatus = overridePaymentStatus || editPaymentStatus;
    setSaving(true);
    setActionMessage(null);
    try {
      await updateOrderStatusAndNotes(
        selectedOrder.docId,
        selectedOrder.trackingKey,
        nextStatus,
        editNotes,
        nextPaymentStatus
      );
      setEditStatus(nextStatus);
      setEditPaymentStatus(nextPaymentStatus);
      setSelectedOrder({
        ...selectedOrder,
        status: nextStatus,
        paymentStatus: nextPaymentStatus,
        adminNotes: editNotes,
      });
      setActionMessage(
        feedbackText || 'Order status synced live to customer My Orders screen.'
      );
    } catch {
      setActionMessage('Failed to update order. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete?.docId) return;
    setSaving(true);
    try {
      await deleteOrderRecord(
        confirmDelete.docId,
        confirmDelete.trackingKey,
        confirmDelete.mobile
      );
      if (selectedOrder?.docId === confirmDelete.docId) {
        setSelectedOrder(null);
      }
      setConfirmDelete(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search and Filters */}
      <div className="gd-card rounded-2xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search
            className="w-4 h-4 text-[#35AFFF] absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Order ID, mobile, name, or UTR ref..."
            aria-label="Search orders"
            className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
          />
        </div>

        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          aria-label="Filter by service"
          className="h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white focus:outline-none focus:border-[#35AFFF]"
        >
          <option value="ALL">All Services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter by date"
            className="flex-1 h-10 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white focus:outline-none focus:border-[#35AFFF]"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-2.5 h-10 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-xs text-slate-300 hover:text-white cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="gd-card rounded-2xl p-8 text-center text-slate-300">
          No orders match the current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const { label } = formatOrderTimestamp(order.createdAt);
            const pStatus = order.paymentStatus || 'PAYMENT VERIFICATION PENDING';
            const customerWaUrl = buildWhatsAppUrl(
              order.mobile,
              `Hello ${order.customerName}, update on your gurudev_designs order ${order.orderId} (${order.serviceName}): Order Status is ${order.status}, Payment Status is ${pStatus}.`
            );
            return (
              <div
                key={order.docId || order.orderId}
                className="gd-card rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono-tabular font-bold text-[#FFD369]">
                      {order.orderId}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-[#35AFFF] font-semibold">{order.status}</span>
                    <span className="text-slate-400">·</span>
                    <span
                      className={`font-semibold ${
                        pStatus === 'PAYMENT VERIFIED'
                          ? 'text-emerald-300'
                          : pStatus === 'PAYMENT REJECTED'
                            ? 'text-rose-300'
                            : 'text-amber-300'
                      }`}
                    >
                      {pStatus}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400">{label}</span>
                  </div>
                  <p className="font-semibold text-white text-base">
                    {order.customerName}{' '}
                    <span className="font-mono-tabular text-sm text-slate-300 font-normal">
                      ({order.mobile})
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm text-slate-300">
                    {order.serviceName}
                    {typeof order.finalAmount === 'number'
                      ? ` · ${formatPriceINR(order.finalAmount)}`
                      : ''}{' '}
                    {order.paymentReference ? `· UTR: ${order.paymentReference}` : ''} ·{' '}
                    {order.designSize} · {order.language}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openOrderModal(order)}
                    className="gd-glow-btn-gold px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    Manage &amp; Verify
                  </button>
                  <a
                    href={customerWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gd-glow-btn-blue px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#FFD369]" aria-hidden="true" />
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(order)}
                    aria-label={`Delete order ${order.orderId}`}
                    className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 hover:bg-rose-500/25 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail, Payment Verification & Edit Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-order-title"
        >
          <div className="gd-card rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-7 space-y-5 relative">
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              aria-label="Close order details"
              className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <p className="font-mono-tabular text-xs text-[#35AFFF] font-semibold">
                {selectedOrder.orderId}
              </p>
              <h3 id="admin-order-title" className="font-display font-bold text-2xl text-[#FFD369]">
                {selectedOrder.customerName} — {selectedOrder.serviceName}
              </h3>
              <p className="text-sm text-slate-300 mt-1">
                WhatsApp: <span className="font-mono-tabular text-white">{selectedOrder.mobile}</span>{' '}
                · Size: {selectedOrder.designSize} · Language: {selectedOrder.language}
              </p>
            </div>

            {/* Payment Verification Panel */}
            <div className="rounded-2xl bg-[#06142E] border border-[#FFD369]/35 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display font-bold text-sm text-[#FFD369]">
                  Payment Verification Details
                </h4>
                <span
                  className={`text-xs font-bold ${
                    editPaymentStatus === 'PAYMENT VERIFIED'
                      ? 'text-emerald-300'
                      : editPaymentStatus === 'PAYMENT REJECTED'
                        ? 'text-rose-300'
                        : 'text-amber-300'
                  }`}
                >
                  {editPaymentStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-slate-400">Service Price</p>
                  <p className="font-mono-tabular font-bold text-white">
                    {typeof selectedOrder.servicePrice === 'number'
                      ? formatPriceINR(selectedOrder.servicePrice)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Discount</p>
                  <p className="font-mono-tabular font-bold text-emerald-300">
                    {typeof selectedOrder.discountAmount === 'number'
                      ? formatPriceINR(selectedOrder.discountAmount)
                      : '₹0'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Final Payable</p>
                  <p className="font-mono-tabular font-bold text-[#FFD369]">
                    {typeof selectedOrder.finalAmount === 'number'
                      ? formatPriceINR(selectedOrder.finalAmount)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Payment Method</p>
                  <p className="font-semibold text-white">
                    {selectedOrder.paymentMethod || 'Scan & Pay QR'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400">Payment Reference / UTR Number</p>
                  <p className="font-mono-tabular text-sm font-bold text-white">
                    {selectedOrder.paymentReference || 'Not entered'}
                  </p>
                </div>
                {selectedOrder.razorpayOrderId && (
                  <div>
                    <p className="text-slate-400">Razorpay Order / Payment ID</p>
                    <p className="font-mono-tabular text-xs text-emerald-300">
                      {selectedOrder.razorpayOrderId} · {selectedOrder.razorpayPaymentId}
                    </p>
                  </div>
                )}
              </div>

              {selectedOrder.paymentScreenshotUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Customer Payment Screenshot</p>
                  <div className="max-w-xs">
                    <StorageAttachmentPreview
                      urlOrPath={selectedOrder.paymentScreenshotUrl}
                      alt="Customer Payment Screenshot"
                      label="Payment Proof"
                      imgClassName="w-40 h-40 object-contain rounded-xl bg-black/40 border border-[#35AFFF]/30"
                      compactDownloadLabel="View / Download Screenshot"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5 pt-2 border-t border-[#35AFFF]/20">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    handleSaveOrderChanges(
                      'PAYMENT RECEIVED',
                      'PAYMENT VERIFIED',
                      'Payment verified! Live My Orders step updated to Payment Verified.'
                    )
                  }
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/30 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Verify Payment
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    handleSaveOrderChanges(
                      'PAYMENT VERIFICATION PENDING',
                      'PAYMENT REJECTED',
                      'Payment marked as REJECTED.'
                    )
                  }
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-400/60 text-rose-200 hover:bg-rose-500/30 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                  Reject Payment
                </button>
                {selectedOrder.razorpayPaymentId && (
                  <button
                    type="button"
                    disabled={checkingRazorpay}
                    onClick={handleCheckRazorpayStatus}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#10264B] border border-[#35AFFF]/50 text-[#35AFFF] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${checkingRazorpay ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    Verify Razorpay API
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#06142E]/70 border border-[#35AFFF]/25 rounded-2xl p-4 text-sm">
              <div>
                <p className="text-xs text-[#FFD369] font-semibold mb-1">Text to Include</p>
                <p className="text-slate-200 whitespace-pre-wrap">
                  {selectedOrder.designText || 'None provided'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#FFD369] font-semibold mb-1">Detailed Requirements</p>
                <p className="text-slate-200 whitespace-pre-wrap">{selectedOrder.requirements}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-[#FFD369] font-semibold mb-1">Special Instructions</p>
                <p className="text-slate-200">
                  {selectedOrder.specialInstructions || 'None'}
                </p>
              </div>
            </div>

            {/* Uploaded Photos & Logo */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white">Uploaded Reference Files &amp; Logo</h4>
              {selectedOrder.referencePhotos.length === 0 && !selectedOrder.logoUrl ? (
                <p className="text-xs text-slate-400">No design files were uploaded with this order.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedOrder.referencePhotos.map((url, idx) => (
                    <div
                      key={url}
                      className="bg-[#06142E] border border-[#35AFFF]/30 rounded-xl p-2"
                    >
                      <StorageAttachmentPreview
                        urlOrPath={url}
                        alt={`Reference ${idx + 1}`}
                        label={`Ref #${idx + 1}`}
                        imgClassName="w-full h-28 object-cover rounded-lg"
                      />
                    </div>
                  ))}
                  {selectedOrder.logoUrl && (
                    <div className="bg-[#06142E] border border-[#FFD369]/40 rounded-xl p-2">
                      <StorageAttachmentPreview
                        urlOrPath={selectedOrder.logoUrl}
                        alt="Customer Logo"
                        label="Logo"
                        imgClassName="w-full h-28 object-contain rounded-lg bg-white/5"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 1-Click Live Status Quick Actions */}
            <div className="space-y-2 pt-2 border-t border-[#35AFFF]/20">
              <p className="text-xs font-semibold text-[#FFD369]">
                Quick Live Status Update (Syncs Instantly to Customer My Orders)
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_STATUS_PILLS.map((pill) => {
                  const isCurrent = editStatus === pill.status;
                  const isCancel = pill.status === 'CANCELLED';
                  return (
                    <button
                      key={pill.label}
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        handleSaveOrderChanges(
                          pill.status,
                          pill.paymentStatus || editPaymentStatus,
                          `Order updated to "${pill.label}" and synced live to customer.`
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-60 ${
                        isCurrent
                          ? isCancel
                            ? 'bg-rose-500 text-white border-rose-400'
                            : 'bg-[#FFD369] text-[#06142E] border-[#FFD369]'
                          : isCancel
                            ? 'bg-rose-500/10 text-rose-200 border-rose-400/35 hover:bg-rose-500/20'
                            : 'bg-[#06142E] text-slate-200 border-[#35AFFF]/35 hover:border-[#35AFFF]'
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status & Internal Admin Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#35AFFF]/20">
              <div className="space-y-1.5">
                <label htmlFor="admin-status-select" className="block text-xs font-semibold text-white">
                  Order Status (Live synced to My Orders)
                </label>
                <select
                  id="admin-status-select"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                  className="w-full h-11 px-3 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white focus:outline-none focus:border-[#35AFFF]"
                >
                  {ORDER_STATUSES.map((st) => {
                    const stepLabel = getLiveOrderStepsState(st, editPaymentStatus).friendlyLabel;
                    return (
                      <option key={st} value={st}>
                        {st} ({stepLabel})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-notes-input" className="block text-xs font-semibold text-white">
                  Internal Admin Notes
                </label>
                <textarea
                  id="admin-notes-input"
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Designer assigned, payment ref verification, revision notes..."
                  className="w-full p-2.5 rounded-xl bg-[#06142E] border border-[#35AFFF]/35 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#35AFFF]"
                />
              </div>
            </div>

            {actionMessage && (
              <p className="text-xs font-semibold text-emerald-300">{actionMessage}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <a
                href={buildWhatsAppUrl(
                  selectedOrder.mobile,
                  `Hello ${selectedOrder.customerName}, regarding your gurudev_designs Order ${selectedOrder.orderId} (${selectedOrder.serviceName}), Order Status: ${editStatus}, Payment Status: ${editPaymentStatus}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="gd-glow-btn-blue px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
                Chat with Customer
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>

              <button
                type="button"
                onClick={() => handleSaveOrderChanges()}
                disabled={saving}
                className="gd-glow-btn-gold px-6 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Status & Notes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-title"
        >
          <div className="gd-card rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 id="delete-order-title" className="font-display font-bold text-lg text-[#FFD369]">
              Delete Order {confirmDelete.orderId}?
            </h3>
            <p className="text-sm text-slate-300">
              This will permanently remove the order for <strong className="text-white">{confirmDelete.customerName}</strong> and its tracking record.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="gd-glow-btn-blue px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold cursor-pointer"
              >
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
