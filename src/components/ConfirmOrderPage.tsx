import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Home,
  MessageCircle,
} from 'lucide-react';
import type { ConfirmedOrderSummary, SiteSettings } from '../types/design';
import { buildWhatsAppUrl, formatPriceINR, getLiveOrderStepsState } from '../utils/orderUtils';

interface ConfirmOrderPageProps {
  latestOrder: ConfirmedOrderSummary | null;
  settings: SiteSettings;
  onGoToMyOrders: (mobile?: string) => void;
  onBackToHome: () => void;
}

export const ConfirmOrderPage: React.FC<ConfirmOrderPageProps> = ({
  latestOrder,
  settings,
  onGoToMyOrders,
  onBackToHome,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyOrderId = async () => {
    if (!latestOrder) return;
    try {
      await navigator.clipboard.writeText(latestOrder.orderId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Clipboard blocked in sandbox
    }
  };

  const fallbackWhatsAppUrl = buildWhatsAppUrl(
    settings.whatsappNumber || '916353894486',
    `Hello ${settings.brandName || 'gurudev_designs'}, I want an update on my design order.`
  );

  if (!latestOrder) {
    return (
      <section aria-labelledby="confirm-order-heading" className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="gd-card rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <h1
            id="confirm-order-heading"
            className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFD369]"
          >
            Track Your Recent Orders
          </h1>
          <p className="text-sm text-slate-300">
            Open My Orders and enter your WhatsApp number to check live progress anytime.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onGoToMyOrders()}
              className="gd-glow-btn-gold min-h-[44px] px-5 py-2.5 rounded-2xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" aria-hidden="true" />
              Go to My Orders
            </button>
            <button
              type="button"
              onClick={onBackToHome}
              className="gd-glow-btn-blue min-h-[44px] px-5 py-2.5 rounded-2xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
              Back to Home
            </button>
          </div>
        </div>
      </section>
    );
  }

  const liveProgress = getLiveOrderStepsState(
    latestOrder.orderStatus,
    latestOrder.paymentStatus
  );

  return (
    <section
      aria-labelledby="confirm-order-heading"
      className="max-w-4xl mx-auto px-4 sm:px-6"
    >
      <div
        data-testid="order-confirmation-card"
        className="gd-card rounded-3xl p-5 sm:p-8 space-y-6"
      >
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
            <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
          </div>

          <h1
            id="confirm-order-heading"
            className="font-display font-extrabold text-2xl sm:text-3xl text-[#FFD369] tracking-tight"
          >
            ORDER SUCCESSFULLY PLACED!
          </h1>

          <p className="text-sm sm:text-base text-slate-200 max-w-xl mx-auto leading-relaxed">
            Thank you for choosing {settings.brandName || 'gurudev_designs'}! Track live updates anytime in{' '}
            <strong className="text-white">My Orders</strong> using your WhatsApp number.
          </p>
        </div>

        {/* Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-[#06142E] border border-[#35AFFF]/35 rounded-2xl p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Order ID</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono-tabular text-sm font-extrabold text-[#FFD369] whitespace-nowrap">
                {latestOrder.orderId}
              </span>
              <button
                type="button"
                onClick={handleCopyOrderId}
                aria-label="Copy Order ID"
                className="p-1.5 rounded-lg bg-[#10264B] border border-[#35AFFF]/35 text-[#35AFFF] hover:text-white cursor-pointer shrink-0"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Customer Name</p>
            <p className="text-sm font-semibold text-white">{latestOrder.customerName}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Service Name</p>
            <p className="text-sm font-semibold text-white">{latestOrder.serviceName}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Amount Paid</p>
            <p className="font-mono-tabular text-sm sm:text-base font-bold text-[#FFD369]">
              {formatPriceINR(latestOrder.finalAmount)}
              {latestOrder.discountAmount > 0 && (
                <span className="ml-1.5 text-xs text-slate-400 line-through font-normal">
                  {formatPriceINR(latestOrder.servicePrice)}
                </span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Payment Status</p>
            <p
              className={`text-xs sm:text-sm font-bold ${
                latestOrder.paymentStatus === 'PAYMENT VERIFIED'
                  ? 'text-emerald-300'
                  : 'text-[#FFD369]'
              }`}
            >
              {latestOrder.paymentStatus}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Order Status</p>
            <p className="text-xs sm:text-sm font-bold text-[#35AFFF]">
              {liveProgress.friendlyLabel}
            </p>
          </div>
        </div>

        {/* Exact 3 Required Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onGoToMyOrders(latestOrder.mobile)}
            className="gd-glow-btn-gold min-h-[48px] px-4 py-3 rounded-2xl font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" aria-hidden="true" />
            <span>My Orders</span>
          </button>

          <a
            href={latestOrder.whatsappUrl || fallbackWhatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gd-glow-btn-blue min-h-[48px] px-4 py-3 rounded-2xl font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-4 h-4 text-[#FFD369]" aria-hidden="true" />
            <span>WhatsApp Contact</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={onBackToHome}
            className="min-h-[48px] px-4 py-3 rounded-2xl bg-[#06142E] border border-[#35AFFF]/35 text-slate-200 hover:text-white hover:border-[#35AFFF] font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Home className="w-4 h-4 text-[#35AFFF]" aria-hidden="true" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </section>
  );
};
